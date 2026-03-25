/**
 * routes/service.js
 * Stato del servizio GTT e informazioni sulla metropolitana.
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { withCache } = require('../utils/cache');
const { getServiceAlerts, isRealtimeEnabled, checkRealtimeHealth } = require('../gtfs/realtime');
const { checkOtpHealth } = require('../gtfs/otp');
const { getActiveServiceIds } = require('../utils/serviceCalendar');
const axios = require('axios');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

// Metro GTT — route_type = 1 (Subway)
// La metro di Torino ha route_short_name "M1"
const METRO_ROUTE_TYPE = 1;

/**
 * GET /api/service/status
 * Stato generale del servizio (avvisi, interruzioni, deviazioni).
 */
router.get('/status', async (req, res) => {
  try {
    const alerts = await getServiceAlerts();

    res.json({
      realtimeEnabled: isRealtimeEnabled(),
      ...alerts,
      // Se realtime non disponibile, avvisa chiaramente
      disclaimer: !isRealtimeEnabled()
        ? 'Le informazioni sullo stato del servizio in tempo reale ' +
          'non sono disponibili. Per aggiornamenti ufficiali consultare ' +
          'il sito gtt.to.it o l\'app Muoversi a Torino.'
        : null,
    });
  } catch (err) {
    console.error('[service/status]', err);
    res.status(500).json({ error: 'Errore nel recupero stato servizio' });
  }
});

/**
 * GET /api/service/metro
 * Informazioni sulla metropolitana di Torino (Linea 1 M1).
 */
router.get('/metro', (req, res) => {
  const result = withCache('lines', 'metro:all', async () => {
    const db = getDb();

    // Trova la linea metro nel GTFS
    const metroRoutes = db.prepare(`
      SELECT route_id, route_short_name, route_long_name,
             route_type, route_color, route_text_color
      FROM routes
      WHERE route_type = ?
      ORDER BY route_short_name
    `).all(METRO_ROUTE_TYPE);

    if (!metroRoutes.length) {
      return {
        available: false,
        message: 'Dati metropolitana non presenti nel feed GTFS corrente',
      };
    }

    const metroDetails = [];

    for (const route of metroRoutes) {
      // Direzioni della linea metro
      const directions = db.prepare(`
        SELECT DISTINCT direction_id, trip_headsign
        FROM trips
        WHERE route_id = ?
        ORDER BY direction_id
      `).all(route.route_id);

      // Per ogni direzione, fermate in ordine
      const directionStops = [];
      for (const dir of directions) {
        // Prende la corsa con il maggior numero di fermate per quella direzione:
        // garantisce di ottenere il percorso completo (non una corsa parziale)
        const sampleTrip = db.prepare(`
          SELECT t.trip_id, COUNT(st.stop_id) AS stop_count
          FROM trips t
          JOIN stop_times st ON st.trip_id = t.trip_id
          WHERE t.route_id = ? AND t.direction_id = ?
          GROUP BY t.trip_id
          ORDER BY stop_count DESC
          LIMIT 1
        `).get(route.route_id, dir.direction_id);

        if (!sampleTrip) continue;

        const stops = db.prepare(`
          SELECT
            s.stop_id, s.stop_code, s.stop_name,
            s.stop_lat, s.stop_lon,
            st.departure_time, st.stop_sequence
          FROM stop_times st
          JOIN stops s ON s.stop_id = st.stop_id
          WHERE st.trip_id = ?
          ORDER BY st.stop_sequence
        `).all(sampleTrip.trip_id);

        directionStops.push({
          direction_id: dir.direction_id,
          headsign: dir.trip_headsign,
          stops,
        });
      }

      metroDetails.push({
        routeId: route.route_id,
        name: route.route_short_name,
        fullName: route.route_long_name,
        color: route.route_color ? `#${route.route_color}` : '#E84B24',
        directions: directionStops,
      });
    }

    return {
      available: true,
      routes: metroDetails,
    };
  });

  result.then(data => res.json(data)).catch(err => {
    console.error('[service/metro]', err);
    res.status(500).json({ error: 'Errore nel recupero dati metro' });
  });
});

/**
 * GET /api/service/gtfs-info
 * Info sul feed GTFS caricato (versione, data, statistiche).
 */
