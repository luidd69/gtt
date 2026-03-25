/**
 * routes/arrivals.js
 * Prossimi arrivi per fermata.
 *
 * Logica:
 * 1. Trova i service_id attivi oggi (calendar + calendar_dates)
 * 2. Trova i trip_id che passano per la fermata nei prossimi N minuti
 * 3. Tenta di arricchire con GTFS-RT se disponibile
 * 4. Restituisce orari con indicazione chiara: "scheduled" o "realtime"
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { withCache } = require('../utils/cache');
const {
  gtfsTimeToSeconds,
  nowInSeconds,
  secondsToHHMM,
} = require('../utils/time');
const { getRealtimeDelays, isRealtimeEnabled } = require('../gtfs/realtime');
const { getActiveServiceIds } = require('../utils/serviceCalendar');

const MAX_ARRIVALS = 10;
const LOOKAHEAD_MINUTES = 90; // mostra arrivi entro 90 minuti

/**
 * GET /api/arrivals/:stopId
 * Prossimi passaggi per una fermata.
 * Query params:
 *   - limit: numero massimo risultati (default 10)
 *   - lookahead: minuti di anticipo (default 90)
 */
router.get('/:stopId', async (req, res) => {
  const { stopId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || MAX_ARRIVALS, 20);
  const lookahead = Math.min(parseInt(req.query.lookahead) || LOOKAHEAD_MINUTES, 180);

  // Cache breve per arrivi (30s default)
  const cacheKey = `arrivals:${stopId}:${limit}:${lookahead}`;

  try {
    const result = await withCache('arrivals', cacheKey, async () => {
      const db = getDb();

      const activeServiceIds = getActiveServiceIds(db);
      if (!activeServiceIds.length) {
        return {
          stopId,
          arrivals: [],
          realtimeAvailable: false,
          message: 'Nessun servizio attivo per oggi',
        };
      }

      const nowSec = nowInSeconds();
      const maxSec = nowSec + lookahead * 60;

      // Placeholder SQLite per array di service_id
      const placeholders = activeServiceIds.map(() => '?').join(',');

      // Query principale: orari prossimi passaggi.
      // Usa calcolo in secondi nel SQL per gestire correttamente:
      //  - orari che attraversano la mezzanotte (es. 00:05 vs 23:50)
      //  - orari GTFS > 24:00 (corse notturne prolungate)
      // Formula: HH*3600 + MM*60 + SS tramite SUBSTR
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
      `).all(
        stopId,
        ...activeServiceIds,
        nowSec,
        maxSec,
        limit * 3
      );

      if (!rows.length) {
        return {
          stopId,
          arrivals: [],
          realtimeAvailable: isRealtimeEnabled(),
          message: `Nessun passaggio previsto nei prossimi ${lookahead} minuti`,
        };
      }

      // Arricchimento GTFS-RT (se disponibile)
      const tripIds = [...new Set(rows.map(r => r.trip_id))];
      const realtimeDelays = isRealtimeEnabled()
        ? await getRealtimeDelays(tripIds)
        : {};

      // Costruisce risposta finale
      const arrivals = rows.slice(0, limit).map(row => {
        const scheduledSeconds = gtfsTimeToSeconds(row.departure_time);
        const rtInfo = realtimeDelays[row.trip_id];

        let realtimeSeconds = null;
        let delayMinutes = null;
        let dataType = 'scheduled'; // 'scheduled' | 'realtime'

        if (rtInfo) {
          dataType = 'realtime';
          realtimeSeconds = scheduledSeconds + rtInfo.delay;
          delayMinutes = Math.round(rtInfo.delay / 60);
        }

        const displaySeconds = realtimeSeconds ?? scheduledSeconds;
        const waitMinutes = Math.round((displaySeconds - nowSec) / 60);

        return {
          tripId: row.trip_id,
          routeId: row.route_id,
          routeShortName: row.route_short_name,
          routeLongName: row.route_long_name,
          routeType: row.route_type,
          routeColor: row.route_color ? `#${row.route_color}` : null,
          routeTextColor: row.route_text_color ? `#${row.route_text_color}` : null,
          headsign: row.trip_headsign,
          directionId: row.direction_id,
          scheduledTime: row.departure_time.substring(0, 5), // HH:MM
          realtimeTime: realtimeSeconds
            ? secondsToHHMM(realtimeSeconds)
            : null,
          waitMinutes,
          delayMinutes, // null se no realtime
          dataType,     // 'scheduled' o 'realtime'
          status: rtInfo?.status ?? 'unknown',
        };
      });

      return {
        stopId,
        arrivals,
        realtimeAvailable: isRealtimeEnabled(),
        // Informa il frontend se il realtime è abilitato ma non disponibile
        realtimeNote: !isRealtimeEnabled()
          ? 'Il servizio di aggiornamenti in tempo reale non è disponibile per GTT. ' +
            'Gli orari mostrati sono quelli ufficiali programmati.'
          : null,
        generatedAt: new Date().toISOString(),
      };
    });

    res.json(result);
  } catch (err) {
    console.error('[arrivals/:stopId]', err);
    res.status(500).json({ error: 'Errore nel calcolo degli arrivi' });
  }
});

module.exports = router;
