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

const MAX_ARRIVALS    = 20;
const NOON_SECONDS    = 43200; // 12:00 in secondi dalla mezzanotte

// Calcola i minuti fino al prossimo mezzogiorno (oggi se siamo prima delle 12, domani se dopo).
// Garantisce una finestra ≤ 24 ore — evita finestre da 35+ ore dopo mezzanotte.
function minutesUntilNextNoon() {
  const nowSec = nowInSeconds();
  const secsUntilNoon = nowSec < NOON_SECONDS
    ? NOON_SECONDS - nowSec               // prima di mezzogiorno: mezzogiorno di oggi
    : 86400 + NOON_SECONDS - nowSec;      // dopo mezzogiorno: mezzogiorno di domani
  return Math.ceil(secsUntilNoon / 60);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Fallback: legge i passaggi dal DB GTFS statico e li arricchisce con
 * il feed GTFS-RT ufficiale GTT (se configurato).
 */
// Costruisce la query SQL per le stop_times con espressione dep_seconds
const STOP_TIMES_QUERY = (serviceIdsPlaceholder) => `
  SELECT
    st.trip_id,
    st.departure_time,
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
    AND t.service_id IN (${serviceIdsPlaceholder})
    AND (
      CAST(SUBSTR(st.departure_time, 1, 2) AS INTEGER) * 3600 +
      CAST(SUBSTR(st.departure_time, 4, 2) AS INTEGER) * 60 +
      CAST(SUBSTR(st.departure_time, 7, 2) AS INTEGER)
    ) BETWEEN ? AND ?
  ORDER BY dep_seconds
  LIMIT ?
`;

// Calcola i service_id attivi per una data specifica (YYYYMMDD) e giorno settimana
function getServiceIdsForDate(db, gtfsDate, weekday) {
  const regular = db.prepare(`
    SELECT service_id FROM calendar
    WHERE ${weekday} = 1 AND start_date <= ? AND end_date >= ?
  `).all(gtfsDate, gtfsDate).map(r => r.service_id);

  const added = db.prepare(`
    SELECT service_id FROM calendar_dates WHERE date = ? AND exception_type = 1
  `).all(gtfsDate).map(r => r.service_id);

  const removed = new Set(
    db.prepare(`
      SELECT service_id FROM calendar_dates WHERE date = ? AND exception_type = 2
    `).all(gtfsDate).map(r => r.service_id)
  );

  const all = new Set([...regular, ...added]);
  for (const id of removed) all.delete(id);
  return Array.from(all);
}

// Converte riga GTFS in oggetto arrivo
function rowToArrival(row, nowSec, rtDelays, nextDay = false, nextDayDate = null) {
  const scheduledSec = gtfsTimeToSeconds(row.departure_time);
  const rtInfo       = rtDelays[row.trip_id];

  let realtimeSec  = null;
  let delayMinutes = null;
  let dataType     = 'scheduled';

  if (rtInfo) {
    dataType     = 'realtime';
    realtimeSec  = scheduledSec + rtInfo.delay;
    delayMinutes = Math.round(rtInfo.delay / 60);
  }

  // Per corse del giorno dopo: waitMinutes = secondi rimanenti fino a mezzanotte + dep_seconds
  const baseSec     = nextDay ? (86400 - nowSec + scheduledSec) : ((realtimeSec ?? scheduledSec) - nowSec);
  const waitMinutes = Math.round(baseSec / 60);

  // Normalizza orario > 24h in HH:MM (es. "25:30" → "01:30")
  const displayTime = row.departure_time.substring(0, 5);
  const [h, m]      = displayTime.split(':').map(Number);
  const normalizedTime = `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  return {
    tripId:         row.trip_id,
    routeId:        row.route_id,
    routeShortName: row.route_short_name,
    routeLongName:  row.route_long_name,
    routeType:      row.route_type,
    routeColor:     row.route_color      ? `#${row.route_color}`      : null,
    routeTextColor: row.route_text_color ? `#${row.route_text_color}` : null,
    headsign:       row.trip_headsign,
    directionId:    row.direction_id,
    scheduledTime:  normalizedTime,
    realtimeTime:   realtimeSec ? secondsToHHMM(realtimeSec) : null,
    waitMinutes,
    delayMinutes,
    dataType,
    status:         rtInfo?.status ?? 'unknown',
    canceled:       false,
    nextDay,
    nextDayDate,
  };
}

