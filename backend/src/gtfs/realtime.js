/**
 * realtime.js
 * Gestione GTFS Realtime per GTT Torino.
 *
 * Feed ufficiali GTT (verificati, nessuna autenticazione richiesta):
 *   Trip Updates:       http://percorsieorari.gtt.to.it/das_gtfsrt/trip_update.aspx
 *   Vehicle Positions:  http://percorsieorari.gtt.to.it/das_gtfsrt/vehicle_position.aspx
 *   Service Alerts:     http://percorsieorari.gtt.to.it/das_gtfsrt/alerts.aspx
 *
 * Licenza dati: CC-BY-4.0 (fonte: aperTO / opendata Comune di Torino)
 */

const axios = require('axios');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

const URLS = {
  tripUpdate:       process.env.GTFS_REALTIME_URL,
  vehiclePosition:  process.env.GTFS_REALTIME_VP_URL,
  alerts:           process.env.GTFS_REALTIME_ALERTS_URL,
};

const TTL_MS = (parseInt(process.env.GTFS_REALTIME_REFRESH_SECONDS) || 30) * 1000;

// Cache separata per ogni feed
const cache = {
  tripUpdate:      { data: null, fetchedAt: null },
  vehiclePosition: { data: null, fetchedAt: null },
  alerts:          { data: null, fetchedAt: null },
};

/**
 * Scarica e decodifica un feed GTFS-RT con cache.
 */
async function fetchFeed(type) {
  const url = URLS[type];
  if (!url) return null;

  const now = Date.now();
  const c = cache[type];
  if (c.data && c.fetchedAt && now - c.fetchedAt < TTL_MS) {
    return c.data;
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10_000,
      headers: { 'User-Agent': 'GTT-WebApp/1.0' },
    });

    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(response.data)
    );

    cache[type] = { data: feed, fetchedAt: now };
    return feed;
  } catch (err) {
    console.warn(`[Realtime] Feed ${type} non raggiungibile:`, err.message);
    // Restituisce cache scaduta piuttosto che null, se disponibile
    return c.data || null;
  }
}

/**
 * Ritardi realtime per un set di trip_id.
 * Combina trip_update + vehicle_position.
 *
 * Strategia delay selection:
 *   - Scorre tutti gli stopTimeUpdate della corsa
 *   - Usa l'ultimo delay trovato (l'aggiornamento più recente nella sequenza)
 *   - Preferisce departure.delay su arrival.delay
 *   - Se il feed di vehicle_position riporta un currentStopSequence,
 *     prende il delay dello stop più vicino a quello corrente
 *
 * @param {string[]} tripIds
 * @returns {Object} { trip_id: { delay, status, vehicleStatus?, occupancy? } }
 */
async function getRealtimeDelays(tripIds) {
  if (!tripIds.length || !URLS.tripUpdate) return {};

  const [tuFeed, vpFeed] = await Promise.all([
    fetchFeed('tripUpdate'),
    fetchFeed('vehiclePosition'),
  ]);

  const delays = {};
  const tripSet = new Set(tripIds);

  // Mappa tripId → currentStopSequence dal vehicle position feed
  // (usata per scegliere il delay più rilevante)
  const currentSeqByTrip = {};
  if (vpFeed) {
    for (const entity of vpFeed.entity) {
      if (!entity.vehicle) continue;
      const tid = entity.vehicle.trip?.tripId;
      if (!tid || !tripSet.has(tid)) continue;
      const seq = entity.vehicle.currentStopSequence;
      if (seq != null) currentSeqByTrip[tid] = seq;
    }
  }

  // Trip Updates → delay per ogni corsa richiesta
  if (tuFeed) {
    for (const entity of tuFeed.entity) {
      if (!entity.tripUpdate) continue;
      const tid = entity.tripUpdate.trip?.tripId;
      if (!tid || !tripSet.has(tid)) continue;

      const updates = entity.tripUpdate.stopTimeUpdate || [];
      if (!updates.length) continue;

      const currentSeq = currentSeqByTrip[tid];
      let bestDelay = null;

      if (currentSeq != null) {
        // Strategia 1: prende il delay dello stop con sequence >= currentSeq (prossimo stop)
        const next = updates.find(u => (u.stopSequence ?? 0) >= currentSeq);
        const candidate = next || updates[updates.length - 1];
        const d = candidate?.departure?.delay ?? candidate?.arrival?.delay;
        if (d != null) bestDelay = d;
      }

      if (bestDelay === null) {
        // Strategia 2: prende l'ultimo aggiornamento disponibile
        // (più vicino alla posizione attuale del veicolo rispetto al primo)
        for (let i = updates.length - 1; i >= 0; i--) {
          const d = updates[i].departure?.delay ?? updates[i].arrival?.delay;
          if (d != null) { bestDelay = d; break; }
        }
      }

      if (bestDelay !== null) {
        delays[tid] = {
          delay:    bestDelay,
          delayMin: Math.round(bestDelay / 60),
          status:   bestDelay > 60 ? 'delayed' : bestDelay < -60 ? 'early' : 'on_time',
        };
      }
    }
  }

  // Vehicle Positions → stato corrente del veicolo
  if (vpFeed) {
    for (const entity of vpFeed.entity) {
      if (!entity.vehicle) continue;
      const tid = entity.vehicle.trip?.tripId;
      if (!tid || !tripSet.has(tid)) continue;

      if (!delays[tid]) {
        // Veicolo presente nel feed VP ma senza trip update → on time
        delays[tid] = { delay: 0, delayMin: 0, status: 'on_time' };
      }

      const cs = entity.vehicle.currentStatus;
      // 0=INCOMING_AT, 1=STOPPED_AT, 2=IN_TRANSIT_TO
      delays[tid].vehicleStatus = cs === 1 ? 'stopped_at' : 'in_transit';
      delays[tid].occupancy = entity.vehicle.occupancyStatus;
    }
  }

  return delays;
}

