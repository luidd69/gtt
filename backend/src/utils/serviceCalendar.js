/**
 * serviceCalendar.js
 * Utility condivisa per il calcolo dei service_id attivi oggi.
 * Usata da arrivals.js e journey.js per evitare duplicazione.
 */

const {
  todayGtfsDate,
  todayWeekdayField,
} = require('./time');

/**
 * Trova i service_id validi per oggi.
 * Combina calendar (schema settimanale) + calendar_dates (eccezioni, festivi, scioperi).
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {string[]} Array di service_id attivi oggi
 */
function getActiveServiceIds(db) {
  const today = todayGtfsDate();
  const weekday = todayWeekdayField();

  // Servizi attivi per il giorno della settimana nel range di date valido
  const regularServices = db.prepare(`
    SELECT service_id FROM calendar
    WHERE ${weekday} = 1
      AND start_date <= ?
      AND end_date >= ?
  `).all(today, today).map(r => r.service_id);

  // Eccezioni: servizi aggiunti (exception_type=1) solo per oggi
  // (es. servizio domenicale attivato un sabato)
  const addedServices = db.prepare(`
    SELECT service_id FROM calendar_dates
    WHERE date = ? AND exception_type = 1
  `).all(today).map(r => r.service_id);

  // Eccezioni: servizi rimossi (exception_type=2) solo per oggi
  // (es. sciopero, festività)
  const removedServices = new Set(
    db.prepare(`
      SELECT service_id FROM calendar_dates
      WHERE date = ? AND exception_type = 2
    `).all(today).map(r => r.service_id)
  );

  // Unione: (regolari + aggiunti) - rimossi
  const active = new Set([...regularServices, ...addedServices]);
  for (const removed of removedServices) active.delete(removed);

  return Array.from(active);
}

module.exports = { getActiveServiceIds };
