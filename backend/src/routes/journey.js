/**
 * routes/journey.js
 * Journey planner: cerca corse dirette tra due fermate e dettaglio corsa.
 *
 * Endpoints:
 *   GET /api/journey/search?from=<stopId>&to=<stopId>&lookahead=120
 *   GET /api/journey/metro?from=<stopId>&to=<stopId>&lookahead=90
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
  checkRealtimeHealth,
} = require('../gtfs/realtime');
const { getActiveServiceIds } = require('../utils/serviceCalendar');
const { getOtpPlan } = require('../gtfs/otp');

const LOOKAHEAD_DEFAULT = 120; // minuti

/**
 * Analizza la lista di corse trovate e identifica le soluzioni consigliate:
 *  - soonest:      prima corsa in partenza (attesa minima)
 *  - fastest:      corsa più breve (min durationMinutes)
 *  - mostReliable: corsa con minor ritardo realtime (null = puntuale, preferita)
 *
 * Ritorna gli indici delle corse consigliate nella lista journeys.
 */
function buildSolutions(journeys, nowSec, arriveBy) {
  if (!journeys.length) return {};

  // Calcola attesa in minuti per ogni corsa
  const withWait = journeys.map((j, idx) => {
    const [hh, mm] = j.departureTime.split(':').map(Number);
    const depSec = hh * 3600 + mm * 60;
    const waitMin = Math.max(0, Math.round((depSec - nowSec) / 60));
    return { idx, j, waitMin };
  });

  // Soonest: min wait (in modalità arriveBy: max arrivo = risultato in cima già)
  const soonest = withWait.reduce((a, b) => a.waitMin <= b.waitMin ? a : b);

  // Fastest: min durationMinutes
  const fastest = journeys.reduce((best, j, idx) =>
    j.durationMinutes < journeys[best].durationMinutes ? idx : best, 0);

  // Most reliable: null delay (puntuale) prima, poi minor ritardo
  let reliableIdx = 0;
  for (let i = 0; i < journeys.length; i++) {
    const j = journeys[i];
    const best = journeys[reliableIdx];
    const jDelay  = j.realtimeDelay ?? 0;
    const bDelay  = best.realtimeDelay ?? 0;
    if (jDelay < bDelay) reliableIdx = i;
  }

  const solutions = {
    soonest:      soonest.idx,
    fastest,
    mostReliable: reliableIdx,
  };

  // Annota ogni corsa con i tag soluzione
  journeys.forEach((j, idx) => {
    j.solutionTags = [];
    if (idx === solutions.soonest)      j.solutionTags.push('soonest');
    if (idx === solutions.fastest)      j.solutionTags.push('fastest');
    if (idx === solutions.mostReliable) j.solutionTags.push('reliable');
  });

  return solutions;
}

/**
 * GET /api/journey/search
 * Trova corse dirette che collegano due fermate oggi.
 *
 * Query params:
 *   from       - stop_id fermata di partenza (obbligatorio)
 *   to         - stop_id fermata di arrivo (obbligatorio)
 *   lookahead  - finestra temporale in minuti (default 120, max 180)
 *   arriveBy   - orario di arrivo desiderato HH:MM (opzionale, modalità "arriva entro")
 *                Se fornito cerca corse che arrivano entro quell'ora (ultimi 120 min prima)
 */
