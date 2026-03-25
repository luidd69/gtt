/**
 * routes/journey.js
 * Journey planner: cerca corse dirette tra due fermate e dettaglio corsa.
 *
 * Endpoints:
 *   GET /api/journey/search?from=<stopId>&to=<stopId>&lookahead=120
 *   GET /api/journey/trip/:tripId?fromStop=<stopId>&toStop=<stopId>
 *
 * Logica search:
 *   1. Verifica esistenza delle due fermate
 *   2. Trova service_id attivi oggi
 *   3. JOIN doppio su stop_times: st_from e st_to sulla stessa corsa,
 *      con st_to.stop_sequence > st_from.stop_sequence (ordine corretto)
 *   4. Filtra le partenze nei prossimi `lookahead` minuti
 *   5. Arricchisce con ritardi GTFS-RT se disponibili
 *
 * Logica trip detail:
 *   1. Recupera tutte le fermate della corsa in ordine
 *   2. Calcola status di ogni fermata (passed/current/upcoming)
 *   3. Arricchisce con posizione veicolo da GTFS-RT
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { withCache } = require('../utils/cache');
const { nowInSeconds, secondsToHHMM } = require('../utils/time');
const {
  getRealtimeDelays,
  getVehiclePosition,
  isRealtimeEnabled,
} = require('../gtfs/realtime');
const { getActiveServiceIds } = require('../utils/serviceCalendar');

const LOOKAHEAD_DEFAULT = 120; // minuti

/**
 * GET /api/journey/search
 * Trova corse dirette che collegano due fermate oggi.
 *
 * Query params:
 *   from       - stop_id fermata di partenza (obbligatorio)
 *   to         - stop_id fermata di arrivo (obbligatorio)
 *   lookahead  - finestra temporale in minuti (default 120, max 180)
 */
