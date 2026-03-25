/**
 * routes/service.js
 * Stato del servizio GTT e informazioni sulla metropolitana.
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { withCache } = require('../utils/cache');
const { getServiceAlerts, isRealtimeEnabled } = require('../gtfs/realtime');
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
        const sampleTrip = db.prepare(`
          SELECT trip_id FROM trips
          WHERE route_id = ? AND direction_id = ?
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
 * Posizioni in tempo reale di tutti i veicoli GTT dal feed GTFS-RT.
 * Arricchisce con dati di linea da SQLite (nome, tipo, colore).
 * Refresh: ogni 15 secondi (cache lato backend).
 */

// Cache leggera per il feed vehicle positions (15s)
let vpCache = { data: null, at: 0 };

router.get('/vehicles', async (req, res) => {
  const url = process.env.GTFS_REALTIME_VP_URL;

  if (!url) {
    return res.json({ available: false, vehicles: [], message: 'Feed veicoli non configurato.' });
  }

  try {
    const now = Date.now();
    let feed;

    // Cache 15 secondi
    if (vpCache.data && now - vpCache.at < 15_000) {
      feed = vpCache.data;
    } else {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10_000 });
      feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));
      vpCache = { data: feed, at: now };
    }

    if (!feed.entity.length) {
      return res.json({
        available: true,
        vehicles: [],
        feedTimestamp: feed.header?.timestamp
          ? new Date(Number(feed.header.timestamp) * 1000).toISOString()
          : null,
        message: 'Nessun veicolo in circolazione al momento.',
      });
    }

    const db = getDb();

    // Cache delle linee per evitare query ripetute
    const routeCache = {};
    const getRoute = (routeId) => {
      if (!routeId) return null;
      if (routeCache[routeId]) return routeCache[routeId];
      const r = db.prepare(
        'SELECT route_short_name, route_long_name, route_type, route_color, route_text_color FROM routes WHERE route_id = ?'
      ).get(routeId);
      routeCache[routeId] = r || null;
      return r;
    };

    const OCCUPANCY_LABELS = {
      0: 'Vuoto', 1: 'Molti posti liberi', 2: 'Posti liberi',
      3: 'In piedi', 4: 'Solo in piedi', 5: 'Pieno', 6: 'Non accetta passeggeri',
    };

    const STATUS_LABELS = {
      0: 'In avvicinamento', 1: 'Fermo alla fermata', 2: 'In transito',
    };

    const vehicles = feed.entity
      .filter(e => e.vehicle?.position?.latitude && e.vehicle?.position?.longitude)
      .map(e => {
        const v = e.vehicle;
        const route = getRoute(v.trip?.routeId);

        return {
          id: e.id,
          tripId: v.trip?.tripId || null,
          routeId: v.trip?.routeId || null,
          routeShortName: route?.route_short_name || v.trip?.routeId || '?',
          routeLongName: route?.route_long_name || null,
          routeType: route?.route_type ?? 3,
          routeColor: route?.route_color ? `#${route.route_color}` : null,
          routeTextColor: route?.route_text_color ? `#${route.route_text_color}` : null,
          lat: v.position.latitude,
          lon: v.position.longitude,
          bearing: v.position.bearing ?? null,   // gradi 0-360
          speed: v.position.speed != null
            ? Math.round(v.position.speed * 3.6) // m/s → km/h
            : null,
          stopId: v.stopId || null,
          currentStatus: STATUS_LABELS[v.currentStatus] || 'In transito',
          occupancy: OCCUPANCY_LABELS[v.occupancyStatus] || null,
          vehicleLabel: v.vehicle?.label || null,
          timestamp: v.timestamp
            ? new Date(Number(v.timestamp) * 1000).toISOString()
            : null,
        };
      });

    res.json({
      available: true,
      count: vehicles.length,
      vehicles,
      feedTimestamp: feed.header?.timestamp
        ? new Date(Number(feed.header.timestamp) * 1000).toISOString()
        : null,
    });
  } catch (err) {
    console.error('[service/vehicles]', err.message);
    res.status(500).json({ error: 'Errore nel recupero posizioni veicoli', available: false, vehicles: [] });
  }
});

module.exports = router;
