/**
 * parser.js
 * Parser GTFS leggero e ottimizzato.
 * Legge i file CSV dal feed GTFS e li importa in SQLite
 * con insert batch per performance massima.
 */

const { parse } = require('csv-parse/sync');
const { getDb, clearGtfsTables } = require('../db/database');

// Dimensione batch per gli insert (ottimizzata per SQLite)
const BATCH_SIZE = 2000;

/**
 * Esegue insert batch in una transazione.
 * @param {Object} db - Istanza better-sqlite3
 * @param {string} tableName - Nome tabella
 * @param {Array} rows - Righe da inserire
 * @param {Array} columns - Colonne da inserire
 */
function batchInsert(db, tableName, rows, columns) {
  if (!rows.length) return;

  const placeholders = columns.map(() => '?').join(', ');
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
  );

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      stmt.run(columns.map(col => item[col] ?? null));
    }
  });

  // Processa in batch da BATCH_SIZE
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    insertMany(rows.slice(i, i + BATCH_SIZE));
  }
}

/**
 * Legge e parsa un file CSV GTFS.
 */
function parseCsv(content) {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true, // alcuni feed GTT hanno BOM UTF-8
  });
}

/**
 * Importa tutti i file GTFS nel database SQLite.
 * @param {Object} files - Mappa { 'stops.txt': Buffer, ... }
 */
function importGtfs(files) {
  const db = getDb();

  console.log('[GTFS] Pulizia tabelle precedenti...');
  clearGtfsTables();

  // ---- agency.txt ----
  if (files['agency.txt']) {
    console.log('[GTFS] Importazione agency...');
    const rows = parseCsv(files['agency.txt'].toString('utf8'));
    batchInsert(db, 'agency', rows, [
      'agency_id', 'agency_name', 'agency_url', 'agency_timezone',
    ]);
    console.log(`[GTFS]   ${rows.length} agenzie`);
  }

  // ---- stops.txt ----
  if (files['stops.txt']) {
    console.log('[GTFS] Importazione fermate...');
    const rows = parseCsv(files['stops.txt'].toString('utf8'));
    batchInsert(db, 'stops', rows, [
      'stop_id', 'stop_code', 'stop_name',
      'stop_lat', 'stop_lon', 'location_type', 'parent_station',
    ]);
    console.log(`[GTFS]   ${rows.length} fermate`);
  }

  // ---- routes.txt ----
  if (files['routes.txt']) {
    console.log('[GTFS] Importazione linee...');
    const rows = parseCsv(files['routes.txt'].toString('utf8'));
    batchInsert(db, 'routes', rows, [
      'route_id', 'agency_id', 'route_short_name', 'route_long_name',
      'route_type', 'route_color', 'route_text_color', 'route_desc',
    ]);
    console.log(`[GTFS]   ${rows.length} linee`);
  }

  // ---- trips.txt ----
  if (files['trips.txt']) {
    console.log('[GTFS] Importazione corse...');
    const rows = parseCsv(files['trips.txt'].toString('utf8'));
    batchInsert(db, 'trips', rows, [
      'trip_id', 'route_id', 'service_id',
      'trip_headsign', 'direction_id', 'shape_id',
    ]);
    console.log(`[GTFS]   ${rows.length} corse`);
  }

  // ---- calendar.txt ----
  if (files['calendar.txt']) {
    console.log('[GTFS] Importazione calendario...');
    const rows = parseCsv(files['calendar.txt'].toString('utf8'));
    batchInsert(db, 'calendar', rows, [
      'service_id', 'monday', 'tuesday', 'wednesday',
      'thursday', 'friday', 'saturday', 'sunday',
      'start_date', 'end_date',
    ]);
    console.log(`[GTFS]   ${rows.length} servizi`);
  }

  // ---- calendar_dates.txt ----
  if (files['calendar_dates.txt']) {
    console.log('[GTFS] Importazione eccezioni calendario...');
    const rows = parseCsv(files['calendar_dates.txt'].toString('utf8'));
    batchInsert(db, 'calendar_dates', rows, [
      'service_id', 'date', 'exception_type',
    ]);
    console.log(`[GTFS]   ${rows.length} eccezioni`);
  }

  // ---- stop_times.txt — file più grande, importato in streaming ----
  if (files['stop_times.txt']) {
    console.log('[GTFS] Importazione orari fermate (file grande)...');
    const rows = parseCsv(files['stop_times.txt'].toString('utf8'));
    batchInsert(db, 'stop_times', rows, [
      'trip_id', 'arrival_time', 'departure_time',
      'stop_id', 'stop_sequence', 'stop_headsign',
      'pickup_type', 'drop_off_type',
    ]);
    console.log(`[GTFS]   ${rows.length} orari`);
  }

  // Salva metadata caricamento
  db.prepare(
    "INSERT OR REPLACE INTO gtfs_meta (key, value) VALUES ('loaded_at', ?)"
  ).run(new Date().toISOString());

  console.log('[GTFS] Importazione completata');
}

module.exports = { importGtfs };