async function getStaticArrivals(stopId, limit, lookahead) {
  const db           = getDb();
  const nowSec       = nowInSeconds();

  // ── Corse di oggi ─────────────────────────────────────────────────────────
  const { todayGtfsDate, todayWeekdayField } = require('../utils/time');
  const todayServiceIds = getActiveServiceIds(db);

  const todayRows = todayServiceIds.length
    ? db.prepare(STOP_TIMES_QUERY(todayServiceIds.map(() => '?').join(',')))
        .all(stopId, ...todayServiceIds, nowSec, nowSec + lookahead * 60, limit * 2)
    : [];

  // ── Corse del giorno dopo (00:00–12:00) ───────────────────────────────────
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome',
      year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long',
    }).formatToParts(tomorrowDate).map(p => [p.type, p.value])
  );
  const tomorrowGtfsDate = `${tomorrowParts.year}${tomorrowParts.month}${tomorrowParts.day}`;
  const tomorrowWeekday  = tomorrowParts.weekday.toLowerCase();
  const tomorrowServiceIds = getServiceIdsForDate(db, tomorrowGtfsDate, tomorrowWeekday);

  const tomorrowDateLabel = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit',
  }).format(tomorrowDate);

  // Aggiungi corse del giorno dopo solo se la finestra supera mezzanotte
  const windowEndSec = nowSec + lookahead * 60;
  const nextDayRows = (tomorrowServiceIds.length && windowEndSec > 86400)
    ? db.prepare(STOP_TIMES_QUERY(tomorrowServiceIds.map(() => '?').join(',')))
        .all(stopId, ...tomorrowServiceIds, 0, Math.min(windowEndSec - 86400, NOON_SECONDS), limit)
    : [];

  if (!todayRows.length && !nextDayRows.length) {
    return {
      arrivals:       [],
      realtimeStatus: isRealtimeEnabled() ? 'empty' : 'disabled',
      message:        `Nessun passaggio previsto`,
    };
  }

  // Arricchimento GTFS-RT (solo per corse di oggi)
  const allTripIds    = [...new Set(todayRows.map(r => r.trip_id))];
  let realtimeDelays  = {};
  let realtimeStatus  = 'disabled';

  if (isRealtimeEnabled() && allTripIds.length) {
    realtimeDelays = await getRealtimeDelays(allTripIds);
    const hasAny   = Object.keys(realtimeDelays).length > 0;
    realtimeStatus = hasAny ? 'active' : (await checkRealtimeHealth()).status;
  }

  const todayArrivals = todayRows
    .map(row => rowToArrival(row, nowSec, realtimeDelays, false, null))
    .filter(a => a.waitMinutes >= 0)
    .slice(0, limit);

  const nextDayArrivals = nextDayRows
    .map(row => rowToArrival(row, nowSec, {}, true, tomorrowDateLabel));

  // Unisci: prima corse oggi, poi quelle di domani ordinate
  const arrivals = [
    ...todayArrivals,
    ...nextDayArrivals.sort((a, b) => a.waitMinutes - b.waitMinutes),
  ].slice(0, limit + 10); // piccolo extra per il giorno dopo

  return { arrivals, realtimeStatus };
}

// ─── Scheduled window query ───────────────────────────────────────────────────

const WINDOW_SECS = 14 * 3600; // 14 ore

/**
 * Ritorna gli arrivi programmati per una finestra di 14 ore a partire da
 * dateStr (YYYY-MM-DD) e timeStr (HH:MM), senza dati realtime.
 */