/**
 * Controlla se il feed realtime è vivo e contiene dati.
 * Distingue tra:
 *   - 'disabled'   → URL non configurata
 *   - 'empty'      → feed raggiungibile ma 0 entity (nessun veicolo aggiornato)
 *   - 'active'     → feed con dati
 *   - 'unreachable'→ feed non raggiungibile
 */
async function checkRealtimeHealth() {
  if (!URLS.tripUpdate) return { status: 'disabled' };

  const feed = await fetchFeed('tripUpdate');
  if (!feed) return { status: 'unreachable' };

  const entityCount = feed.entity?.length ?? 0;
  const timestamp = feed.header?.timestamp
    ? new Date(Number(feed.header.timestamp) * 1000).toISOString()
    : null;

  return {
    status: entityCount > 0 ? 'active' : 'empty',
    entityCount,
    timestamp,
  };
}

/**
 * Alert di servizio attivi (interruzioni, deviazioni, avvisi).
 * GTT ha tipicamente decine di alert attivi.
 */
async function getServiceAlerts() {
  if (!URLS.alerts) {
    return {
      available: false,
      message: 'Feed alert non configurato.',
      alerts: [],
    };
  }

  const feed = await fetchFeed('alerts');

  if (!feed) {
    return {
      available: false,
      message: 'Feed alert non raggiungibile.',
      alerts: [],
    };
  }

  const CAUSE_LABELS = {
    1: 'Causa sconosciuta', 2: 'Guasto tecnico', 3: 'Incidente',
    4: 'Manifestazione', 5: 'Sciopero', 6: 'Condizioni meteorologiche',
    7: 'Manutenzione', 8: 'Costruzione', 9: 'Operazioni di polizia',
    10: 'Urgenza medica', 11: 'Causa non specificata',
  };

  const EFFECT_LABELS = {
    1: 'Nessun servizio', 2: 'Servizio ridotto', 3: 'Perturbazioni',
    4: 'Fermate aggiuntive', 5: 'Fermate saltate', 6: 'Ritardi',
    7: 'Deviazione', 8: 'Fermata trasferita', 9: 'Nessun effetto',
    10: 'Avviso agli utenti', 11: 'Effetto non specificato',
  };

  const alerts = feed.entity
    .filter(e => e.alert)
    .map(e => {
      const a = e.alert;
      const getText = (t) => t?.translation?.[0]?.text || '';

      return {
        id: e.id,
        cause: CAUSE_LABELS[a.cause] || 'Non specificata',
        effect: EFFECT_LABELS[a.effect] || 'Non specificato',
        header: getText(a.headerText),
        description: getText(a.descriptionText),
        url: getText(a.url),
        activePeriods: (a.activePeriod || []).map(p => ({
          start: p.start ? new Date(Number(p.start) * 1000).toISOString() : null,
          end:   p.end   ? new Date(Number(p.end)   * 1000).toISOString() : null,
        })),
        affectedRoutes: (a.informedEntity || [])
          .filter(ie => ie.routeId)
          .map(ie => ie.routeId),
        affectedStops: (a.informedEntity || [])
          .filter(ie => ie.stopId)
          .map(ie => ie.stopId),
      };
    })
    // Filtra alert senza testo
    .filter(a => a.header || a.description);

  return {
    available: true,
    count: alerts.length,
    alerts,
    feedTimestamp: feed.header?.timestamp
      ? new Date(Number(feed.header.timestamp) * 1000).toISOString()
      : null,
  };
}

/**
 * Posizione realtime di un veicolo per un trip_id specifico.
 * Usata da journey.js per il dettaglio corsa.
 *
 * @param {string} tripId
 * @returns {Object|null} Dati posizione veicolo o { available: false }
 */
async function getVehiclePosition(tripId) {
  if (!URLS.vehiclePosition) return { available: false };

  const feed = await fetchFeed('vehiclePosition');
  if (!feed) return { available: false };

  const STATUS_LABELS = {
    0: 'In avvicinamento',
    1: 'Fermo alla fermata',
    2: 'In transito',
  };

  const OCCUPANCY_LABELS = {
    0: 'Vuoto', 1: 'Molti posti liberi', 2: 'Posti liberi',
    3: 'In piedi', 4: 'Solo in piedi', 5: 'Pieno', 6: 'Non accetta passeggeri',
  };

  for (const entity of feed.entity) {
    if (!entity.vehicle) continue;
    const tid = entity.vehicle.trip?.tripId;
    if (tid !== tripId) continue;

    const v = entity.vehicle;
    if (!v.position?.latitude) return { available: false };

    return {
      available: true,
      lat: v.position.latitude,
      lon: v.position.longitude,
      bearing: v.position.bearing ?? null,
      speed: v.position.speed != null ? Math.round(v.position.speed * 3.6) : null,
      currentStopId: v.stopId || null,
      currentStatus: STATUS_LABELS[v.currentStatus] || 'In transito',
      occupancy: OCCUPANCY_LABELS[v.occupancyStatus] || null,
      vehicleLabel: v.vehicle?.label || null,
      timestamp: v.timestamp
        ? new Date(Number(v.timestamp) * 1000).toISOString()
        : null,
    };
  }

  return { available: false };
}

function isRealtimeEnabled() {
  return !!URLS.tripUpdate;
}

module.exports = {
  getRealtimeDelays,
  getServiceAlerts,
  getVehiclePosition,
  isRealtimeEnabled,
  checkRealtimeHealth,
};