router.get('/gtfs-info', (req, res) => {
  try {
    const db = getDb();

    const loadedAt = db.prepare(
      "SELECT value FROM gtfs_meta WHERE key = 'loaded_at'"
    ).get();

    const stats = {
      stops: db.prepare('SELECT COUNT(*) as c FROM stops').get().c,
      routes: db.prepare('SELECT COUNT(*) as c FROM routes').get().c,
      trips: db.prepare('SELECT COUNT(*) as c FROM trips').get().c,
      stopTimes: db.prepare('SELECT COUNT(*) as c FROM stop_times').get().c,
    };

    res.json({
      loaded: !!loadedAt,
      loadedAt: loadedAt?.value || null,
      stats,
      source: 'GTT - Gruppo Torinese Trasporti (GTFS Statico)',
      realtimeEnabled: isRealtimeEnabled(),
    });
  } catch (err) {
    console.error('[service/gtfs-info]', err);
    res.status(500).json({ error: 'Errore nel recupero info GTFS' });
  }
});

/**
 * GET /api/service/vehicles
 * Posizioni veicoli GTT.
 *
 * Strategia:
 *  1. Feed GTFS-RT VP GTT (percorsieorari.gtt.to.it) — sempre vuoto in pratica:
 *     GTT non pubblica GPS nel feed pubblico.
 *  2. Fallback automatico: posizioni STIMATE via interpolazione GTFS.
 *     Query GTFS: per ogni corsa attiva trova il segmento corrente
 *     (last_stop_before_now → next_stop) e interpola lat/lon.
 *     Cache 30s con refresh in background.
 */

// ── Cache feed VP (15s) ────────────────────────────────────────────────────────
let vpCache = { data: null, at: 0 };

// ── Cache posizioni stimate (30s) ─────────────────────────────────────────────
let estCache = { vehicles: null, at: 0, computing: false };

/** Calcola bearing in gradi da punto A a punto B */
function calcBearing(lat1, lon1, lat2, lon2) {
  const dLon = lon2 - lon1;
  return (Math.atan2(dLon, lat2 - lat1) * 180 / Math.PI + 360) % 360;
}

/** Padding zero per costruire stringa HH:MM:SS */
const pad2 = n => String(Math.floor(n)).padStart(2, '0');
function secsToTimeStr(s) {
  return `${pad2(s / 3600)}:${pad2((s % 3600) / 60)}:00`;
}

/**
 * Calcola posizioni stimate di tutti i veicoli attivi tramite GTFS statico.
 * Usa l'indice su departure_time per limitare il range di scansione.
 * Cache 30s, calcolo ~1-2 secondi (eseguito in background).
 */
