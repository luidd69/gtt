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
 * @param {string[]} tripIds
 * @returns {Object} { trip_id: { delay, status } }
 */
async function getRealtimeDelays(tripIds) {
  if (!tripIds.length || !URLS.tripUpdate) return {};

  const [tuFeed, vpFeed] = await Promise.all([
    fetchFeed('tripUpdate'),
    fetchFeed('vehiclePosition'),
  ]);

  const delays = {};
  const tripSet = new Set(tripIds);

  // Trip Updates → ritardi per stop
  if (tuFeed) {
    for (const entity of tuFeed.entity) {
      if (!entity.tripUpdate) continue;
      const tid = entity.tripUpdate.trip?.tripId;
      if (!tid || !tripSet.has(tid)) continue;

      // Cerca il primo stopTimeUpdate con delay
      for (const stu of entity.tripUpdate.stopTimeUpdate || []) {
        const delay = stu.departure?.delay ?? stu.arrival?.delay;
        if (delay != null) {
          delays[tid] = {
            delay,               // secondi (positivo = in ritardo)
            delayMin: Math.round(delay / 60),
            status: delay > 60 ? 'delayed' : delay < -60 ? 'early' : 'on_time',
          };
          break;
        }
      }
    }
  }

  // Vehicle Positions → aggiunge stato corrente (in transito / fermo)
  if (vpFeed) {
    for (const entity of vpFeed.entity) {
      if (!entity.vehicle) continue;
      const tid = entity.vehicle.trip?.tripId;
      if (!tid || !tripSet.has(tid)) continue;

      if (!delays[tid]) {
        delays[tid] = { delay: 0, delayMin: 0, status: 'on_time' };
      }

      const cs = entity.vehicle.currentStatus;
      // 0=INCOMING, 1=STOPPED, 2=IN_TRANSIT
      delays[tid].vehicleStatus = cs === 1 ? 'stopped_at' : 'in_transit';
      delays[tid].occupancy = entity.vehicle.occupancyStatus;
    }
  }

  return delays;
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

function isRealtimeEnabled() {
  return !!URLS.tripUpdate;
}

module.exports = { getRealtimeDelays, getServiceAlerts, isRealtimeEnabled };
