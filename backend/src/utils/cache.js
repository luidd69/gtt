/**
 * cache.js
 * Cache in-memory con TTL per le risposte API.
 * Evita query SQLite ripetute per le stesse richieste.
 */

const NodeCache = require('node-cache');

// Cache separata per categoria, con TTL diversi
const caches = {
  arrivals: new NodeCache({
    stdTTL: parseInt(process.env.CACHE_TTL_ARRIVALS) || 30,
    checkperiod: 10,
  }),
  stops: new NodeCache({
    stdTTL: parseInt(process.env.CACHE_TTL_STOPS) || 300,
    checkperiod: 60,
  }),
  lines: new NodeCache({
    stdTTL: parseInt(process.env.CACHE_TTL_LINES) || 600,
    checkperiod: 120,
  }),
  nearby: new NodeCache({
    stdTTL: parseInt(process.env.CACHE_TTL_NEARBY) || 15,
    checkperiod: 5,
  }),
};

/**
 * Wrapper cache: esegue fn() se il risultato non è in cache.
 * @param {string} type - Tipo cache ('arrivals', 'stops', ...)
 * @param {string} key - Chiave univoca
 * @param {Function} fn - Funzione che produce il valore
 */
async function withCache(type, key, fn) {
  const cache = caches[type] || caches.stops;
  const cached = cache.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const result = await fn();
  cache.set(key, result);
  return result;
}

/**
 * Invalida una chiave specifica.
 */
function invalidate(type, key) {
  const cache = caches[type] || caches.stops;
  cache.del(key);
}

/**
 * Svuota tutta la cache (usato dopo reload GTFS).
 */
function clearAll() {
  Object.values(caches).forEach(c => c.flushAll());
  console.log('[Cache] Svuotata');
}

module.exports = { withCache, invalidate, clearAll };
