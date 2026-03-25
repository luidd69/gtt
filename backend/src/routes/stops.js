/**
 * routes/stops.js
 * Endpoint API per la ricerca e il dettaglio delle fermate.
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { withCache } = require('../utils/cache');
const { haversineDistance, getBoundingBox } = require('../utils/geo');

const MAX_NEARBY = 20;
const MAX_SEARCH = 30;

/**
 * GET /api/stops/search?q=<query>
 * Ricerca fermate per nome o codice.
 * Restituisce al massimo MAX_SEARCH risultati.
 */
router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();

  if (q.length < 2) {
    return res.json({ stops: [] });
  }

  const cacheKey = `search:${q.toLowerCase()}`;

  const result = withCache('stops', cacheKey, async () => {
    const db = getDb();

    // Cerca per codice fermata (match esatto) o nome (LIKE)
    const stops = db.prepare(`
      SELECT
        s.stop_id,
        s.stop_code,
        s.stop_name,
        s.stop_lat,
        s.stop_lon,
        COUNT(DISTINCT st.trip_id) AS trip_count
      FROM stops s
      LEFT JOIN stop_times st ON st.stop_id = s.stop_id
      WHERE (s.location_type = 0 OR s.location_type = '' OR s.location_type IS NULL)
        AND (
          s.stop_code = ?
          OR s.stop_name LIKE ? ESCAPE '\\'
        )
      GROUP BY s.stop_id
      ORDER BY
        CASE WHEN s.stop_code = ? THEN 0 ELSE 1 END,
        trip_count DESC,
        s.stop_name
      LIMIT ?
    `).all(q, `%${q.replace(/[%_]/g, '\\$&')}%`, q, MAX_SEARCH);

    return { stops };
  });

  result.then(data => res.json(data)).catch(err => {
    console.error('[stops/search]', err);
    res.status(500).json({ error: 'Errore nella ricerca fermate' });
  });
});

/**
 * GET /api/stops/nearby?lat=<lat>&lon=<lon>&radius=<km>
 * Fermate vicine ordinate per distanza.
 */
router.get('/nearby', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const radiusKm = Math.min(parseFloat(req.query.radius) || 0.5, 2); // max 2km

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Coordinate non valide' });
  }

  const cacheKey = `nearby:${lat.toFixed(4)}:${lon.toFixed(4)}:${radiusKm}`;

  const result = withCache('nearby', cacheKey, async () => {
    const db = getDb();
    const bbox = getBoundingBox(lat, lon, radiusKm);

    // Pre-filtra con bounding box (veloce, usa l'indice lat/lon)
    const candidates = db.prepare(`
      SELECT stop_id, stop_code, stop_name, stop_lat, stop_lon
      FROM stops
      WHERE (location_type = 0 OR location_type = '' OR location_type IS NULL)
        AND stop_lat BETWEEN ? AND ?
        AND stop_lon BETWEEN ? AND ?
    `).all(bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon);

    // Filtra esatto con Haversine e ordina per distanza
    const nearby = candidates
      .map(s => ({
        ...s,
        distanceKm: haversineDistance(lat, lon, s.stop_lat, s.stop_lon),
      }))
      .filter(s => s.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, MAX_NEARBY)
      .map(s => ({
        ...s,
        distanceM: Math.round(s.distanceKm * 1000),
      }));

    return { stops: nearby };
  });

  result.then(data => res.json(data)).catch(err => {
    console.error('[stops/nearby]', err);
    res.status(500).json({ error: 'Errore nel recupero fermate vicine' });
  });
});

/**
 * GET /api/stops/:stopId
 * Dettaglio di una fermata: info + linee servite.
 */
router.get('/:stopId', (req, res) => {
  const { stopId } = req.params;
  const cacheKey = `detail:${stopId}`;

  const result = withCache('stops', cacheKey, async () => {
    const db = getDb();

    const stop = db.prepare(`
      SELECT stop_id, stop_code, stop_name, stop_lat, stop_lon,
             location_type, parent_station
      FROM stops
      WHERE stop_id = ?
    `).get(stopId);

    if (!stop) {
      return null;
    }

    // Linee che servono questa fermata
    const routes = db.prepare(`
      SELECT DISTINCT
        r.route_id,
        r.route_short_name,
        r.route_long_name,
        r.route_type,
        r.route_color,
        r.route_text_color
      FROM routes r
      JOIN trips t ON t.route_id = r.route_id
      JOIN stop_times st ON st.trip_id = t.trip_id
      WHERE st.stop_id = ?
      ORDER BY r.route_type, r.route_short_name
    `).all(stopId);

    return { stop, routes };
  });

  result.then(data => {
    if (!data) return res.status(404).json({ error: 'Fermata non trovata' });
    res.json(data);
  }).catch(err => {
    console.error('[stops/:id]', err);
    res.status(500).json({ error: 'Errore nel recupero fermata' });
  });
});

module.exports = router;
