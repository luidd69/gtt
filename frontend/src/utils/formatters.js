/**
 * formatters.js
 * Funzioni di formattazione per dati GTFS da mostrare all'utente.
 */

/**
 * Tipo GTFS → etichetta + classe CSS.
 */
export const ROUTE_TYPE_INFO = {
  0: { label: 'Tram',        cssClass: 'tram',  emoji: '🚃' },
  1: { label: 'Metro',       cssClass: 'metro', emoji: '🚇' },
  2: { label: 'Ferrovia',    cssClass: 'rail',  emoji: '🚆' },
  3: { label: 'Bus',         cssClass: 'bus',   emoji: '🚌' },
  7: { label: 'Funicolare',  cssClass: 'bus',   emoji: '🚡' },
};

export function getRouteTypeInfo(type) {
  return ROUTE_TYPE_INFO[type] ?? { label: 'Linea', cssClass: 'bus', emoji: '🚌' };
}

/**
 * Formatta i minuti di attesa in testo leggibile.
 * < 1 min → "In partenza"
 * 1-59 min → "X min"
 * ≥ 60 min → orario
 */
export function formatWait(minutes, scheduledTime) {
  if (minutes === null || minutes === undefined) return '--';
  if (minutes < 1) return 'In partenza';
  if (minutes < 60) return `${minutes} min`;
  // Oltre 1 ora: mostra l'orario
  return scheduledTime ?? `${minutes} min`;
}

/**
 * Formatta i minuti di ritardo.
 */
export function formatDelay(delayMinutes) {
  if (delayMinutes === null || delayMinutes === undefined) return null;
  if (delayMinutes === 0) return 'In orario';
  if (delayMinutes > 0) return `+${delayMinutes} min`;
  return `${delayMinutes} min`; // anticipo (raro)
}

/**
 * Formatta la distanza in metri o km.
 */
export function formatDistance(meters) {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Colore di sfondo per il chip linea.
 * Usa il colore GTFS se disponibile, altrimenti il default per tipo.
 */
export function getRouteChipStyle(route) {
  if (route.routeColor || route.color) {
    const bg = route.routeColor || route.color;
    const text = route.routeTextColor || route.textColor || '#FFFFFF';
    return { backgroundColor: bg, color: text };
  }
  return null; // usa le classi CSS .metro / .tram / .bus
}

/**
 * Tronca il nome headsign a lunghezza massima.
 */
export function truncateHeadsign(headsign, max = 25) {
  if (!headsign) return '';
  return headsign.length > max ? headsign.substring(0, max) + '…' : headsign;
}

/**
 * Pulisce il nome fermata GTT.
 * Il feed GTT usa il formato "Fermata XXX - NOME STRADA".
 * Questa funzione estrae solo "NOME STRADA" formattato in Title Case.
 * Es: "Fermata 252 - PORTA NUOVA" → "Porta Nuova"
 */
export function formatStopName(rawName) {
  if (!rawName) return '';
  const str = typeof rawName === 'string' ? rawName : String(rawName);
  const match = str.match(/Fermata \d+ - (.+)$/i);
  if (match) {
    return match[1]
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  return str;
}

/**
 * Estrae il codice numerico dal nome fermata GTT.
 * Es: "Fermata 252 - PORTA NUOVA" → "252"
 */
export function extractStopCode(rawName, fallback = '') {
  if (!rawName) return fallback;
  const str = typeof rawName === 'string' ? rawName : String(rawName);
  const match = str.match(/Fermata (\d+)/i);
  return match ? match[1] : fallback;
}