router.get('/search', async (req, res) => {
  const { from: fromStop, to: toStop, arriveBy } = req.query;
  const lookahead = Math.min(parseInt(req.query.lookahead) || LOOKAHEAD_DEFAULT, 180);

  if (!fromStop || !toStop) {
    return res.status(400).json({ error: 'Parametri from e to obbligatori' });
  }
  if (fromStop === toStop) {
    return res.status(400).json({ error: 'Le fermate di partenza e arrivo devono essere diverse' });
  }

  // Chiave cache con granularità al minuto — i risultati cambiano ogni minuto
  const arriveByKey = arriveBy || 'now';
  const cacheKey = `journey:search:${fromStop}:${toStop}:${arriveByKey}:${Math.floor(nowInSeconds() / 60)}`;

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

      // Placeholder dinamici per IN clause SQLite
      const placeholders = activeServiceIds.map(() => '?').join(',');

      // Calcola la finestra temporale in base alla modalità
      let timeFilter, timeParams, orderBy;
      if (arriveBy) {
        // Modalità "arriva entro": cerca corse con arrivo <= arriveBy
        const [hh, mm] = arriveBy.split(':').map(Number);
        const arriveBy_sec = (hh * 3600) + (mm * 60);
        const minSec = arriveBy_sec - lookahead * 60;
        timeFilter = `(
            CAST(SUBSTR(st_to.arrival_time, 1, 2) AS INTEGER) * 3600 +
            CAST(SUBSTR(st_to.arrival_time, 4, 2) AS INTEGER) * 60 +
            CAST(SUBSTR(st_to.arrival_time, 7, 2) AS INTEGER)
          ) BETWEEN ? AND ?`;
        timeParams = [minSec, arriveBy_sec];
        orderBy = 'to_arr_sec DESC'; // Ultime corse utili prima, scelta più comoda in cima
      } else {
        // Modalità "parti adesso": cerca corse con partenza >= ora
        const maxSec = nowSec + lookahead * 60;
        timeFilter = `(
            CAST(SUBSTR(st_from.departure_time, 1, 2) AS INTEGER) * 3600 +
            CAST(SUBSTR(st_from.departure_time, 4, 2) AS INTEGER) * 60 +
            CAST(SUBSTR(st_from.departure_time, 7, 2) AS INTEGER)
          ) BETWEEN ? AND ?`;
        timeParams = [nowSec, maxSec];
        orderBy = 'from_dep_sec';
      }

      // Query principale: corse che passano per entrambe le fermate nell'ordine corretto.
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
          AND ${timeFilter}
        ORDER BY ${orderBy}
        LIMIT 20
      `).all(
        fromStop,
        toStop,
        ...activeServiceIds,
        ...timeParams
      );

      if (!rows.length) {
        const noResultMsg = arriveBy
          ? `Nessuna corsa diretta per arrivare prima delle ${arriveBy}`
          : `Nessuna corsa diretta nei prossimi ${lookahead} minuti`;
        return {
          fromStop: { stopId: fromStopRow.stop_id, stopName: fromStopRow.stop_name, stopCode: fromStopRow.stop_code },
          toStop:   { stopId: toStopRow.stop_id,   stopName: toStopRow.stop_name,   stopCode: toStopRow.stop_code },
          journeys: [],
          realtimeAvailable: isRealtimeEnabled(),
          message: noResultMsg,
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
      let realtimeDelays = {};
      let realtimeStatus = 'disabled';

      if (isRealtimeEnabled()) {
        realtimeDelays = await getRealtimeDelays(tripIds);
        const hasAny = Object.keys(realtimeDelays).length > 0;
        if (hasAny) {
          realtimeStatus = 'active';
        } else {
          const health = await checkRealtimeHealth();
          realtimeStatus = health.status;
        }
      }

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

        // Calcola attesa stimata in minuti
        const depTimeParts = departureTime.split(':').map(Number);
        const adjustedDepSec = depTimeParts[0] * 3600 + depTimeParts[1] * 60;
        const waitMinutes = Math.max(0, Math.round((adjustedDepSec - nowSec) / 60));

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
          waitMinutes,
          intermediateStops,
          fromStopSequence:  row.from_seq,
          toStopSequence:    row.to_seq,
          realtimeDelay,     // null = dati schedulati, intero = minuti di ritardo
          dataType,          // 'scheduled' | 'realtime'
          solutionTags:      [], // verrà popolato da buildSolutions
        };
      });

      // Calcola soluzioni consigliate per il confronto
      const solutions = buildSolutions(journeys, nowSec, arriveBy);

      return {
        fromStop: { stopId: fromStopRow.stop_id, stopName: fromStopRow.stop_name, stopCode: fromStopRow.stop_code },
        toStop:   { stopId: toStopRow.stop_id,   stopName: toStopRow.stop_name,   stopCode: toStopRow.stop_code },
        journeys,
        solutions,
        searchMode:        arriveBy ? 'arriveBy' : 'departNow',
        realtimeAvailable: realtimeStatus === 'active',
        realtimeStatus,
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

/**
 * GET /api/journey/metro
 * Pianifica un viaggio in metropolitana tra due stazioni.
 *
 * Supporta:
 *   - Percorsi diretti (stessa linea, stessa corsa)
 *   - Percorsi con un cambio (stazione di interscambio tra linee diverse)
 *
 * Per ogni opzione restituisce:
 *   - waitMinutes:     attesa prima della partenza del primo treno
 *   - travelMinutes:   tempo di percorrenza puro (solo sul treno)
 *   - transferMinutes: tempo cambio alla stazione di interscambio (se applicabile)
 *   - totalMinutes:    totale complessivo
 *   - stops:           elenco fermate attraversate con orari e stato
 *   - vehicle:         posizione veicolo in tempo reale (se disponibile)
 *   - realtimeDelay:   ritardo in minuti (null = orario schedulato)
 *
 * Query params:
 *   from      - stop_id stazione di partenza (obbligatorio)
 *   to        - stop_id stazione di arrivo (obbligatorio)
 *   lookahead - finestra temporale in minuti (default 90, max 180)
 */
router.get('/metro', async (req, res) => {
  const { from: fromStop, to: toStop } = req.query;
  const lookahead = Math.min(parseInt(req.query.lookahead) || 90, 180);

  if (!fromStop || !toStop) {
    return res.status(400).json({ error: 'Parametri from e to obbligatori' });
  }
  if (fromStop === toStop) {
    return res.status(400).json({ error: 'Le stazioni di partenza e arrivo devono essere diverse' });
  }

  const cacheKey = `journey:metro:${fromStop}:${toStop}:${Math.floor(nowInSeconds() / 60)}`;

  try {
    const result = await withCache('journey', cacheKey, async () => {
      const db = getDb();

      // Verifica che le stazioni esistano e siano servite dalla metro (route_type = 1)
      const fromStopRow = db.prepare(`
        SELECT DISTINCT s.stop_id, s.stop_name, s.stop_code
        FROM stops s
        JOIN stop_times st ON st.stop_id = s.stop_id
        JOIN trips t       ON t.trip_id  = st.trip_id
        JOIN routes r      ON r.route_id = t.route_id
        WHERE s.stop_id = ? AND r.route_type = 1
        LIMIT 1
      `).get(fromStop);

      const toStopRow = db.prepare(`
        SELECT DISTINCT s.stop_id, s.stop_name, s.stop_code
        FROM stops s
        JOIN stop_times st ON st.stop_id = s.stop_id
        JOIN trips t       ON t.trip_id  = st.trip_id
        JOIN routes r      ON r.route_id = t.route_id
        WHERE s.stop_id = ? AND r.route_type = 1
        LIMIT 1
      `).get(toStop);

      if (!fromStopRow) return { _error: 'Stazione di partenza non trovata o non servita dalla metropolitana', _status: 404 };
      if (!toStopRow)   return { _error: 'Stazione di arrivo non trovata o non servita dalla metropolitana',   _status: 404 };

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
      const placeholders = activeServiceIds.map(() => '?').join(',');

      // ── Query corse dirette (stessa linea, stesso trip_id) ──────────────────
      const directRows = db.prepare(`
        SELECT
          t.trip_id,
          t.route_id,
          t.trip_headsign,
          t.direction_id,
          r.route_short_name,
          r.route_long_name,
          r.route_color,
          r.route_text_color,
          st_from.stop_sequence  AS from_seq,
          st_from.departure_time AS from_departure,
          (
            CAST(SUBSTR(st_from.departure_time, 1, 2) AS INTEGER) * 3600 +
            CAST(SUBSTR(st_from.departure_time, 4, 2) AS INTEGER) * 60 +
            CAST(SUBSTR(st_from.departure_time, 7, 2) AS INTEGER)
          ) AS from_dep_sec,
          st_to.stop_sequence AS to_seq,
          st_to.arrival_time  AS to_arrival,
          (
            CAST(SUBSTR(st_to.arrival_time, 1, 2) AS INTEGER) * 3600 +
            CAST(SUBSTR(st_to.arrival_time, 4, 2) AS INTEGER) * 60 +
            CAST(SUBSTR(st_to.arrival_time, 7, 2) AS INTEGER)
          ) AS to_arr_sec
        FROM trips t
        JOIN routes r      ON r.route_id = t.route_id AND r.route_type = 1
        JOIN stop_times st_from ON st_from.trip_id = t.trip_id AND st_from.stop_id = ?
        JOIN stop_times st_to   ON st_to.trip_id   = t.trip_id AND st_to.stop_id   = ?
          AND st_to.stop_sequence > st_from.stop_sequence
        WHERE t.service_id IN (${placeholders})
          AND (
            CAST(SUBSTR(st_from.departure_time, 1, 2) AS INTEGER) * 3600 +
            CAST(SUBSTR(st_from.departure_time, 4, 2) AS INTEGER) * 60 +
            CAST(SUBSTR(st_from.departure_time, 7, 2) AS INTEGER)
          ) BETWEEN ? AND ?
        ORDER BY from_dep_sec
        LIMIT 8
      `).all(fromStop, toStop, ...activeServiceIds, nowSec, maxSec);

      // Statement riutilizzabile per fermate di un segmento
      const segStopsStmt = db.prepare(`
        SELECT
          s.stop_id, s.stop_name, s.stop_code,
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
          AND st.stop_sequence >= ?
          AND st.stop_sequence <= ?
        ORDER BY st.stop_sequence
      `);

      // GTFS-RT delays per tutte le corse dirette
      const allTripIds = directRows.map(r => r.trip_id);
      const realtimeDelays = isRealtimeEnabled()
        ? await getRealtimeDelays(allTripIds)
        : {};

      // ── Costruisce journey diretti ───────────────────────────────────────────
      const directJourneys = await Promise.all(directRows.map(async row => {
        const rtInfo       = realtimeDelays[row.trip_id] || null;
        const delaySec     = rtInfo?.delay ?? 0;
        const effDepSec    = row.from_dep_sec + delaySec;
        const effArrSec    = row.to_arr_sec   + delaySec;
        const waitMinutes  = Math.max(0, Math.round((effDepSec - nowSec) / 60));
        const travelMinutes = Math.round((effArrSec - effDepSec) / 60);
        const totalMinutes  = waitMinutes + travelMinutes;

        // Posizione veicolo in tempo reale
        const vehicleData = isRealtimeEnabled()
          ? await getVehiclePosition(row.trip_id)
          : { available: false };

        // Stima minuti all'arrivo del treno alla stazione di partenza
        // (solo se il treno è ancora prima della stazione di partenza)
        let vehicleArrivalMinutes = null;
        if (vehicleData?.available && vehicleData.currentStopId) {
          const vpSeqRow = db.prepare(
            'SELECT stop_sequence FROM stop_times WHERE trip_id = ? AND stop_id = ? LIMIT 1'
          ).get(row.trip_id, vehicleData.currentStopId);
          if (vpSeqRow && vpSeqRow.stop_sequence < row.from_seq && travelMinutes > 0) {
            const stopsToFrom = row.from_seq - vpSeqRow.stop_sequence;
            const totalSegs   = row.to_seq - row.from_seq || 1;
            vehicleArrivalMinutes = Math.round(stopsToFrom * (travelMinutes / totalSegs));
          }
        }

        // Fermate del segmento (da from_seq a to_seq incluse)
        const segStops = segStopsStmt.all(row.trip_id, row.from_seq, row.to_seq);
        const stops = segStops.map(s => ({
          stopId:        s.stop_id,
          stopCode:      s.stop_code,
          stopName:      s.stop_name,
          arrivalTime:   s.arrival_time.substring(0, 5),
          departureTime: s.departure_time.substring(0, 5),
          stopSequence:  s.stop_sequence,
          isFrom:        s.stop_id === fromStop,
          isTo:          s.stop_id === toStop,
          isTransfer:    false,
        }));

        return {
          type:               'direct',
          tripId:             row.trip_id,
          routeId:            row.route_id,
          routeShortName:     row.route_short_name,
          routeLongName:      row.route_long_name,
          routeColor:         row.route_color      ? `#${row.route_color}`      : '#E84B24',
          routeTextColor:     row.route_text_color ? `#${row.route_text_color}` : '#FFFFFF',
          headsign:           row.trip_headsign,
          directionId:        row.direction_id,
          departureTime:      secondsToHHMM(effDepSec),
          arrivalTime:        secondsToHHMM(effArrSec),
          scheduledDeparture: row.from_departure.substring(0, 5),
          scheduledArrival:   row.to_arrival.substring(0, 5),
          waitMinutes,
          travelMinutes,
          transferMinutes:    0,
          totalMinutes,
          intermediateStops:  stops.length - 2,
          stops,
          realtimeDelay:      rtInfo ? Math.round(rtInfo.delay / 60) : null,
          dataType:           rtInfo ? 'realtime' : 'scheduled',
          vehicle:            vehicleData || { available: false },
          vehicleArrivalMinutes,
          transfer:           null,
        };
      }));

      // ── Percorsi con cambio (solo se ci sono meno di 3 diretti) ─────────────
      let transferJourneys = [];

      if (directJourneys.length < 3) {
        // Stazioni che fungono da interscambio tra più linee metro
        const transferStations = db.prepare(`
          SELECT s.stop_id, s.stop_name, s.stop_code,
                 COUNT(DISTINCT t.route_id) AS line_count
          FROM stops s
          JOIN stop_times st ON st.stop_id = s.stop_id
          JOIN trips t       ON t.trip_id  = st.trip_id
          JOIN routes r      ON r.route_id = t.route_id
          WHERE r.route_type = 1
            AND s.stop_id != ?
            AND s.stop_id != ?
          GROUP BY s.stop_id
          HAVING line_count > 1
          LIMIT 10
        `).all(fromStop, toStop);

        for (const hub of transferStations) {
          // Leg 1: fromStop → hub
          const leg1Rows = db.prepare(`
            SELECT
              t.trip_id, t.route_id, t.trip_headsign,
              r.route_short_name, r.route_color, r.route_text_color,
              st_from.stop_sequence AS from_seq,
              st_from.departure_time AS from_departure,
              (
                CAST(SUBSTR(st_from.departure_time, 1, 2) AS INTEGER) * 3600 +
                CAST(SUBSTR(st_from.departure_time, 4, 2) AS INTEGER) * 60 +
                CAST(SUBSTR(st_from.departure_time, 7, 2) AS INTEGER)
              ) AS from_dep_sec,
              st_to.stop_sequence AS to_seq,
              st_to.arrival_time  AS hub_arrival,
              (
                CAST(SUBSTR(st_to.arrival_time, 1, 2) AS INTEGER) * 3600 +
                CAST(SUBSTR(st_to.arrival_time, 4, 2) AS INTEGER) * 60 +
                CAST(SUBSTR(st_to.arrival_time, 7, 2) AS INTEGER)
              ) AS hub_arr_sec
            FROM trips t
            JOIN routes r      ON r.route_id = t.route_id AND r.route_type = 1
            JOIN stop_times st_from ON st_from.trip_id = t.trip_id AND st_from.stop_id = ?
            JOIN stop_times st_to   ON st_to.trip_id   = t.trip_id AND st_to.stop_id   = ?
              AND st_to.stop_sequence > st_from.stop_sequence
            WHERE t.service_id IN (${placeholders})
              AND from_dep_sec BETWEEN ? AND ?
            ORDER BY from_dep_sec
            LIMIT 3
          `).all(fromStop, hub.stop_id, ...activeServiceIds, nowSec, maxSec);

          if (!leg1Rows.length) continue;

          for (const leg1 of leg1Rows) {
            // 3 minuti di tempo cambio stimato
            const transferBuffer = 3 * 60;

            // Leg 2: hub → toStop, su linea diversa, dopo arrivo leg1 + buffer
            const leg2Rows = db.prepare(`
              SELECT
                t.trip_id, t.route_id, t.trip_headsign,
                r.route_short_name, r.route_color, r.route_text_color,
                st_from.stop_sequence AS from_seq,
                st_from.departure_time AS hub_departure,
                (
                  CAST(SUBSTR(st_from.departure_time, 1, 2) AS INTEGER) * 3600 +
                  CAST(SUBSTR(st_from.departure_time, 4, 2) AS INTEGER) * 60 +
                  CAST(SUBSTR(st_from.departure_time, 7, 2) AS INTEGER)
                ) AS hub_dep_sec,
                st_to.stop_sequence AS to_seq,
                st_to.arrival_time  AS to_arrival,
                (
                  CAST(SUBSTR(st_to.arrival_time, 1, 2) AS INTEGER) * 3600 +
                  CAST(SUBSTR(st_to.arrival_time, 4, 2) AS INTEGER) * 60 +
                  CAST(SUBSTR(st_to.arrival_time, 7, 2) AS INTEGER)
                ) AS to_arr_sec
              FROM trips t
              JOIN routes r      ON r.route_id = t.route_id AND r.route_type = 1
              JOIN stop_times st_from ON st_from.trip_id = t.trip_id AND st_from.stop_id = ?
              JOIN stop_times st_to   ON st_to.trip_id   = t.trip_id AND st_to.stop_id   = ?
                AND st_to.stop_sequence > st_from.stop_sequence
              WHERE t.service_id IN (${placeholders})
                AND hub_dep_sec >= ?
                AND t.route_id != ?
              ORDER BY hub_dep_sec
              LIMIT 2
            `).all(hub.stop_id, toStop, ...activeServiceIds, leg1.hub_arr_sec + transferBuffer, leg1.route_id);

            if (!leg2Rows.length) continue;
            const leg2 = leg2Rows[0];

            const rtLeg1     = realtimeDelays[leg1.trip_id] || null;
            const rtLeg2     = realtimeDelays[leg2.trip_id] || null;
            const delay1Sec  = rtLeg1?.delay ?? 0;
            const delay2Sec  = rtLeg2?.delay ?? 0;

            const effDep1  = leg1.from_dep_sec + delay1Sec;
            const effArr1  = leg1.hub_arr_sec  + delay1Sec;
            const effDep2  = leg2.hub_dep_sec  + delay2Sec;
            const effArr2  = leg2.to_arr_sec   + delay2Sec;

            const waitMinutes     = Math.max(0, Math.round((effDep1 - nowSec) / 60));
            const travel1Minutes  = Math.round((effArr1 - effDep1) / 60);
            const transferMinutes = Math.max(3, Math.round((effDep2 - effArr1) / 60));
            const travel2Minutes  = Math.round((effArr2 - effDep2) / 60);
            const travelMinutes   = travel1Minutes + travel2Minutes;
            const totalMinutes    = waitMinutes + travelMinutes + transferMinutes;

            const seg1Stops = segStopsStmt.all(leg1.trip_id, leg1.from_seq, leg1.to_seq)
              .map(s => ({
                stopId: s.stop_id, stopCode: s.stop_code, stopName: s.stop_name,
                arrivalTime: s.arrival_time.substring(0, 5),
                departureTime: s.departure_time.substring(0, 5),
                stopSequence: s.stop_sequence,
                isFrom: s.stop_id === fromStop, isTo: false,
                isTransfer: s.stop_id === hub.stop_id,
              }));

            const seg2Stops = segStopsStmt.all(leg2.trip_id, leg2.from_seq, leg2.to_seq)
              .map(s => ({
                stopId: s.stop_id, stopCode: s.stop_code, stopName: s.stop_name,
                arrivalTime: s.arrival_time.substring(0, 5),
                departureTime: s.departure_time.substring(0, 5),
                stopSequence: s.stop_sequence,
                isFrom: false, isTo: s.stop_id === toStop,
                isTransfer: s.stop_id === hub.stop_id,
              }));

            transferJourneys.push({
              type:            'transfer',
              departureTime:   secondsToHHMM(effDep1),
              arrivalTime:     secondsToHHMM(effArr2),
              waitMinutes,
              travelMinutes,
              transferMinutes,
              totalMinutes,
              realtimeAvailable: isRealtimeEnabled(),
              transfer: {
                stopId:          hub.stop_id,
                stopName:        hub.stop_name,
                stopCode:        hub.stop_code,
                transferMinutes,
              },
              legs: [
                {
                  tripId:         leg1.trip_id,
                  routeId:        leg1.route_id,
                  routeShortName: leg1.route_short_name,
                  routeColor:     leg1.route_color      ? `#${leg1.route_color}`      : '#E84B24',
                  routeTextColor: leg1.route_text_color ? `#${leg1.route_text_color}` : '#FFFFFF',
                  headsign:       leg1.trip_headsign,
                  departureTime:  secondsToHHMM(effDep1),
                  arrivalTime:    secondsToHHMM(effArr1),
                  travelMinutes:  travel1Minutes,
                  stops:          seg1Stops,
                  realtimeDelay:  rtLeg1 ? Math.round(rtLeg1.delay / 60) : null,
                  dataType:       rtLeg1 ? 'realtime' : 'scheduled',
                  vehicle:        { available: false },
                },
                {
                  tripId:         leg2.trip_id,
                  routeId:        leg2.route_id,
                  routeShortName: leg2.route_short_name,
                  routeColor:     leg2.route_color      ? `#${leg2.route_color}`      : '#E84B24',
                  routeTextColor: leg2.route_text_color ? `#${leg2.route_text_color}` : '#FFFFFF',
                  headsign:       leg2.trip_headsign,
                  departureTime:  secondsToHHMM(effDep2),
                  arrivalTime:    secondsToHHMM(effArr2),
                  travelMinutes:  travel2Minutes,
                  stops:          seg2Stops,
                  realtimeDelay:  rtLeg2 ? Math.round(rtLeg2.delay / 60) : null,
                  dataType:       rtLeg2 ? 'realtime' : 'scheduled',
                  vehicle:        { available: false },
                },
              ],
            });
          }

          transferJourneys.sort((a, b) => a.totalMinutes - b.totalMinutes);
          transferJourneys = transferJourneys.slice(0, 3);
        }
      }

      const allJourneys = [...directJourneys, ...transferJourneys]
        .sort((a, b) => a.departureTime.localeCompare(b.departureTime));

      return {
        fromStop: { stopId: fromStopRow.stop_id, stopName: fromStopRow.stop_name, stopCode: fromStopRow.stop_code },
        toStop:   { stopId: toStopRow.stop_id,   stopName: toStopRow.stop_name,   stopCode: toStopRow.stop_code },
        journeys: allJourneys,
        realtimeAvailable: isRealtimeEnabled(),
        lookaheadMinutes:  lookahead,
        generatedAt:       new Date().toISOString(),
      };
    });

    if (result._status === 404) {
      return res.status(404).json({ error: result._error });
    }

    res.json(result);
  } catch (err) {
    console.error('[journey/metro]', err);
    res.status(500).json({ error: 'Errore nel calcolo del percorso metro' });
  }
});

