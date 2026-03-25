/**
 * routes/arrivals.js
 * Prossimi arrivi per fermata.
 *
 * Strategia sorgenti (in ordine di priorità):
 *
 *  1. OTP GraphQL (plan.muoversiatorino.it) — sorgente PRIMARIA
 *     - Dati realtime affidabili anche quando i bus sono in orario
 *     - Trip ID compatibili con il nostro DB GTFS
 *     - realtimeState: SCHEDULED / UPDATED / CANCELED
 *
 *  2. GTFS statico + GTFS-RT feed GTT — FALLBACK
 *     - Usato se OTP non è raggiungibile
 *     - Il feed RT GTT pubblica dati solo per veicoli in ritardo
 *
 * Il frontend riceve sempre la stessa struttura, con `realtimeStatus`
 * che indica la sorgente effettivamente usata e lo stato dei dati.
 */

const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/database');
const { withCache } = require('../utils/cache');
const {
  gtfsTimeToSeconds,
  nowInSeconds,
  secondsToHHMM,
} = require('../utils/time');
const { getRealtimeDelays, isRealtimeEnabled, checkRealtimeHealth } = require('../gtfs/realtime');
const { getOtpArrivals } = require('../gtfs/otp');
const { getActiveServiceIds } = require('../utils/serviceCalendar');

const MAX_ARRIVALS    = 10;
const LOOKAHEAD_MINS  = 90;

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Fallback: legge i passaggi dal DB GTFS statico e li arricchisce con
 * il feed GTFS-RT ufficiale GTT (se configurato).
 */
