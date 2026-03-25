/**
 * database.js
 * Gestione connessione SQLite e schema GTFS.
 * Usa better-sqlite3 (sincrono, ottimo per read-heavy workload).
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/gtt.db');

let db = null;

/**
 * Restituisce la connessione singleton al database.
 */
function getDb() {
  if (!db) {
    // Assicura che la directory esista
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

    db = new Database(DB_PATH, {
      // verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    });

    // Ottimizzazioni SQLite per performance in lettura
    db.pragma('journal_mode = WAL');
    db.pragma('cache_size = -32000');   // ~32 MB di cache
    db.pragma('synchronous = NORMAL');
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 268435456'); // 256 MB memory-mapped I/O
  }
  return db;
}

/**
 * Crea lo schema GTFS se non esiste.
 * Segue le specifiche GTFS 2.0.
 */
function initSchema() {
  const db = getDb();

  db.exec(`
    -- Informazioni agenzia
    CREATE TABLE IF NOT EXISTS agency (
      agency_id      TEXT PRIMARY KEY,
      agency_name    TEXT NOT NULL,
      agency_url     TEXT,
      agency_timezone TEXT
    );

    -- Fermate (stops)
    CREATE TABLE IF NOT EXISTS stops (
      stop_id        TEXT PRIMARY KEY,
      stop_code      TEXT,
      stop_name      TEXT NOT NULL,
      stop_lat       REAL,
      stop_lon       REAL,
      location_type  INTEGER DEFAULT 0,
      parent_station TEXT
    );

    -- Linee (routes)
    CREATE TABLE IF NOT EXISTS routes (
      route_id         TEXT PRIMARY KEY,
      agency_id        TEXT,
      route_short_name TEXT,
      route_long_name  TEXT,
      route_type       INTEGER NOT NULL,
      route_color      TEXT,
      route_text_color TEXT,
      route_desc       TEXT
    );

    -- Corse (trips)
    CREATE TABLE IF NOT EXISTS trips (
      trip_id       TEXT PRIMARY KEY,
      route_id      TEXT NOT NULL,
      service_id    TEXT NOT NULL,
      trip_headsign TEXT,
      direction_id  INTEGER DEFAULT 0,
      shape_id      TEXT
    );

    -- Orari alle fermate (stop_times) — tabella più grande del GTFS
    CREATE TABLE IF NOT EXISTS stop_times (
      trip_id          TEXT NOT NULL,
      arrival_time     TEXT NOT NULL,
      departure_time   TEXT NOT NULL,
      stop_id          TEXT NOT NULL,
      stop_sequence    INTEGER NOT NULL,
      stop_headsign    TEXT,
      pickup_type      INTEGER DEFAULT 0,
      drop_off_type    INTEGER DEFAULT 0,
      PRIMARY KEY (trip_id, stop_sequence)
    );

    -- Calendario servizi (giorni attivi)
    CREATE TABLE IF NOT EXISTS calendar (
      service_id TEXT PRIMARY KEY,
      monday     INTEGER NOT NULL,
      tuesday    INTEGER NOT NULL,
      wednesday  INTEGER NOT NULL,
      thursday   INTEGER NOT NULL,
      friday     INTEGER NOT NULL,
      saturday   INTEGER NOT NULL,
      sunday     INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date   TEXT NOT NULL
    );

    -- Eccezioni calendario (festivi, scioperi, ecc.)
    CREATE TABLE IF NOT EXISTS calendar_dates (
      service_id     TEXT NOT NULL,
      date           TEXT NOT NULL,
      exception_type INTEGER NOT NULL,
      PRIMARY KEY (service_id, date)
    );

    -- Metadata caricamento GTFS
    CREATE TABLE IF NOT EXISTS gtfs_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Indici critici per le query più frequenti
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_stop_times_stop_id
      ON stop_times (stop_id, departure_time);

    CREATE INDEX IF NOT EXISTS idx_stop_times_trip_id
      ON stop_times (trip_id, stop_sequence);

    CREATE INDEX IF NOT EXISTS idx_trips_route_id
      ON trips (route_id);

    CREATE INDEX IF NOT EXISTS idx_trips_service_id
      ON trips (service_id);

    CREATE INDEX IF NOT EXISTS idx_routes_type
      ON routes (route_type);

    CREATE INDEX IF NOT EXISTS idx_stops_name
      ON stops (stop_name COLLATE NOCASE);

    CREATE INDEX IF NOT EXISTS idx_stops_code
      ON stops (stop_code);

    CREATE INDEX IF NOT EXISTS idx_stops_location
      ON stops (stop_lat, stop_lon);
  `);

  console.log('[DB] Schema inizializzato');
}

/**
 * Verifica se il database contiene dati GTFS caricati.
 */
function isGtfsLoaded() {
  const db = getDb();
  const row = db.prepare(
    "SELECT value FROM gtfs_meta WHERE key = 'loaded_at'"
  ).get();
  return !!row;
}

/**
 * Svuota tutte le tabelle GTFS (prima di un reload).
 */
function clearGtfsTables() {
  const db = getDb();
  const tables = [
    'stop_times', 'trips', 'calendar_dates', 'calendar',
    'routes', 'stops', 'agency', 'gtfs_meta',
  ];
  db.exec('BEGIN');
  tables.forEach(t => db.exec(`DELETE FROM ${t}`));
  db.exec('COMMIT');
}

module.exports = { getDb, initSchema, isGtfsLoaded, clearGtfsTables };
