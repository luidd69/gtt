/**
 * routes/lines.js
 * Endpoint API per la consultazione delle linee GTT.
 * Linee divise per tipo: metro (1), tram (0), bus (3).
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { withCache } = require('../utils/cache');

// Mappa route_type GTFS → etichetta leggibile
const ROUTE_TYPE_LABELS = {
  0: 'Tram',
  1: 'Metro',
  2: 'Ferrovia',
  3: 'Bus',
  7: 'Funicolare',
};

/**
 * GET /api/lines
 * Elenco di tutte le linee, raggruppate per tipo.
 * Opzionali: ?type=1 (solo metro), ?type=3 (solo bus), ecc.
 */
router.get('/', (req, res) => {
  const typeFilter = req.query.type !== undefined
    ? parseInt(req.query.type)
    : null;

  const cacheKey = `list:${typeFilter ?? 'all'}`;

  const result = withCache('lines', cacheKey, async () => {
    const db = getDb();

    const whereClause = typeFilter !== null
      ? 'WHERE route_type = ?'
      : '';
    const params = typeFilter !== null ? [typeFilter] : [];

    const routes = db.prepare(`
      SELECT
        r.route_id,
        r.route_short_name,
        r.route_long_name,
        r.route_type,
        r.route_color,
        r.route_text_color,
        r.route_desc,
        COUNT(DISTINCT t.trip_id) AS trip_count
      FROM routes r
      LEFT JOIN trips t ON t.route_id = r.route_id
      ${whereClause}
      GROUP BY r.route_id
      ORDER BY r.route_type, CAST(r.route_short_name AS INTEGER), r.route_short_name
    `).all(...params);

    // Raggruppa per tipo
    const grouped = {};
    for (const route of routes) {
      const type = route.route_type;
      if (!grouped[type]) {
        grouped[type] = {
          type,
          label: ROUTE_TYPE_LABELS[type] || `Tipo ${type}`,
          routes: [],
        };
      }
      grouped[type].routes.push({
        ...route,
        color: route.route_color ? `#${route.route_color}` : null,
        textColor: route.route_text_color ? `#${route.route_text_color}` : null,
      });
    }

    return {
      lines: Object.values(grouped),
      total: routes.length,
    };
  });

  result.then(data => res.json(data)).catch(err => {
    console.error('[lines]', err);
    res.status(500).json({ error: 'Errore nel recupero linee' });
  });
});

/**
 * GET /api/lines/:routeId
 * Dettaglio linea: info, direzioni e fermate principali.
 */
router.get('/:routeId', (req, res) => {
  const { routeId } = req.params;
  const cacheKey = `detail:${routeId}`;

  const result = withCache('lines', cacheKey, async () => {
    const db = getDb();

    const route = db.prepare(`
      SELECT route_id, route_short_name, route_long_name,
             route_type, route_color, route_text_color, route_desc
      FROM routes
      WHERE route_id = ?
    `).get(routeId);

    if (!route) return null;

    // Direzioni (trip_headsign distinti per direction_id)
    const directions = db.prepare(`
      SELECT DISTINCT
        direction_id,
        trip_headsign
      FROM trips
      WHERE route_id = ?
      ORDER BY direction_id
    `).all(routeId);

    // Per ogni direzione, prendi una corsa tipo e le sue fermate in ordine
    const directionDetails = [];

    for (const dir of directions) {
      // Corsa rappresentativa per questa direzione
      const sampleTrip = db.prepare(`
        SELECT trip_id FROM trips
        WHERE route_id = ? AND direction_id = ?
        LIMIT 1
      `).get(routeId, dir.direction_id);

      if (!sampleTrip) continue;

      const stops = db.prepare(`
        SELECT
          s.stop_id,
          s.stop_code,
          s.stop_name,
          s.stop_lat,
          s.stop_lon,
          st.arrival_time,
          st.departure_time,
          st.stop_sequence
        FROM stop_times st
        JOIN stops s ON s.stop_id = st.stop_id
        WHERE st.trip_id = ?
        ORDER BY st.stop_sequence
      `).all(sampleTrip.trip_id);

      directionDetails.push({
        direction_id: dir.direction_id,
        headsign: dir.trip_headsign,
        stops,
        terminus: {
          first: stops[0] || null,
          last: stops[stops.length - 1] || null,
        },
      });
    }

    return {
      route: {
        ...route,
        color: route.route_color ? `#${route.route_color}` : null,
        textColor: route.route_text_color ? `#${route.route_text_color}` : null,
        typeLabel: ROUTE_TYPE_LABELS[route.route_type] || 'Linea',
      },
      directions: directionDetails,
    };
  });

  result.then(data => {
    if (!data) return res.status(404).json({ error: 'Linea non trovata' });
    res.json(data);
  }).catch(err => {
    console.error('[lines/:id]', err);
    res.status(500).json({ error: 'Errore nel recupero linea' });
  });
});

module.exports = router;