/**
 * GET /api/journey/plan
 * Pianificatore itinerari con OTP (cambi inclusi).
 * Fallback su corse dirette GTFS se OTP non è raggiungibile.
 *
 * Query params:
 *   from      - stop_id fermata di partenza (alternativo a fromLat/fromLon)
 *   to        - stop_id fermata di arrivo   (alternativo a toLat/toLon)
 *   fromLat, fromLon, fromName - coordinate luogo di partenza
 *   toLat, toLon, toName       - coordinate luogo di arrivo
 *   arriveBy  - orario di arrivo desiderato HH:MM (opzionale)
 *   departAt  - orario di partenza desiderato HH:MM (opzionale)
 */
router.get('/plan', async (req, res) => {
  const {
    from: fromStop, to: toStop,
    fromLat, fromLon, fromName,
    toLat, toLon, toName,
    arriveBy, departAt,
  } = req.query;

  const hasFrom = fromStop || (fromLat && fromLon);
  const hasTo   = toStop   || (toLat   && toLon);

  if (!hasFrom || !hasTo) {
    return res.status(400).json({ error: 'Parametri from e to obbligatori' });
  }

  try {
    const db = getDb();

    // Risolvi coordinate e info per partenza
    let fromInfo, fromStopInfo;
    if (fromStop) {
      const row = db.prepare(
        'SELECT stop_id, stop_name, stop_code, stop_lat, stop_lon FROM stops WHERE stop_id = ?'
      ).get(fromStop);
      if (!row) return res.status(404).json({ error: 'Fermata di partenza non trovata' });
      fromInfo     = { lat: row.stop_lat, lon: row.stop_lon };
      fromStopInfo = { stopId: row.stop_id, stopName: row.stop_name, stopCode: row.stop_code };
    } else {
      fromInfo     = { lat: parseFloat(fromLat), lon: parseFloat(fromLon) };
      fromStopInfo = { stopId: null, stopName: fromName || 'Partenza', stopCode: null };
    }

    // Risolvi coordinate e info per arrivo
    let toInfo, toStopInfo;
    if (toStop) {
      const row = db.prepare(
        'SELECT stop_id, stop_name, stop_code, stop_lat, stop_lon FROM stops WHERE stop_id = ?'
      ).get(toStop);
      if (!row) return res.status(404).json({ error: 'Fermata di arrivo non trovata' });
      toInfo     = { lat: row.stop_lat, lon: row.stop_lon };
      toStopInfo = { stopId: row.stop_id, stopName: row.stop_name, stopCode: row.stop_code };
    } else {
      toInfo     = { lat: parseFloat(toLat), lon: parseFloat(toLon) };
      toStopInfo = { stopId: null, stopName: toName || 'Arrivo', stopCode: null };
    }

    // Calcola data/ora per OTP (fuso italiano)
    let otpDate, otpTime, isArriveBy = false;
    if (arriveBy || departAt) {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      const v = Object.fromEntries(p.map(x => [x.type, x.value]));
      otpDate = `${v.year}-${v.month}-${v.day}`;
      if (arriveBy) { otpTime = `${arriveBy}:00`; isArriveBy = true; }
      else          { otpTime = `${departAt}:00`;  isArriveBy = false; }
    }

    const otpResult = await getOtpPlan(
      fromInfo.lat, fromInfo.lon,
      toInfo.lat,   toInfo.lon,
      { numItineraries: 5, date: otpDate, time: otpTime, arriveBy: isArriveBy }
    );

    // OTP disponibile
    if (otpResult !== null) {
      // OTP usa stop_code come identificatore interno (non stop_id).
      // Lookup per stop_code → ottieni stop_id reale, stop_code e stop_name corretti.
      const stopEnrichStmt = db.prepare(
        'SELECT stop_id, stop_code, stop_name FROM stops WHERE stop_code = ? LIMIT 1'
      );
      for (const itin of otpResult) {
        for (const leg of itin.legs) {
          if (leg.from.stopId) {
            const r = stopEnrichStmt.get(leg.from.stopId);
            if (r) {
              leg.from.stopId   = r.stop_id;            // stop_id reale del DB
              leg.from.stopCode = r.stop_code || null;
              leg.from.name     = r.stop_name || leg.from.name;
            }
          }
          if (leg.to.stopId) {
            const r = stopEnrichStmt.get(leg.to.stopId);
            if (r) {
              leg.to.stopId   = r.stop_id;              // stop_id reale del DB
              leg.to.stopCode = r.stop_code || null;
              leg.to.name     = r.stop_name || leg.to.name;
            }
          }
        }
      }
      return res.json({
        fromStop:    fromStopInfo,
        toStop:      toStopInfo,
        itineraries: otpResult,
        source:      'otp',
        fallback:    false,
        generatedAt: new Date().toISOString(),
      });
    }

    // ── Fallback GTFS diretto (solo se si dispone di stop_id) ─────────────────
    const activeServiceIds = getActiveServiceIds(db);
    let itineraries = [];

    if (activeServiceIds.length && fromStop && toStop) {
      const placeholders = activeServiceIds.map(() => '?').join(',');
      const nowSec = nowInSeconds();
      const lookahead = 120;

      let timeFilter, timeParams;
      if (arriveBy) {
        const [hh, mm] = arriveBy.split(':').map(Number);
        const arriveBy_sec = hh * 3600 + mm * 60;
        const minSec = arriveBy_sec - lookahead * 60;
        timeFilter = `(
          CAST(SUBSTR(st_to.arrival_time, 1, 2) AS INTEGER) * 3600 +
          CAST(SUBSTR(st_to.arrival_time, 4, 2) AS INTEGER) * 60 +
          CAST(SUBSTR(st_to.arrival_time, 7, 2) AS INTEGER)
        ) BETWEEN ? AND ?`;
        timeParams = [minSec, arriveBy_sec];
      } else {
        const maxSec = nowSec + lookahead * 60;
        timeFilter = `(
          CAST(SUBSTR(st_from.departure_time, 1, 2) AS INTEGER) * 3600 +
          CAST(SUBSTR(st_from.departure_time, 4, 2) AS INTEGER) * 60 +
          CAST(SUBSTR(st_from.departure_time, 7, 2) AS INTEGER)
        ) BETWEEN ? AND ?`;
        timeParams = [nowSec, maxSec];
      }

      const rows = db.prepare(`
        SELECT
          t.trip_id,
          r.route_short_name,
          r.route_long_name,
          r.route_type,
          r.route_color,
          r.route_text_color,
          t.trip_headsign,
          st_from.stop_sequence  AS from_seq,
          st_from.departure_time AS from_departure,
          (
            CAST(SUBSTR(st_from.departure_time, 1, 2) AS INTEGER) * 3600 +
            CAST(SUBSTR(st_from.departure_time, 4, 2) AS INTEGER) * 60 +
            CAST(SUBSTR(st_from.departure_time, 7, 2) AS INTEGER)
          ) AS from_dep_sec,
          st_to.arrival_time AS to_arrival,
          (
            CAST(SUBSTR(st_to.arrival_time, 1, 2) AS INTEGER) * 3600 +
            CAST(SUBSTR(st_to.arrival_time, 4, 2) AS INTEGER) * 60 +
            CAST(SUBSTR(st_to.arrival_time, 7, 2) AS INTEGER)
          ) AS to_arr_sec
        FROM trips t
        JOIN routes r ON r.route_id = t.route_id
        JOIN stop_times st_from
          ON st_from.trip_id = t.trip_id AND st_from.stop_id = ?
        JOIN stop_times st_to
          ON st_to.trip_id = t.trip_id AND st_to.stop_id = ?
         AND st_to.stop_sequence > st_from.stop_sequence
        WHERE t.service_id IN (${placeholders})
          AND ${timeFilter}
        ORDER BY ${arriveBy ? 'to_arr_sec DESC' : 'from_dep_sec'}
        LIMIT 10
      `).all(fromStop, toStop, ...activeServiceIds, ...timeParams);

      itineraries = rows.map(row => {
        const depTime = row.from_departure.substring(0, 5);
        const arrTime = row.to_arrival.substring(0, 5);
        const durationMin = Math.round((row.to_arr_sec - row.from_dep_sec) / 60);
        const mode = row.route_type === 1 ? 'SUBWAY' : row.route_type === 0 ? 'TRAM' : 'BUS';
        const leg = {
          mode,
          startTime:   depTime,
          endTime:     arrTime,
          durationMin,
          realTime:    false,
          distanceM:   0,
          from: { name: fromStopInfo.stopName, stopId: fromStopInfo.stopId, stopCode: fromStopInfo.stopCode ?? null },
          to:   { name: toStopInfo.stopName,   stopId: toStopInfo.stopId,   stopCode: toStopInfo.stopCode   ?? null },
          route: {
            shortName: row.route_short_name || '',
            longName:  row.route_long_name  || null,
            color:     row.route_color     ? `#${row.route_color}`     : null,
            textColor: row.route_text_color ? `#${row.route_text_color}` : null,
            type:      row.route_type,
          },
          tripId: row.trip_id,
        };
        return {
          departureTime: depTime,
          arrivalTime:   arrTime,
          durationMin,
          waitingMin:    0,
          walkMin:       0,
          walkDistanceM: 0,
          transfers:     0,
          legs:          [leg],
          transitLegs:   [leg],
        };
      });
    }

    return res.json({
      fromStop:    fromStopInfo,
      toStop:      toStopInfo,
      itineraries,
      source:      'gtfs_direct',
      fallback:    true,
      generatedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[journey/plan]', err);
    res.status(500).json({ error: 'Errore nel calcolo del percorso' });
  }
});

module.exports = router;
