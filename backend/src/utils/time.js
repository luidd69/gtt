/**
 * time.js
 * Utilità per la gestione degli orari GTFS.
 *
 * Nel formato GTFS, gli orari possono superare le 24:00:00
 * per indicare corse che attraversano la mezzanotte
 * (es. 25:30:00 = 01:30 del giorno successivo).
 */

/**
 * Converte un orario GTFS (HH:MM:SS) in secondi dalla mezzanotte.
 * Gestisce orari > 24h (corse notturne).
 */
function gtfsTimeToSeconds(timeStr) {
  if (!timeStr) return null;
  const [h, m, s] = timeStr.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
}

/**
 * Converte secondi dalla mezzanotte in stringa HH:MM.
 */
function secondsToHHMM(seconds) {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const TZ = 'Europe/Rome';

/**
 * Estrae le parti data/ora nel fuso orario italiano (CET/CEST).
 */
function italyParts(now = new Date()) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, weekday: 'long',
    }).formatToParts(now).map(p => [p.type, p.value])
  );
}

/**
 * Restituisce i secondi dalla mezzanotte per l'ora corrente (fuso italiano).
 */
function nowInSeconds() {
  const p = italyParts();
  return parseInt(p.hour) * 3600 + parseInt(p.minute) * 60 + parseInt(p.second);
}

/**
 * Restituisce la data odierna in formato YYYYMMDD (usato da GTFS), fuso italiano.
 */
function todayGtfsDate() {
  const p = italyParts();
  return `${p.year}${p.month}${p.day}`;
}

/**
 * Restituisce il giorno della settimana come campo GTFS calendar (fuso italiano).
 * (es. 'monday', 'tuesday', ...)
 */
function todayWeekdayField() {
  return italyParts().weekday.toLowerCase();
}

/**
 * Calcola i minuti di attesa da ora a un orario GTFS.
 * @param {string} departureTime - es. "08:35:00"
 * @returns {number} minuti (negativo se già passato)
 */
function minutesUntil(departureTime) {
  const now = nowInSeconds();
  const dep = gtfsTimeToSeconds(departureTime);
  if (dep === null) return null;
  return Math.round((dep - now) / 60);
}

module.exports = {
  gtfsTimeToSeconds,
  secondsToHHMM,
  nowInSeconds,
  todayGtfsDate,
  todayWeekdayField,
  minutesUntil,
};