function computeEstimatedVehicles() {
  const db = getDb();
  const activeServiceIds = getActiveServiceIds(db);
  if (!activeServiceIds.length) return [];

  // Ora corrente in secondi dalla mezzanotte (fuso Europe/Rome)
  const nowDate  = new Date();
  const romeStr  = nowDate.toLocaleString('en-US', { timeZone: 'Europe/Rome', hour12: false,
    hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const [h, m, s] = romeStr.split(':').map(Number);
  const nowSec   = h * 3600 + m * 60 + s;

  // Finestra: dalla corsa iniziata nelle ultime 2.5 ore fino ad ora
  const minStr = secsToTimeStr(Math.max(0, nowSec - 9000));
  const nowStr = secsToTimeStr(nowSec);

  // Popola temp table service_id
  db.exec('CREATE TEMP TABLE IF NOT EXISTS _est_svc (service_id TEXT PRIMARY KEY)');
  db.exec('DELETE FROM _est_svc');
  const ins = db.prepare('INSERT OR IGNORE INTO _est_svc VALUES (?)');
  db.transaction(ids => ids.forEach(id => ins.run(id)))(activeServiceIds);

  // Query: per ogni trip attivo, prendi l'ultimo stop prima di nowStr
  // poi unisci con lo stop successivo (seq+1) → segmento corrente
  const rows = db.prepare(`
    WITH prev AS (
      SELECT st.trip_id, MAX(st.stop_sequence) AS seq
      FROM stop_times st
      JOIN trips t ON t.trip_id = st.trip_id
      JOIN _est_svc ON _est_svc.service_id = t.service_id
      WHERE st.departure_time BETWEEN ? AND ?
      GROUP BY st.trip_id
    )
    SELECT
      p.trip_id,
      s1.stop_lat  AS lat,  s1.stop_lon  AS lon,
      CAST(SUBSTR(st1.departure_time,1,2) AS INTEGER)*3600 +
      CAST(SUBSTR(st1.departure_time,4,2) AS INTEGER)*60  +
      CAST(SUBSTR(st1.departure_time,7,2) AS INTEGER)     AS dep_sec,
      s2.stop_lat  AS next_lat, s2.stop_lon AS next_lon,
      CAST(SUBSTR(st2.departure_time,1,2) AS INTEGER)*3600 +
      CAST(SUBSTR(st2.departure_time,4,2) AS INTEGER)*60  +
      CAST(SUBSTR(st2.departure_time,7,2) AS INTEGER)     AS next_dep_sec,
      t.trip_headsign,
      r.route_id, r.route_short_name, r.route_long_name,
      r.route_type, r.route_color, r.route_text_color
    FROM prev p
    JOIN stop_times st1 ON st1.trip_id = p.trip_id AND st1.stop_sequence = p.seq
    JOIN stops s1       ON s1.stop_id  = st1.stop_id
    JOIN stop_times st2 ON st2.trip_id = p.trip_id AND st2.stop_sequence = p.seq + 1
    JOIN stops s2       ON s2.stop_id  = st2.stop_id
    JOIN trips t        ON t.trip_id   = p.trip_id
    JOIN routes r       ON r.route_id  = t.route_id
    LIMIT 600
  `).all(minStr, nowStr);

  return rows.map(r => {
    const range    = r.next_dep_sec - r.dep_sec;
    const progress = range > 0 ? Math.min(1, Math.max(0, (nowSec - r.dep_sec) / range)) : 0;
    const lat      = r.lat  + progress * (r.next_lat  - r.lat);
    const lon      = r.lon  + progress * (r.next_lon  - r.lon);
    const bearing  = Math.round(calcBearing(r.lat, r.lon, r.next_lat, r.next_lon));

    return {
      id:             r.trip_id,
      tripId:         r.trip_id,
      routeId:        r.route_id,
      routeShortName: r.route_short_name,
      routeLongName:  r.route_long_name  || null,
      routeType:      r.route_type,
      routeColor:     r.route_color      ? `#${r.route_color}`      : null,
      routeTextColor: r.route_text_color ? `#${r.route_text_color}` : null,
      headsign:       r.trip_headsign    || null,
      lat,
      lon,
      bearing,
      speed:          null,
      currentStatus:  'In transito',
      estimated:      true,  // non GPS reale
      timestamp:      new Date().toISOString(),
    };
  });
}

/** Avvia un refresh asincrono della cache stimata */
function refreshEstCache() {
  if (estCache.computing) return;
  estCache.computing = true;
  setImmediate(() => {
    try {
      const vehicles = computeEstimatedVehicles();
      estCache = { vehicles, at: Date.now(), computing: false };
    } catch (e) {
      console.error('[vehicles/estimated]', e.message);
      estCache.computing = false;
    }
  });
}

router.get('/vehicles', async (req, res) => {
  const url = process.env.GTFS_REALTIME_VP_URL;

  try {
    // ── 1. Prova feed VP GTFS-RT ──────────────────────────────────────────────
    if (url) {
      const now = Date.now();
      let feed;
      if (vpCache.data && now - vpCache.at < 15_000) {
        feed = vpCache.data;
      } else {
        try {
          const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 8_000 });
          feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));
          vpCache = { data: feed, at: now };
        } catch { /* feed non raggiungibile */ }
      }

      if (feed?.entity?.length) {
        const db = getDb();
        const routeCache = {};
        const getRoute = (routeId) => {
          if (!routeId) return null;
          if (routeCache[routeId]) return routeCache[routeId];
          const r = db.prepare(
            'SELECT route_short_name, route_long_name, route_type, route_color, route_text_color FROM routes WHERE route_id = ?'
          ).get(routeId);
          return (routeCache[routeId] = r || null);
        };
        const STATUS_LABELS = { 0: 'In avvicinamento', 1: 'Fermo alla fermata', 2: 'In transito' };
        const OCCUPANCY_LABELS = {
          0: 'Vuoto', 1: 'Molti posti liberi', 2: 'Posti liberi',
          3: 'In piedi', 4: 'Solo in piedi', 5: 'Pieno', 6: 'Non accetta passeggeri',
        };

        const vehicles = feed.entity
          .filter(e => e.vehicle?.position?.latitude && e.vehicle?.position?.longitude)
          .map(e => {
            const v     = e.vehicle;
            const route = getRoute(v.trip?.routeId);
            return {
              id: e.id, tripId: v.trip?.tripId || null, routeId: v.trip?.routeId || null,
              routeShortName: route?.route_short_name || '?',
              routeLongName:  route?.route_long_name  || null,
              routeType:  route?.route_type ?? 3,
              routeColor: route?.route_color      ? `#${route.route_color}`      : null,
              routeTextColor: route?.route_text_color ? `#${route.route_text_color}` : null,
              lat: v.position.latitude, lon: v.position.longitude,
              bearing: v.position.bearing ?? null,
              speed: v.position.speed != null ? Math.round(v.position.speed * 3.6) : null,
              currentStatus: STATUS_LABELS[v.currentStatus] || 'In transito',
              occupancy: OCCUPANCY_LABELS[v.occupancyStatus] || null,
              vehicleLabel: v.vehicle?.label || null,
              timestamp: v.timestamp ? new Date(Number(v.timestamp) * 1000).toISOString() : null,
              estimated: false,
            };
          });

        return res.json({ available: true, count: vehicles.length, vehicles, source: 'gtfs-rt',
          feedTimestamp: feed.header?.timestamp ? new Date(Number(feed.header.timestamp) * 1000).toISOString() : null });
      }
    }

    // ── 2. Fallback: posizioni stimate da GTFS statico ────────────────────────
    const now = Date.now();
    if (!estCache.vehicles || now - estCache.at > 30_000) {
      refreshEstCache();
    }

    // Se la cache non è ancora pronta, aspetta la prima computazione
    if (!estCache.vehicles) {
      const vehicles = computeEstimatedVehicles();
      estCache = { vehicles, at: Date.now(), computing: false };
    }

    // Avvia refresh in background per il prossimo poll
    if (now - estCache.at > 25_000) refreshEstCache();

    const vehicles = estCache.vehicles || [];
    return res.json({
      available: true,
      count: vehicles.length,
      vehicles,
      source: 'gtfs-estimated',
      note: 'Posizioni calcolate da orari GTFS (GPS non disponibile nel feed pubblico GTT)',
      generatedAt: new Date(estCache.at).toISOString(),
    });

  } catch (err) {
    console.error('[service/vehicles]', err.message);
    res.status(500).json({ error: 'Errore nel recupero posizioni veicoli', available: false, vehicles: [] });
  }
});