async function getStaticArrivals(stopId, limit, lookahead) {
  const db = getDb();
  const activeServiceIds = getActiveServiceIds(db);

  if (!activeServiceIds.length) {
    return {
      arrivals: [],
      realtimeStatus: 'disabled',
      message: 'Nessun servizio attivo per oggi',
    };
  }

  const nowSec  = nowInSeconds();
  const maxSec  = nowSec + lookahead * 60;
  const placeholders = activeServiceIds.map(() => '?').join(',');

  const rows = db.prepare(`
    SELECT
      st.trip_id,
      st.departure_time,
      st.arrival_time,
      st.stop_sequence,
      t.trip_headsign,
      t.direction_id,
      r.route_id,
      r.route_short_name,
      r.route_long_name,
      r.route_type,
      r.route_color,
      r.route_text_color,
      (
        CAST(SUBSTR(st.departure_time, 1, 2) AS INTEGER) * 3600 +
        CAST(SUBSTR(st.departure_time, 4, 2) AS INTEGER) * 60 +
        CAST(SUBSTR(st.departure_time, 7, 2) AS INTEGER)
      ) AS dep_seconds
    FROM stop_times st
    JOIN trips t ON t.trip_id = st.trip_id
    JOIN routes r ON r.route_id = t.route_id
    WHERE st.stop_id = ?
      AND t.service_id IN (${placeholders})
      AND (
        CAST(SUBSTR(st.departure_time, 1, 2) AS INTEGER) * 3600 +
        CAST(SUBSTR(st.departure_time, 4, 2) AS INTEGER) * 60 +
        CAST(SUBSTR(st.departure_time, 7, 2) AS INTEGER)
      ) BETWEEN ? AND ?
    ORDER BY dep_seconds
    LIMIT ?
  `).all(stopId, ...activeServiceIds, nowSec, maxSec, limit * 3);

  if (!rows.length) {
    return {
      arrivals:       [],
      realtimeStatus: isRealtimeEnabled() ? 'empty' : 'disabled',
      message:        `Nessun passaggio previsto nei prossimi ${lookahead} minuti`,
    };
  }

  // Arricchimento GTFS-RT
  const tripIds       = [...new Set(rows.map(r => r.trip_id))];
  let realtimeDelays  = {};
  let realtimeStatus  = 'disabled';

  if (isRealtimeEnabled()) {
    realtimeDelays = await getRealtimeDelays(tripIds);
    const hasAny   = Object.keys(realtimeDelays).length > 0;
    realtimeStatus = hasAny ? 'active' : (await checkRealtimeHealth()).status;
  }

  const arrivals = rows.slice(0, limit).map(row => {
    const scheduledSec = gtfsTimeToSeconds(row.departure_time);
    const rtInfo       = realtimeDelays[row.trip_id];

    let realtimeSec  = null;
    let delayMinutes = null;
    let dataType     = 'scheduled';

    if (rtInfo) {
      dataType     = 'realtime';
      realtimeSec  = scheduledSec + rtInfo.delay;
      delayMinutes = Math.round(rtInfo.delay / 60);
    }

    const displaySec  = realtimeSec ?? scheduledSec;
    const waitMinutes = Math.round((displaySec - nowSec) / 60);

    return {
      tripId:         row.trip_id,
      routeId:        row.route_id,
      routeShortName: row.route_short_name,
      routeLongName:  row.route_long_name,
      routeType:      row.route_type,
      routeColor:     row.route_color     ? `#${row.route_color}`     : null,
      routeTextColor: row.route_text_color ? `#${row.route_text_color}` : null,
      headsign:       row.trip_headsign,
      directionId:    row.direction_id,
      scheduledTime:  row.departure_time.substring(0, 5),
      realtimeTime:   realtimeSec ? secondsToHHMM(realtimeSec) : null,
      waitMinutes,
      delayMinutes,
      dataType,
      status:         rtInfo?.status ?? 'unknown',
      canceled:       false,
    };
  }).filter(a => a.waitMinutes >= 0); // solo presenti e futuri

  return { arrivals, realtimeStatus };
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * GET /api/arrivals/:stopId
 * Prossimi passaggi per una fermata.
 *
 * Query params:
 *   limit    - numero massimo risultati (default 10, max 20)
 *   lookahead - finestra temporale in minuti (default 90, max 180)
 */
router.get('/:stopId', async (req, res) => {
  const { stopId } = req.params;
  const limit     = Math.min(parseInt(req.query.limit)    || MAX_ARRIVALS,   20);
  const lookahead = Math.min(parseInt(req.query.lookahead) || LOOKAHEAD_MINS, 180);

  const cacheKey = `arrivals:${stopId}:${limit}:${lookahead}`;

  try {
    const result = await withCache('arrivals', cacheKey, async () => {
      const db = getDb();

      // OTP usa stop_code come identificatore (gtt:STOP_CODE),
      // il nostro DB e i nostri URL usano stop_id — traduci prima di chiamare OTP
      const stopRecord = db.prepare('SELECT stop_code FROM stops WHERE stop_id = ?').get(stopId);
      const otpStopCode = stopRecord?.stop_code || stopId;

      // ── Strategia 1: OTP GraphQL ───────────────────────────────────────────
      const otpArrivals = await getOtpArrivals(otpStopCode, limit, lookahead * 60);

      if (otpArrivals !== null) {
        // OTP raggiungibile — conta quanti hanno dati RT
        const rtCount = otpArrivals.filter(a => a.dataType === 'realtime').length;

        // Stato aggregato:
        //   active     → almeno 1 passaggio ha dati RT aggiornati
        //   on_time    → OTP disponibile ma tutti in orario (stato valido, non un errore)
        //   empty      → nessun passaggio trovato
        let realtimeStatus;
        if (!otpArrivals.length)   realtimeStatus = 'empty';
        else if (rtCount > 0)      realtimeStatus = 'active';
        else                       realtimeStatus = 'on_time'; // tutti SCHEDULED = in orario

        const realtimeNotes = {
          active:   null,
          on_time:  null, // non serve nota: è informazione positiva
          empty:    `Nessun passaggio previsto nei prossimi ${lookahead} minuti`,
        };

        return {
          stopId,
          arrivals:        otpArrivals,
          realtimeAvailable: realtimeStatus === 'active',
          realtimeStatus,
          realtimeNote:    realtimeNotes[realtimeStatus] ?? null,
          source:          'otp',
          generatedAt:     new Date().toISOString(),
        };
      }

      // ── Strategia 2: GTFS statico + GTFS-RT (fallback) ────────────────────
      console.warn(`[arrivals] OTP non raggiungibile per fermata ${stopId}, uso fallback GTFS`);

      const { arrivals, realtimeStatus, message } = await getStaticArrivals(stopId, limit, lookahead);

      const realtimeNotes = {
        disabled:    'Orari programmati ufficiali GTT.',
        unreachable: 'Feed realtime temporaneamente non raggiungibile. Orari programmati.',
        empty:       'Nessun aggiornamento attivo (veicoli in orario o servizio non avviato).',
        active:      null,
      };

      return {
        stopId,
        arrivals,
        realtimeAvailable: realtimeStatus === 'active',
        realtimeStatus,
        realtimeNote:  realtimeNotes[realtimeStatus] ?? null,
        source:        'gtfs-static',
        message,
        generatedAt:   new Date().toISOString(),
      };
    });

    res.json(result);
  } catch (err) {
    console.error('[arrivals/:stopId]', err);
    res.status(500).json({ error: 'Errore nel calcolo degli arrivi' });
  }
});

module.exports = router;
