/**
 * otp.js
 * Client per l'endpoint OpenTripPlanner (OTP) di Muoversi a Torino.
 *
 * Endpoint: https://plan.muoversiatorino.it/otp/routers/mato/index/graphql
 * Gestito da 5T Srl per il Comune di Torino.
 * Dati: GTFS GTT + aggiornamenti realtime (stessa infrastruttura dell'app Muoversi).
 *
 * Vantaggi rispetto al feed GTFS-RT diretto:
 *   - Il feed GTFS-RT di GTT restituisce 0 entity quando tutti i veicoli sono in orario
 *   - OTP espone sempre tutti i passaggi con stato RT corretto (SCHEDULED / UPDATED / CANCELED)
 *   - Trip ID compatibili con il DB GTFS locale (strip del prefisso "gtt:")
 *   - serviceDay permette calcolo corretto dell'attesa anche oltre mezzanotte
 */

const axios = require('axios');

const OTP_URL = 'https://plan.muoversiatorino.it/otp/routers/mato/index/graphql';
const OTP_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 25_000; // 25 secondi — leggermente sotto il refresh del frontend (30s)

// Cache in memoria per fermata: { stopId -> { data, fetchedAt } }
const stopCache = new Map();

// Mappa tipo OTP → GTFS route_type
const OTP_MODE_TO_ROUTE_TYPE = {
  BUS:        3,
  TRAM:       0,
  SUBWAY:     1,
  RAIL:       2,
  FERRY:      4,
  CABLE_CAR:  5,
  GONDOLA:    6,
  FUNICULAR:  7,
};

const GRAPHQL_QUERY = `
query OtpArrivals($stopId: String!, $count: Int!, $timeRange: Int!) {
  stops(ids: [$stopId]) {
    id
    name
    stoptimesWithoutPatterns(
      numberOfDepartures: $count
      timeRange: $timeRange
      omitCanceled: false
    ) {
      serviceDay
      scheduledDeparture
      realtimeDeparture
      realtime
      realtimeState
      headsign
      pickupType
      trip {
        gtfsId
        route {
          gtfsId
          shortName
          longName
          type
          mode
          color
          textColor
        }
      }
    }
  }
}
`;

/**
 * Recupera i prossimi passaggi per una fermata tramite OTP.
 *
 * @param {string} stopId    - stop_id GTT (es. "87"), senza prefisso "gtt:"
 * @param {number} count     - numero massimo passaggi (default 15)
 * @param {number} timeRange - finestra temporale in secondi (default 5400 = 90 min)
 * @returns {Array|null}     - array di passaggi arricchiti o null se OTP non raggiungibile
 */
async function getOtpArrivals(stopId, count = 15, timeRange = 5400) {
  const cacheKey = `${stopId}:${count}:${timeRange}`;
  const cached = stopCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const response = await axios.post(OTP_URL, {
      query: GRAPHQL_QUERY,
      variables: {
        stopId:    `gtt:${stopId}`,
        count,
        timeRange,
      },
    }, {
      timeout: OTP_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'Accept':        'application/json',
      },
    });

    const stops = response.data?.data?.stops;
    if (!stops?.length) {
      stopCache.set(cacheKey, { data: null, fetchedAt: Date.now() });
      return null;
    }

    const rawArrivals = stops[0]?.stoptimesWithoutPatterns || [];
    const nowSec = Date.now() / 1000;

    const arrivals = rawArrivals
      .filter(t => t.pickupType !== 1) // escludi fermate "no pickup" (solo discesa)
      .filter(t => t.realtimeState !== 'CANCELLED' || true) // teniamo le cancellate, le marcheremo
      .map(t => {
        const route    = t.trip?.route || {};
        const tripId   = t.trip?.gtfsId?.replace(/^gtt:/, '') || null;
        const routeId  = route.gtfsId?.replace(/^gtt:/, '')  || null;

        const serviceDay        = Number(t.serviceDay || 0);
        const scheduledDepSec   = Number(t.scheduledDeparture || 0);
        const realtimeDepSec    = Number(t.realtimeDeparture  || scheduledDepSec);

        // Orario assoluto: serviceDay (Unix) + secondi dalla mezzanotte
        const absScheduled = serviceDay + scheduledDepSec;
        const absRealtime  = serviceDay + realtimeDepSec;

        // Delay in secondi (positivo = in ritardo, negativo = anticipo)
        const delaySec     = realtimeDepSec - scheduledDepSec;
        const delayMinutes = Math.round(delaySec / 60);

        // Attesa in minuti
        const waitMinutes  = Math.round((absRealtime - nowSec) / 60);

        // Formato HH:MM
        const formatTime = (secs) => {
          const h = Math.floor((secs % 86400) / 3600);
          const m = Math.floor((secs % 3600) / 60);
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };

        const isRealtime = t.realtime === true && t.realtimeState === 'UPDATED';
        const isCanceled = t.realtimeState === 'CANCELED';

        // Stato normalizzato
        let status = 'unknown';
        if (isCanceled)          status = 'canceled';
        else if (!isRealtime)    status = 'scheduled';
        else if (delaySec > 60)  status = 'delayed';
        else if (delaySec < -60) status = 'early';
        else                     status = 'on_time';

        return {
          tripId,
          routeId,
          routeShortName:  route.shortName || '?',
          routeLongName:   route.longName  || null,
          routeType:       OTP_MODE_TO_ROUTE_TYPE[route.mode] ?? 3,
          routeColor:      route.color    ? `#${route.color}`    : null,
          routeTextColor:  route.textColor ? `#${route.textColor}` : null,
          headsign:        t.headsign || '',
          directionId:     null, // non esposto da OTP in questo query
          scheduledTime:   formatTime(scheduledDepSec),
          realtimeTime:    isRealtime ? formatTime(realtimeDepSec) : null,
          waitMinutes,
          delayMinutes:    isRealtime ? delayMinutes : null,
          dataType:        isRealtime ? 'realtime' : 'scheduled',
          status,
          canceled:        isCanceled,
        };
      })
      // Filtra passaggi già partiti — mostra solo presenti e futuri
      .filter(a => a.waitMinutes >= 0)
      .slice(0, count);

    stopCache.set(cacheKey, { data: arrivals, fetchedAt: Date.now() });
    return arrivals;

  } catch (err) {
    console.warn('[OTP] Errore query fermata', stopId, ':', err.message);
    // Restituisce cache scaduta se disponibile
    const stale = stopCache.get(cacheKey);
    return stale ? stale.data : null;
  }
}

/**
 * Verifica che l'endpoint OTP sia raggiungibile.
 * @returns {{ available: boolean, latencyMs?: number }}
 */
async function checkOtpHealth() {
  const start = Date.now();
  try {
    const r = await axios.post(OTP_URL, {
      query: '{ stops(ids:["gtt:1"]) { id } }',
    }, {
      timeout: 5_000,
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = !!r.data?.data;
    return { available: ok, latencyMs: Date.now() - start };
  } catch (e) {
    return { available: false, error: e.message };
  }
}

module.exports = { getOtpArrivals, checkOtpHealth };