/**
 * GET /api/service/realtime-health
 * Diagnostica completa: OTP + feed GTFS-RT GTT.
 */
router.get('/realtime-health', async (req, res) => {
  try {
    const axios = require('axios');
    const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

    // OTP health
    const otpHealth = await checkOtpHealth();

    // Feed GTFS-RT GTT
    const urls = {
      tripUpdate:      process.env.GTFS_REALTIME_URL,
      vehiclePosition: process.env.GTFS_REALTIME_VP_URL,
      alerts:          process.env.GTFS_REALTIME_ALERTS_URL,
    };

    const gtfsRtFeeds = {};
    for (const [name, url] of Object.entries(urls)) {
      if (!url) { gtfsRtFeeds[name] = { status: 'not_configured' }; continue; }
      try {
        const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
          new Uint8Array(r.data)
        );
        gtfsRtFeeds[name] = {
          status: feed.entity?.length > 0 ? 'active' : 'empty',
          entityCount: feed.entity?.length ?? 0,
          bytes: r.data.byteLength,
          feedTimestamp: feed.header?.timestamp
            ? new Date(Number(feed.header.timestamp) * 1000).toISOString()
            : null,
        };
      } catch (e) {
        gtfsRtFeeds[name] = { status: 'error', error: e.message };
      }
    }

    res.json({
      checkedAt: new Date().toISOString(),
      primarySource: otpHealth.available ? 'otp' : 'gtfs-rt',
      otp: {
        url: 'https://plan.muoversiatorino.it/otp/routers/mato/index/graphql',
        ...otpHealth,
      },
      gtfsRtFeeds,
    });
  } catch (err) {
    console.error('[service/realtime-health]', err);
    res.status(500).json({ error: 'Errore nella diagnostica realtime' });
  }
});

module.exports = router;
