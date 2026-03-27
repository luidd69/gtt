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
    const otpStopId = `gtt:${stopId}`;

    const response = await axios.post(OTP_URL, {
      query: GRAPHQL_QUERY,
      variables: {
        stopId:    otpStopId,
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
    // OTP restituisce [null] se la fermata non esiste nel suo GTFS → trattalo come "non trovata"
    if (!stops?.length || stops[0] === null) {
      stopCache.set(cacheKey, { data: null, fetchedAt: Date.now() });
      return null;
    }

    const rawArrivals = stops[0]?.stoptimesWithoutPatterns || [];
    const nowSec = Date.now() / 1000;

    // Data di oggi in Italia (YYYY-MM-DD) per rilevare corse del giorno dopo
    const todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());

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

        // Corsa del giorno successivo: confronto data del serviceDay con oggi
        const serviceDayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' })
          .format(new Date(serviceDay * 1000));
        const isNextDay = serviceDayStr > todayDateStr;
        const nextDayDate = isNextDay
          ? new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit' })
              .format(new Date(serviceDay * 1000))
          : null;

        return {
          tripId,
          routeId,
          routeShortName:  route.shortName || '?',
          routeLongName:   route.longName  || null,
          routeType:       OTP_MODE_TO_ROUTE_TYPE[route.mode] ?? 3,
          routeColor:      route.color    ? `#${route.color}`    : null,
          routeTextColor:  route.textColor ? `#${route.textColor}` : null,
          headsign:        t.headsign || '',
          directionId:     null,
          scheduledTime:   formatTime(scheduledDepSec),
          realtimeTime:    isRealtime ? formatTime(realtimeDepSec) : null,
          waitMinutes,
          delayMinutes:    isRealtime ? delayMinutes : null,
          dataType:        isRealtime ? 'realtime' : 'scheduled',
          status,
          canceled:        isCanceled,
          nextDay:         isNextDay,
          nextDayDate,
        };
      })
      // Filtra passaggi già partiti — mostra solo presenti e futuri
      .filter(a => a.waitMinutes >= 0)
      // Corse giorno dopo: solo fino a mezzogiorno (12:00)
      .filter(a => {
        if (!a.nextDay) return true;
        const [h, m] = a.scheduledTime.split(':').map(Number);
        return h * 60 + m <= 12 * 60;
      })
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
      query: '{ stops(ids:["gtt:39"]) { id } }',
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

// ─── Journey Plan ─────────────────────────────────────────────────────────────

const PLAN_QUERY = `
query OtpPlan(
  $from: InputCoordinates!,
  $to:   InputCoordinates!,
  $numItineraries: Int!,
  $date: String!,
  $time: String!,
  $arriveBy: Boolean!
) {
  plan(
    from: $from
    to:   $to
    numItineraries: $numItineraries
    date:      $date
    time:      $time
    arriveBy:  $arriveBy
    transportModes: [
      {mode: BUS}, {mode: TRAM}, {mode: SUBWAY}, {mode: WALK}
    ]
  ) {
    itineraries {
      duration
      startTime
      endTime
      waitingTime
      walkTime
      walkDistance
      legs {
        mode
        startTime
        endTime
        duration
        realTime
        distance
        intermediateStops { name gtfsId lat lon }
        from { name lat lon stop { gtfsId name } }
        to   { name lat lon stop { gtfsId name } }
        route { gtfsId shortName longName color textColor mode }
        trip  { gtfsId tripHeadsign }
      }
    }
  }
}
`;

/**
 * Rimuove prefissi OTP (gtt:, 3:, 4:, ecc.) dagli ID per compatibilità col DB GTFS.
 */
function stripOtpPrefix(id) {
  if (!id) return null;
  return id.replace(/^\w+:/, '');
}

/**
 * Converte ms Unix → "HH:MM" nel fuso orario italiano (CET/CEST).
 */
function msToHHMM(ms) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(Number(ms)));
}