async function getScheduledForWindow(stopId, limit, dateStr, timeStr) {
  const db = getDb();

  // Converti data/ora in secondi dalla mezzanotte
  const [hh, mm]   = timeStr.split(':').map(Number);
  const startSec   = hh * 3600 + mm * 60;
  const endSec     = startSec + WINDOW_SECS;

  // Formato data GTFS (YYYYMMDD) e giorno settimana per oggi
  const gtfsDate = dateStr.replace(/-/g, '');
  const dateObj  = new Date(dateStr + 'T12:00:00Z');
  const weekday  = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', weekday: 'long',
  }).format(dateObj).toLowerCase();

  const serviceIds = getServiceIdsForDate(db, gtfsDate, weekday);

  // Calcola data/giorno successivo per la finestra a cavallo della mezzanotte
  const nextDateObj  = new Date(dateStr + 'T12:00:00Z');
  nextDateObj.setUTCDate(nextDateObj.getUTCDate() + 1);
  const nextDateStr  = nextDateObj.toISOString().slice(0, 10);
  const nextGtfsDate = nextDateStr.replace(/-/g, '');
  const nextWeekday  = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', weekday: 'long',
  }).format(nextDateObj).toLowerCase();

  // Label giorno successivo (DD/MM)
  const nextDayLabel = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit',
  }).format(nextDateObj);

  // ── Query corse di oggi nella finestra ────────────────────────────────────
  const todayRows = serviceIds.length
    ? db.prepare(STOP_TIMES_QUERY(serviceIds.map(() => '?').join(',')))
        .all(stopId, ...serviceIds, startSec, Math.min(endSec, 86399), limit * 2)
    : [];

  // Corse "notturne" GTFS con departure_time >= 86400 (es. 25:30) nella finestra
  // Queste sono ancora nel servizio di oggi ma con orario oltre mezzanotte
  const overnightRows = serviceIds.length
    ? db.prepare(STOP_TIMES_QUERY(serviceIds.map(() => '?').join(',')))
        .all(stopId, ...serviceIds, 86400, endSec, limit)
    : [];

  // ── Query corse del giorno successivo se la finestra supera mezzanotte ────
  let nextDayRows = [];
  if (endSec > 86400) {
    const nextServiceIds = getServiceIdsForDate(db, nextGtfsDate, nextWeekday);
    const nextEndSec     = endSec - 86400;
    nextDayRows = nextServiceIds.length
      ? db.prepare(STOP_TIMES_QUERY(nextServiceIds.map(() => '?').join(',')))
          .all(stopId, ...nextServiceIds, 0, nextEndSec, limit)
      : [];
  }

  // ── Costruisci lista arrivi ───────────────────────────────────────────────
  const toArrival = (row, isNextDay, nextDayDate) => {
    const depSec = row.dep_seconds;

    // Normalizza orario (es. "25:30" → "01:30")
    const rawTime = row.departure_time.substring(0, 5);
    const [rh, rm] = rawTime.split(':').map(Number);
    const scheduledTime = `${String(rh % 24).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;

    // waitMinutes rispetto all'orario di inizio della ricerca
    let waitSec;
    if (isNextDay) {
      // corsa del giorno dopo: i secondi vanno da 0 a nextEndSec
      waitSec = (86400 - startSec) + depSec;
    } else if (depSec >= 86400) {
      // corsa notturna GTFS (departure_time > 24h) — appartiene a oggi ma oltre mezzanotte
      waitSec = depSec - startSec;
    } else {
      waitSec = depSec - startSec;
    }
    const waitMinutes = Math.round(waitSec / 60);

    return {
      tripId:         row.trip_id,
      routeId:        row.route_id,
      routeShortName: row.route_short_name,
      routeLongName:  row.route_long_name,
      routeType:      row.route_type,
      routeColor:     row.route_color      ? `#${row.route_color}`      : null,
      routeTextColor: row.route_text_color ? `#${row.route_text_color}` : null,
      headsign:       row.trip_headsign,
      directionId:    row.direction_id,
      scheduledTime,
      realtimeTime:   null,
      waitMinutes,
      delayMinutes:   null,
      dataType:       'scheduled',
      status:         'scheduled',
      canceled:       false,
      nextDay:        isNextDay || depSec >= 86400,
      nextDayDate:    isNextDay ? nextDayDate : (depSec >= 86400 ? nextDayLabel : null),
    };
  };

  const arrivals = [
    ...todayRows.map(r    => toArrival(r, false, null)),
    ...overnightRows.map(r => toArrival(r, false, null)),
    ...nextDayRows.map(r   => toArrival(r, true,  nextDayLabel)),
  ]
    .filter(a => a.waitMinutes >= 0)
    .sort((a, b) => a.waitMinutes - b.waitMinutes)
    .slice(0, limit);

  // ── Range label ──────────────────────────────────────────────────────────
  const fmtDatetime = (dStr, sec) => {
    const totalMin = Math.floor(sec / 60);
    const hStr = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
    const mStr = String(totalMin % 60).padStart(2, '0');
    const [y, mo, d] = dStr.split('-');
    return `${d}/${mo}/${y} ${hStr}:${mStr}`;
  };

  const rangeFromStr = fmtDatetime(dateStr, startSec);
  const endDateStr   = endSec >= 86400 ? nextDateStr : dateStr;
  const endSecNorm   = endSec >= 86400 ? endSec - 86400 : endSec;
  const rangeToStr   = fmtDatetime(endDateStr, endSecNorm);

  return {
    stopId,
    arrivals,
    rangeFrom:         rangeFromStr,
    rangeTo:           rangeToStr,
    realtimeAvailable: false,
    realtimeStatus:    'disabled',
    source:            'gtfs-static',
    generatedAt:       new Date().toISOString(),
  };
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
  const limit     = Math.min(parseInt(req.query.limit)    || MAX_ARRIVALS, 30);
  // Lookahead fino al prossimo mezzogiorno (≤24h): evita finestre eccessive dopo mezzanotte
  const maxLookahead = minutesUntilNextNoon();
  const lookahead = Math.min(parseInt(req.query.lookahead) || maxLookahead, maxLookahead);

  // ── Modalità ricerca per data/ora specifica ──────────────────────────────
  if (req.query.date && req.query.time) {
    const cacheKey = `scheduled:${stopId}:${req.query.date}:${req.query.time}`;
    try {
      const result = await withCache('arrivals', cacheKey, () =>
        getScheduledForWindow(stopId, limit, req.query.date, req.query.time)
      );
      return res.json(result);
    } catch (err) {
      console.error('[arrivals/:stopId scheduled]', err);
      return res.status(500).json({ error: 'Errore nel calcolo degli arrivi programmati' });
    }
  }

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
