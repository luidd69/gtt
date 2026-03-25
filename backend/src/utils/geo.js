/**
 * geo.js
 * Calcoli geografici per la ricerca fermate vicine.
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Calcola la distanza tra due coordinate geografiche (formula Haversine).
 * @returns {number} Distanza in chilometri
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = deg => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Calcola il bounding box per una ricerca geografica veloce.
 * Prima di usare Haversine (costosa), SQLite filtra per lat/lon range.
 * @param {number} lat - Latitudine centro
 * @param {number} lon - Longitudine centro
 * @param {number} radiusKm - Raggio in km
 */
function getBoundingBox(lat, lon, radiusKm) {
  const latDelta = radiusKm / EARTH_RADIUS_KM * (180 / Math.PI);
  const lonDelta = radiusKm / (EARTH_RADIUS_KM * Math.cos(lat * Math.PI / 180)) * (180 / Math.PI);

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}

module.exports = { haversineDistance, getBoundingBox };
