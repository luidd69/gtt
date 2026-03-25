/**
 * routes/trips.js
 * Dettaglio corsa: posizione stimata in tempo reale tramite OTP.
 *
 * Strategia:
 *  1. Il feed VP GTT è sempre vuoto (GTT non pubblica posizioni GPS pubbliche)
 *  2. Usiamo OTP stoptimesForDate: serviceDay + realtimeDeparture = timestamp assoluto
 *  3. Interpoliamo lat/lon tra la fermata precedente e quella successiva
 *     in base all'orario attuale → "posizione stimata"
 */

const express = require('express');
const router  = express.Router();
const axios   = require('axios');

const OTP_URL       = 'https://plan.muoversiatorino.it/otp/routers/mato/index/graphql';
const OTP_TIMEOUT   = 8_000;

// Cache: tripId+date → { data, fetchedAt }
const tripCache = new Map();
const CACHE_TTL = 20_000; // 20s

const STOPTIME_QUERY = `
query TripLive($tripId: String!, $date: String!) {
  trip(id: $tripId) {
    gtfsId
    route {
      shortName
      longName
      mode
      color
      textColor
    }
    stoptimesForDate(serviceDate: $date) {
      stop { gtfsId name lat lon }
      scheduledDeparture
      realtimeDeparture
      serviceDay
      realtime
      realtimeState
    }
  }
}
`;

const OTP_MODE_TO_ROUTE_TYPE = {
  BUS: 3, TRAM: 0, SUBWAY: 1, RAIL: 2, FERRY: 4,
};

/**
 * Interpola linearmente lat/lon tra due stop in base al progresso (0-1).
 */
function interpolate(from, to, t) {
  return {
    lat: from.lat + t * (to.lat - from.lat),
    lon: from.lon + t * (to.lon - from.lon),
  };
}

/**
 * Calcola la data odierna in formato YYYYMMDD nel fuso Europe/Rome.
 */
function todayRome() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }).replace(/-/g, '');
}

/**
 * GET /api/trips/:tripId/live
 * Posizione stimata di una corsa tramite interpolazione OTP.
 *
 * Response:
 *   { found, tripId, position: { lat, lon, bearing }, progress,
 *     currentStop, nextStop, route, stops[], isRealtime, estimatedAt }
 */
router.get('/:tripId/live', async (req, res) => {
  const { tripId } = req.params;
  const date       = todayRome();
  const cacheKey   = `${tripId}:${date}`;
  const now        = Date.now();

  try {
    // ── Cache ──────────────────────────────────────────────────────
    let cached = tripCache.get(cacheKey);
    if (!cached || now - cached.fetchedAt > CACHE_TTL) {
      const resp = await axios.post(OTP_URL, {
        query: STOPTIME_QUERY,
        variables: { tripId: `gtt:${tripId}`, date },
      }, {
        timeout: OTP_TIMEOUT,
        headers: { 'Content-Type': 'application/json' },
      });

      const trip = resp.data?.data?.trip;
      if (!trip || !trip.stoptimesForDate?.length) {
        // Prova il giorno precedente (corse notturne)
        const yesterday = new Date(Date.now() - 86400_000)
          .toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }).replace(/-/g, '');

        const resp2 = await axios.post(OTP_URL, {
          query: STOPTIME_QUERY,
          variables: { tripId: `gtt:${tripId}`, date: yesterday },
        }, { timeout: OTP_TIMEOUT, headers: { 'Content-Type': 'application/json' } });

        const trip2 = resp2.data?.data?.trip;
        cached = { data: trip2 || null, fetchedAt: now };
      } else {
        cached = { data: trip, fetchedAt: now };
      }
      tripCache.set(cacheKey, cached);
    }

    const trip = cached.data;
    if (!trip || !trip.stoptimesForDate?.length) {
      return res.json({ found: false, tripId, reason: 'Corsa non trovata per oggi' });
    }

    const route = trip.route || {};
    const stoptimes = trip.stoptimesForDate;
    const nowSec = now / 1000;

    // ── Calcolo posizione stimata ───────────────────────────────────
    // Converti ogni stoptime in timestamp assoluto
    const stops = stoptimes.map(st => ({
      stopId:   st.stop?.gtfsId?.replace(/^gtt:/, '') || '',
      name:     st.stop?.name || '',
      lat:      st.stop?.lat,
      lon:      st.stop?.lon,
      absSec:   Number(st.serviceDay) + Number(st.realtimeDeparture || st.scheduledDeparture),
      isRealtime: st.realtime === true,
    })).filter(s => s.lat && s.lon);

    if (!stops.length) {
      return res.json({ found: false, tripId, reason: 'Nessuna fermata con coordinate' });
    }

    const firstDep = stops[0].absSec;
    const lastArr  = stops[stops.length - 1].absSec;

    // Corsa non ancora iniziata
    if (nowSec < firstDep) {
      return res.json({
        found: true,
        tripId,
        status: 'not_started',
        startsIn: Math.round((firstDep - nowSec) / 60),
        firstStop: stops[0],
        lastStop:  stops[stops.length - 1],
        route: buildRoute(route),
        stops: stops.map(s => ({ name: s.name, lat: s.lat, lon: s.lon })),
      });
    }

    // Corsa terminata
    if (nowSec > lastArr + 300) {
      return res.json({
        found: true,
        tripId,
        status: 'completed',
        lastStop: stops[stops.length - 1],
        route: buildRoute(route),
        stops: stops.map(s => ({ name: s.name, lat: s.lat, lon: s.lon })),
      });
    }

    // ── In servizio: trova segmento corrente ────────────────────────
    let prevIdx = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      if (stops[i].absSec <= nowSec) prevIdx = i;
      else break;
    }

    const prev = stops[prevIdx];
    const next = stops[Math.min(prevIdx + 1, stops.length - 1)];

    let progress = 0;
    if (next !== prev && next.absSec > prev.absSec) {
      progress = Math.min(1, Math.max(0, (nowSec - prev.absSec) / (next.absSec - prev.absSec)));
    }

    const pos = interpolate(prev, next, progress);

    // Bearing approssimativo (gradi)
    const dLat = next.lat - prev.lat;
    const dLon = next.lon - prev.lon;
    const bearing = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;

    const hasAnyRealtime = stops.some(s => s.isRealtime);

    return res.json({
      found:       true,
      tripId,
      status:      'in_progress',
      position:    { lat: pos.lat, lon: pos.lon, bearing: Math.round(bearing) },
      progress:    Math.round(progress * 100),
      currentStop: { name: prev.name, lat: prev.lat, lon: prev.lon },
      nextStop:    { name: next.name, lat: next.lat, lon: next.lon },
      route:       buildRoute(route),
      stops:       stops.map(s => ({ name: s.name, lat: s.lat, lon: s.lon, passed: s.absSec <= nowSec })),
      isRealtime:  hasAnyRealtime,
      estimatedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[trips/live]', err.message);
    res.status(500).json({ found: false, tripId, error: 'Errore nel recupero posizione' });
  }
});

function buildRoute(route) {
  return {
    shortName:   route.shortName || '?',
    longName:    route.longName  || null,
    routeType:   OTP_MODE_TO_ROUTE_TYPE[route.mode] ?? 3,
    color:       route.color    ? `#${route.color}`    : null,
    textColor:   route.textColor ? `#${route.textColor}` : null,
  };
}

module.exports = router;
