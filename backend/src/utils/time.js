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

/**
 * Restituisce i secondi dalla mezzanotte per l'ora corrente.
 */
function nowInSeconds() {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

/**
 * Restituisce la data odierna in formato YYYYMMDD (usato da GTFS).
 */
function todayGtfsDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Restituisce il giorno della settimana come campo GTFS calendar.
 * (es. 'monday', 'tuesday', ...)
 */
function todayWeekdayField() {
  const days = [
    'sunday', 'monday', 'tuesday', 'wednesday',
    'thursday', 'friday', 'saturday',
  ];
  return days[new Date().getDay()];
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