router.get('/search', async (req, res) => {
  const { from: fromStop, to: toStop } = req.query;
  const lookahead = Math.min(parseInt(req.query.lookahead) || LOOKAHEAD_DEFAULT, 180);

  if (!fromStop || !toStop) {
    return res.status(400).json({ error: 'Parametri from e to obbligatori' });
  }
  if (fromStop === toStop) {
    return res.status(400).json({ error: 'Le fermate di partenza e arrivo devono essere diverse' });
  }

  // Chiave cache con granularità al minuto — i risultati cambiano ogni minuto
  const cacheKey = `journey:search:${fromStop}:${toStop}:${Math.floor(nowInSeconds() / 60)}`;

  try {
    const result = await withCache('journey', cacheKey, async () => {
      const db = getDb();

      // Verifica esistenza fermate nel DB
      const fromStopRow = db.prepare(
        'SELECT stop_id, stop_name, stop_code FROM stops WHERE stop_id = ?'
      ).get(fromStop);
      const toStopRow = db.prepare(
        'SELECT stop_id, stop_name, stop_code FROM stops WHERE stop_id = ?'
      ).get(toStop);

      if (!fromStopRow) return { _error: 'Fermata di partenza non trovata', _status: 404 };
      if (!toStopRow)   return { _error: 'Fermata di arrivo non trovata',   _status: 404 };

      const activeServiceIds = getActiveServiceIds(db);
      if (!activeServiceIds.length) {
        return {
          fromStop: { stopId: fromStopRow.stop_id, stopName: fromStopRow.stop_name, stopCode: fromStopRow.stop_code },
          toStop:   { stopId: toStopRow.stop_id,   stopName: toStopRow.stop_name,   stopCode: toStopRow.stop_code },
          journeys: [],
          realtimeAvailable: false,
          message: 'Nessun servizio attivo per oggi',
          generatedAt: new Date().toISOString(),
        };
      }

      const nowSec = nowInSeconds();
      const maxSec = nowSec + lookahead * 60;

      // Placeholder dinamici per IN clause SQLite
      const placeholders = activeServiceIds.map(() => '?').join(',');

      // Query principale: corse che passano per entrambe le fermate nell'ordine corretto.
      // Usa due JOIN su stop_times (st_from e st_to) sullo stesso trip_id,
      // con la condizione st_to.stop_sequence > st_from.stop_sequence per garantire
      // che l'arrivo venga dopo la partenza nella stessa corsa.
      // Il calcolo in secondi via SUBSTR gestisce orari GTFS > 24:00:00 (corse notturne).
      const rows = db.prepare(`
        SELECT
          t.trip_id,
          t.route_id,
          t.trip_headsign,
          t.direction_id,
          r.route_short_name,
          r.route_long_name,
          r.route_type,
          r.route_color,
          r.route_text_color,
          st_from.stop_sequence  AS from_seq,
          st_from.departure_time AS from_departure,
          (
            CAST(SUBSTR(st_from.departure_time, 1, 2) AS INTEGER) * 3600 +
            CAST(SUBSTR(st_from.departure_time, 4, 2) AS INTEGER) * 60 +
            CAST(SUBSTR(st_from.departure_time, 7, 2) AS INTEGER)
          ) AS from_dep_sec,
          st_to.stop_sequence  AS to_seq,
          st_to.arrival_time   AS to_arrival,
          (
            CAST(SUBSTR(st_to.arrival_time, 1, 2) AS INTEGER) * 3600 +
            CAST(SUBSTR(st_to.arrival_time, 4, 2) AS INTEGER) * 60 +
            CAST(SUBSTR(st_to.arrival_time, 7, 2) AS INTEGER)
          ) AS to_arr_sec
        FROM trips t
        JOIN routes r
          ON r.route_id = t.route_id
        JOIN stop_times st_from
          ON st_from.trip_id = t.trip_id
         AND st_from.stop_id = ?
        JOIN stop_times st_to
          ON st_to.trip_id = t.trip_id
         AND st_to.stop_id = ?
         AND st_to.stop_sequence > st_from.stop_sequence
        WHERE t.service_id IN (${placeholders})
          AND (
            CAST(SUBSTR(st_from.departure_time, 1, 2) AS INTEGER) * 3600 +
            CAST(SUBSTR(st_from.departure_time, 4, 2) AS INTEGER) * 60 +
            CAST(SUBSTR(st_from.departure_time, 7, 2) AS INTEGER)
          ) BETWEEN ? AND ?
        ORDER BY from_dep_sec
        LIMIT 20
      `).all(
        fromStop,
        toStop,
        ...activeServiceIds,
        nowSec,
        maxSec
      );

      if (!rows.length) {
        return {
          fromStop: { stopId: fromStopRow.stop_id, stopName: fromStopRow.stop_name, stopCode: fromStopRow.stop_code },
          toStop:   { stopId: toStopRow.stop_id,   stopName: toStopRow.stop_name,   stopCode: toStopRow.stop_code },
          journeys: [],
          realtimeAvailable: isRealtimeEnabled(),
          message: `Nessuna corsa diretta nei prossimi ${lookahead} minuti`,
          generatedAt: new Date().toISOString(),
        };
      }

      // Query per contare le fermate intermedie (escluse from e to)
      const countStmt = db.prepare(`
        SELECT COUNT(*) AS cnt FROM stop_times
        WHERE trip_id = ?
          AND stop_sequence > ?
          AND stop_sequence < ?
      `);

      // Arricchimento GTFS-RT: ritardi per tutte le corse trovate
      const tripIds = rows.map(r => r.trip_id);
      const realtimeDelays = isRealtimeEnabled()
        ? await getRealtimeDelays(tripIds)
        : {};

      const journeys = rows.map(row => {
        const { cnt: intermediateStops } = countStmt.get(row.trip_id, row.from_seq, row.to_seq);
        const durationMinutes = Math.round((row.to_arr_sec - row.from_dep_sec) / 60);

        const rtInfo = realtimeDelays[row.trip_id];
        let departureTime = row.from_departure.substring(0, 5);
        let arrivalTime   = row.to_arrival.substring(0, 5);
        let realtimeDelay = null;
        let dataType      = 'scheduled';

        if (rtInfo) {
          dataType      = 'realtime';
          realtimeDelay = Math.round(rtInfo.delay / 60);
          departureTime = secondsToHHMM(row.from_dep_sec + rtInfo.delay);
          arrivalTime   = secondsToHHMM(row.to_arr_sec   + rtInfo.delay);
        }

        return {
          tripId:            row.trip_id,
          routeId:           row.route_id,
          routeShortName:    row.route_short_name,
          routeLongName:     row.route_long_name,
          routeType:         row.route_type,
          routeColor:        row.route_color      ? `#${row.route_color}`      : null,
          routeTextColor:    row.route_text_color ? `#${row.route_text_color}` : null,
          headsign:          row.trip_headsign,
          directionId:       row.direction_id,
          departureTime,
          arrivalTime,
          durationMinutes,
          intermediateStops,
          fromStopSequence:  row.from_seq,
          toStopSequence:    row.to_seq,
          realtimeDelay,     // null = dati schedulati, intero = minuti di ritardo
          dataType,          // 'scheduled' | 'realtime'
        };
      });

      return {
        fromStop: { stopId: fromStopRow.stop_id, stopName: fromStopRow.stop_name, stopCode: fromStopRow.stop_code },
        toStop:   { stopId: toStopRow.stop_id,   stopName: toStopRow.stop_name,   stopCode: toStopRow.stop_code },
        journeys,
        realtimeAvailable: isRealtimeEnabled(),
        lookaheadMinutes:  lookahead,
        generatedAt:       new Date().toISOString(),
      };
    });

    // Gestione errori di validazione passati attraverso la cache
    if (result._status === 404) {
      return res.status(404).json({ error: result._error });
    }

    res.json(result);
  } catch (err) {
    console.error('[journey/search]', err);
    res.status(500).json({ error: 'Errore nel calcolo del percorso' });
  }
});