/**
 * Pianifica un itinerario con OTP (con supporto cambi).
 *
 * @param {number} fromLat
 * @param {number} fromLon
 * @param {number} toLat
 * @param {number} toLon
 * @param {object} options  { numItineraries=5, date, time, arriveBy=false }
 * @returns {Array|null}    array di itinerari normalizzati, null se OTP non raggiungibile
 */
async function getOtpPlan(fromLat, fromLon, toLat, toLon, options = {}) {
  const { numItineraries = 5, arriveBy = false } = options;

  const now  = new Date();
  const italyFmt = (opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', ...opts }).format(now);
  const date = options.date || (() => {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const v = Object.fromEntries(p.map(x => [x.type, x.value]));
    return `${v.year}-${v.month}-${v.day}`;
  })();
  const time = options.time || italyFmt({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/,\s*/, '');

  try {
    const response = await axios.post(OTP_URL, {
      query: PLAN_QUERY,
      variables: {
        from: { lat: fromLat, lon: fromLon },
        to:   { lat: toLat,   lon: toLon   },
        numItineraries,
        date,
        time,
        arriveBy,
      },
    }, {
      timeout: OTP_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'Accept':        'application/json',
      },
    });

    const itineraries = response.data?.data?.plan?.itineraries;
    if (!itineraries?.length) return [];

    return itineraries.map(itin => {
      const legs = itin.legs.map(leg => {
        const isWalk = leg.mode === 'WALK';
        const r      = leg.route;
        return {
          mode:        leg.mode,
          startTime:   msToHHMM(leg.startTime),
          endTime:     msToHHMM(leg.endTime),
          durationMin: Math.round((leg.duration || 0) / 60),
          realTime:    leg.realTime || false,
          distanceM:   Math.round(leg.distance || 0),
          from: {
            name:   leg.from?.stop?.name || leg.from?.name || '',
            stopId: stripOtpPrefix(leg.from?.stop?.gtfsId),
            lat:    leg.from?.lat ?? null,
            lon:    leg.from?.lon ?? null,
          },
          to: {
            name:   leg.to?.stop?.name || leg.to?.name || '',
            stopId: stripOtpPrefix(leg.to?.stop?.gtfsId),
            lat:    leg.to?.lat ?? null,
            lon:    leg.to?.lon ?? null,
          },
          route: (isWalk || !r) ? null : {
            shortName: r.shortName || '',
            longName:  r.longName  || null,
            color:     r.color     ? `#${r.color}`     : null,
            textColor: r.textColor ? `#${r.textColor}` : null,
            type:      OTP_MODE_TO_ROUTE_TYPE[r.mode] ?? 3,
          },
          headsign:   leg.trip?.tripHeadsign || null,
          stopsCount: (leg.intermediateStops?.length ?? 0) + 1,
          intermediateStops: leg.intermediateStops?.map(s => ({
            name:   s.name,
            stopId: stripOtpPrefix(s.gtfsId),
            lat:    s.lat ?? null,
            lon:    s.lon ?? null,
          })) ?? [],
          tripId: stripOtpPrefix(leg.trip?.gtfsId),
        };
      });

      const transitLegs = legs.filter(l => l.mode !== 'WALK');

      return {
        departureTime: msToHHMM(itin.startTime),
        arrivalTime:   msToHHMM(itin.endTime),
        durationMin:   Math.round((itin.duration   || 0) / 60),
        waitingMin:    Math.round((itin.waitingTime || 0) / 60),
        walkMin:       Math.round((itin.walkTime    || 0) / 60),
        walkDistanceM: Math.round(itin.walkDistance || 0),
        transfers:     Math.max(0, transitLegs.length - 1),
        legs,
        transitLegs,
      };
    });

  } catch (err) {
    console.warn('[OTP] Errore getOtpPlan:', err.message);
    return null;
  }
}

module.exports = { getOtpArrivals, getOtpPlan, checkOtpHealth };
