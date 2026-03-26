/**
 * mqtt.js
 * Posizioni veicoli in tempo reale via MQTT WebSocket (5T Torino).
 *
 * Broker: wss://mapi.5t.torino.it/scre
 * Topic:  /<route_short_name>/<vehicle_id>
 * Payload: [lat, lon, heading_deg, speed_kmh, trip_id, direction_id, next_stop_id]
 */

const mqtt = require('mqtt');

const BROKER_URL  = 'wss://mapi.5t.torino.it/scre';
const TOPIC       = '#';
const STALE_MS    = 90_000;   // veicoli non aggiornati da > 90s → scartati
const RECONNECT_S = 10;       // secondi tra tentativi di riconnessione

// Store principale: vehicleKey (`routeShortName:vehicleId`) → vehicle object
const store = new Map();

let client     = null;
let _connected = false;
let _lastMsgAt = null;

// ─── Parser payload ───────────────────────────────────────────────────────────

function parseTopic(topic) {
  // topic = "/<route_short_name>/<vehicle_id>" oppure "<route_short_name>/<vehicle_id>"
  const parts = topic.replace(/^\//, '').split('/');
  if (parts.length < 2) return null;
  return { routeShortName: parts[0], vehicleId: parts[1] };
}

function parsePayload(buf) {
  try {
    const arr = JSON.parse(buf.toString());
    if (!Array.isArray(arr) || arr.length < 6) return null;
    const [lat, lon, heading, speed, tripId, directionId, nextStopId] = arr;
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    return { lat, lon, heading: heading ?? null, speed: speed ?? null, tripId: tripId ?? null, directionId: directionId ?? null, nextStopId: nextStopId ?? null };
  } catch {
    return null;
  }
}

// ─── Connessione ──────────────────────────────────────────────────────────────

function connect() {
  if (client) return;

  console.log('[MQTT] Connessione a', BROKER_URL);

  client = mqtt.connect(BROKER_URL, {
    clientId:        `gtt-webapp-${Math.random().toString(16).slice(2, 10)}`,
    connectTimeout:  10_000,
    reconnectPeriod: RECONNECT_S * 1000,
    keepalive:       60,
    clean:           true,
  });

  client.on('connect', () => {
    _connected = true;
    console.log('[MQTT] Connesso. Sottoscrizione a', TOPIC);
    client.subscribe(TOPIC, { qos: 0 }, (err) => {
      if (err) console.error('[MQTT] Errore sottoscrizione:', err.message);
    });
  });

  client.on('message', (topic, payload) => {
    const t = parseTopic(topic);
    const p = parsePayload(payload);
    if (!t || !p) return;

    _lastMsgAt = Date.now();
    const key = `${t.routeShortName}:${t.vehicleId}`;
    store.set(key, {
      id:             key,
      vehicleId:      t.vehicleId,
      routeShortName: t.routeShortName,
      lat:            p.lat,
      lon:            p.lon,
      bearing:        p.heading,
      speed:          p.speed,
      tripId:         p.tripId != null ? String(p.tripId) : null,
      directionId:    p.directionId,
      nextStopId:     p.nextStopId != null ? String(p.nextStopId) : null,
      updatedAt:      _lastMsgAt,
    });
  });

  client.on('reconnect', () => {
    _connected = false;
    console.log('[MQTT] Riconnessione in corso...');
  });

  client.on('offline',  () => { _connected = false; });
  client.on('error',    (e) => console.error('[MQTT] Errore:', e.message));
}

// ─── Pulizia veicoli stale ────────────────────────────────────────────────────

function pruneStale() {
  const cutoff = Date.now() - STALE_MS;
  for (const [key, v] of store) {
    if (v.updatedAt < cutoff) store.delete(key);
  }
}

// ─── API pubblica ─────────────────────────────────────────────────────────────

/**
 * Restituisce tutte le posizioni fresche (< 90s), arricchite con
 * i dati di linea dal DB (colore, tipo, nome lungo).
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {object[]}
 */
function getVehicles(db) {
  pruneStale();
  if (!store.size) return [];

  // Carica info route in blocco per evitare N query
  const routeCache = {};
  const getRoute = (shortName) => {
    if (routeCache[shortName] !== undefined) return routeCache[shortName];
    const r = db.prepare(
      'SELECT route_id, route_short_name, route_long_name, route_type, route_color, route_text_color FROM routes WHERE route_short_name = ? LIMIT 1'
    ).get(shortName);
    return (routeCache[shortName] = r || null);
  };

  return [...store.values()].map(v => {
    const r = getRoute(v.routeShortName);
    return {
      id:             v.id,
      vehicleId:      v.vehicleId,
      tripId:         v.tripId,
      routeId:        r?.route_id        || null,
      routeShortName: r?.route_short_name || v.routeShortName,
      routeLongName:  r?.route_long_name  || null,
      routeType:      r?.route_type       ?? 3,
      routeColor:     r?.route_color      ? `#${r.route_color}`      : null,
      routeTextColor: r?.route_text_color ? `#${r.route_text_color}` : null,
      lat:            v.lat,
      lon:            v.lon,
      bearing:        v.bearing,
      speed:          v.speed,
      directionId:    v.directionId,
      nextStopId:     v.nextStopId,
      currentStatus:  'In transito',
      estimated:      false,
      timestamp:      new Date(v.updatedAt).toISOString(),
    };
  });
}

function isConnected()  { return _connected; }
function vehicleCount() { return store.size; }
function lastMessageAt(){ return _lastMsgAt; }

module.exports = { connect, getVehicles, isConnected, vehicleCount, lastMessageAt };