/**
 * GET /api/journey/trip/:tripId
 * Dettaglio completo di una corsa con stato fermate e posizione veicolo realtime.
 *
 * Query params:
 *   fromStop - stop_id fermata di partenza (opzionale, usato per highlight)
 *   toStop   - stop_id fermata di arrivo (opzionale, usato per highlight)
 *
 * Calcolo status fermata:
 *   - Se GTFS-RT disponibile: usa currentStopId dal vehicle position
 *   - Fallback: confronto orario schedulato (± delay) con nowSec
 *   - Fermata considerata "passed" se dep_sec + delay < nowSec - 30s
 *   - Fermata "current" se è la prossima in programma entro 60s o è currentStopId
 */
router.get('/trip/:tripId', async (req, res) => {
  const { tripId } = req.params;
  const { fromStop, toStop } = req.query;

  // Cache con TTL arrivi (30s) — contiene dati realtime
  const cacheKey = `trip:${tripId}:${fromStop || ''}:${toStop || ''}`;

  try {
    const result = await withCache('arrivals', cacheKey, async () => {
      const db = getDb();

      // Dati corsa + linea
      const tripRow = db.prepare(`
        SELECT
          t.trip_id, t.trip_headsign, t.direction_id,
          r.route_id, r.route_short_name, r.route_long_name,
          r.route_type, r.route_color, r.route_text_color
        FROM trips t
        JOIN routes r ON r.route_id = t.route_id
        WHERE t.trip_id = ?
      `).get(tripId);

      if (!tripRow) return { _error: 'Corsa non trovata', _status: 404 };

      // Tutte le fermate della corsa in ordine di sequenza
      const stopRows = db.prepare(`
        SELECT
          s.stop_id, s.stop_code, s.stop_name,
          s.stop_lat, s.stop_lon,
          st.arrival_time, st.departure_time,
          st.stop_sequence,
          (
            CAST(SUBSTR(st.departure_time, 1, 2) AS INTEGER) * 3600 +
            CAST(SUBSTR(st.departure_time, 4, 2) AS INTEGER) * 60 +
            CAST(SUBSTR(st.departure_time, 7, 2) AS INTEGER)
          ) AS dep_sec
        FROM stop_times st
        JOIN stops s ON s.stop_id = st.stop_id
        WHERE st.trip_id = ?
        ORDER BY st.stop_sequence
      `).all(tripId);

      const nowSec = nowInSeconds();

      // Fetch GTFS-RT in parallelo: ritardi + posizione veicolo
      const [realtimeDelays, vehicleData] = await Promise.all([
        isRealtimeEnabled() ? getRealtimeDelays([tripId]) : Promise.resolve({}),
        isRealtimeEnabled() ? getVehiclePosition(tripId)  : Promise.resolve({ available: false }),
      ]);

      const rtInfo        = realtimeDelays[tripId] || null;
      const delaySeconds  = rtInfo?.delay ?? 0;

      // La fermata corrente rilevata dal vehicle position feed
      const currentStopIdFromVP = vehicleData?.available ? vehicleData.currentStopId : null;

      // Assegna status a ogni fermata.
      // Algoritmo:
      //  1. Se il vehicle position riporta una currentStopId → quella è "current"
      //  2. Altrimenti, confronta l'orario effettivo (scheduled + delay) con nowSec:
      //     - dep_sec + delay < nowSec - 30  → passed
      //     - dep_sec + delay <= nowSec + 60 → current (prima fermata non ancora passata)
      //     - else → upcoming
      let currentStopMarked = false;

      const stops = stopRows.map(row => {
        const effectiveSec = row.dep_sec + delaySeconds;
        let status;

        if (currentStopIdFromVP && row.stop_id === currentStopIdFromVP) {
          status = 'current';
          currentStopMarked = true;
        } else if (currentStopMarked) {
          // Tutte le fermate dopo quella corrente sono "upcoming"
          status = 'upcoming';
        } else if (effectiveSec < nowSec - 30) {
          status = 'passed';
        } else if (effectiveSec <= nowSec + 60) {
          // Prima fermata non ancora passata: la marchiamo come "current"
          status = 'current';
          currentStopMarked = true;
        } else {
          status = 'upcoming';
        }

        return {
          stopId:        row.stop_id,
          stopCode:      row.stop_code,
          stopName:      row.stop_name,
          stopLat:       row.stop_lat,
          stopLon:       row.stop_lon,
          arrivalTime:   row.arrival_time.substring(0, 5),
          departureTime: row.departure_time.substring(0, 5),
          stopSequence:  row.stop_sequence,
          status,
          isFrom: fromStop ? row.stop_id === fromStop : false,
          isTo:   toStop   ? row.stop_id === toStop   : false,
        };
      });

      const passedCount    = stops.filter(s => s.status === 'passed').length;
      const remainingCount = stops.filter(s => s.status === 'upcoming' || s.status === 'current').length;

      return {
        tripId,
        route: {
          routeId:       tripRow.route_id,
          routeShortName: tripRow.route_short_name,
          routeLongName:  tripRow.route_long_name,
          routeType:      tripRow.route_type,
          routeColor:     tripRow.route_color      ? `#${tripRow.route_color}`      : null,
          routeTextColor: tripRow.route_text_color ? `#${tripRow.route_text_color}` : null,
          headsign:       tripRow.trip_headsign,
          directionId:    tripRow.direction_id,
        },
        stops,
        vehicle: vehicleData || { available: false },
        summary: {
          totalStops:     stops.length,
          passedStops:    passedCount,
          remainingStops: remainingCount,
          delayMinutes:   rtInfo ? Math.round(rtInfo.delay / 60) : null,
          dataType:       rtInfo ? 'realtime' : 'scheduled',
        },
        realtimeAvailable: isRealtimeEnabled(),
        generatedAt:       new Date().toISOString(),
      };
    });

    if (result._status === 404) {
      return res.status(404).json({ error: result._error });
    }

    res.json(result);
  } catch (err) {
    console.error('[journey/trip/:tripId]', err);
    res.status(500).json({ error: 'Errore nel recupero della corsa' });
  }
});

module.exports = router;
