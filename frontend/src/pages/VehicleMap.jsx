/**
 * VehicleMap.jsx
 * Mappa in tempo reale dei veicoli GTT con Leaflet.
 *
 * Funzionalità:
 *  - Marker veicoli colorati per tipo + freccia direzione
 *  - Click marker → "Segui veicolo": la mappa si centra e insegue
 *    automaticamente il mezzo ad ogni aggiornamento (ogni 15s)
 *  - Pannello "Stai seguendo" con linea, stato, velocità, stop
 *  - Marker tracciato visivamente distinto (anello pulsante)
 *  - Fermate visibili da zoom ≥ 15, cliccabili
 *  - Filtro per tipo mezzo
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getVehicles, getNearbyStops, getTripLive, getArrivals, getStop } from '../utils/api';
import { getRouteTypeInfo } from '../utils/formatters';

const TURIN_CENTER = [45.0703, 7.6869];
const INITIAL_ZOOM  = 13;
const TRACK_ZOOM    = 16; // zoom usato quando si inizia a seguire

const TYPE_COLORS = { 0: '#007AFF', 1: '#E84B24', 3: '#34C759', 7: '#FF9500' };

function distMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getVehicleColor(v) {
  return v.routeColor || TYPE_COLORS[v.routeType] || '#6C6C70';
}

/* ── Icona SVG veicolo ────────────────────────────────────────────── */
function buildVehicleIcon(L, v, isTracked) {
  const color     = getVehicleColor(v);
  const textColor = v.routeTextColor || '#ffffff';
  const label     = v.routeShortName;
  const bearing   = v.bearing;
  const base      = v.routeType === 1 ? 34 : 30;
  const size      = isTracked ? base + 8 : base;
  const r         = size / 2 - 2;
  const cx        = size / 2;
  const rot       = bearing != null ? bearing : 0;

  // Freccia direzione
  const arrow = bearing != null
    ? `<polygon points="${cx},3 ${cx + 4},9 ${cx - 4},9"
         fill="${textColor}" opacity="0.9"
         transform="rotate(${rot},${cx},${cx})"/>`
    : '';

  // Anello pulsante per veicolo tracciato
  const ring = isTracked
    ? `<circle cx="${cx}" cy="${cx}" r="${r + 4}"
         fill="none" stroke="${color}" stroke-width="2.5" opacity="0.5">
         <animate attributeName="r" from="${r}" to="${r + 8}"
           dur="1.4s" repeatCount="indefinite"/>
         <animate attributeName="opacity" from="0.6" to="0"
           dur="1.4s" repeatCount="indefinite"/>
       </circle>`
    : '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${size + 16}" height="${size + 16}"
         viewBox="${-8} ${-8} ${size + 16} ${size + 16}" overflow="visible">
      ${ring}
      <circle cx="${cx}" cy="${cx}" r="${r}"
        fill="${color}" stroke="white" stroke-width="${isTracked ? 3 : 2}"/>
      <text x="${cx}" y="${cx + 4}" text-anchor="middle"
            font-size="${isTracked ? 10 : 9}"
            font-family="-apple-system,sans-serif" font-weight="700"
            fill="${textColor}">${label}</text>
      ${arrow}
    </svg>`;

  const total = size + 16;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize:   [total, total],
    iconAnchor: [total / 2, total / 2],
    popupAnchor:[0, -(total / 2) - 4],
  });
}

/* ── Icona fermata ────────────────────────────────────────────────── */
function buildStopIcon(L, size = 10, color = '#E84B24') {
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
    className: '',
    iconSize:   [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor:[0, -size/2 - 2],
  });
}

/* ── Popup veicolo ────────────────────────────────────────────────── */
function buildPopupHtml(v, isTracked) {
  const color = getVehicleColor(v);
  const trackBtn = !isTracked
    ? `<button onclick="window.__gttTrack('${v.id}')"
         style="margin-top:10px;width:100%;padding:8px;border:none;border-radius:8px;
                background:${color};color:white;font-weight:700;font-size:13px;cursor:pointer;">
         📍 Segui questo veicolo
       </button>`
    : `<div style="margin-top:8px;text-align:center;font-size:12px;color:${color};font-weight:600;">
         ● Stai seguendo questo veicolo
       </div>`;

  return `
    <div style="font-family:-apple-system,sans-serif;min-width:180px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="background:${color};color:white;padding:3px 10px;border-radius:100px;
                     font-weight:700;font-size:13px">${v.routeShortName}</span>
        <span style="font-size:12px;color:#6C6C70">${getRouteTypeInfo(v.routeType).label}</span>
        ${v.estimated ? '<span style="font-size:10px;color:#AEAEB2;margin-left:auto">~stimata</span>' : ''}
      </div>
      ${v.headsign || v.routeLongName
        ? `<div style="font-size:12px;color:#3C3C43;margin-bottom:6px;
                       overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">
             → ${v.headsign || v.routeLongName}
           </div>`
        : ''}
      <div style="display:flex;flex-direction:column;gap:3px;font-size:12px">
        <div><b>Stato:</b> ${v.currentStatus}</div>
        ${v.speed  != null ? `<div><b>Velocità:</b> ${v.speed} km/h</div>` : ''}
        ${v.occupancy       ? `<div><b>Occupazione:</b> ${v.occupancy}</div>` : ''}
        ${v.bearing != null ? `<div><b>Direzione:</b> ${Math.round(v.bearing)}°</div>` : ''}
      </div>
      ${v.estimated
        ? `<div style="font-size:10px;color:#AEAEB2;margin-top:6px">
             📍 Posizione calcolata da orari programmati
           </div>`
        : v.timestamp
          ? `<div style="font-size:10px;color:#AEAEB2;margin-top:4px">
               GPS · ${new Date(v.timestamp).toLocaleTimeString('it-IT')}
             </div>`
          : ''}
      ${trackBtn}
    </div>`;
}

/* ── Componente principale ────────────────────────────────────────── */
export default function VehicleMap() {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const requestedTripId = searchParams.get('tripId'); // tripId dall'arrivo cliccato
  const requestedStopId = searchParams.get('stopId'); // fermata da evidenziare

  const mapRef          = useRef(null);
  const mapElRef        = useRef(null);
  const vehicleLayerRef = useRef(null);
  const stopLayerRef    = useRef(null);
  const routeLayerRef   = useRef(null);    // percorso corsa stimata
  const leafletRef      = useRef(null);
  const markersRef      = useRef({});      // id → marker Leaflet
  const trackedIdRef    = useRef(null);    // id del veicolo tracciato
  const tripTrackedRef  = useRef(false);   // già attivato tracking per tripId (veicolo REALE)
  const routeCenteredRef = useRef(false);  // già centrato sulla rotta stimata
  const requestedStopMarkerRef = useRef(null); // marker fermata evidenziata da URL

  const [filter,        setFilter]        = useState('all');
  const [mapReady,      setMapReady]      = useState(false);
  const [trackedId,     setTrackedId]     = useState(null);
  const [trackedInfo,   setTrackedInfo]   = useState(null);
  const [tripNotFound,  setTripNotFound]  = useState(false);
  const [estimatedPos,  setEstimatedPos]  = useState(null);   // posizione stimata corsa

  // GPS utente
  const [userPos,    setUserPos]    = useState(null);       // { lat, lon, accuracy }
  const [gpsError,   setGpsError]   = useState(null);       // null | 'denied'|'unavailable'|'timeout'|'inaccurate'
  const [gpsStale,   setGpsStale]   = useState(false);      // segnale perso durante corsa attiva
  const [destAlert,  setDestAlert]  = useState(null);       // { name, dist }

  // Monitoraggio posizione utente sul percorso
  const [userRouteProgress, setUserRouteProgress] = useState(null);
  // { nearestStop:{name,lat,lon}, nearestDist:m, onRoute:bool, destDist:m|null, destName:str|null }

  // Fermata selezionata dalla ricerca → pannello arrivi
  const [selectedStop, setSelectedStop] = useState(null); // { stop_id, stop_name, stop_code }

  // Ricerca fermate sulla mappa
  const [showSearch,     setShowSearch]     = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchResults,  setSearchResults]  = useState([]);

  const watchIdRef         = useRef(null);
  const lastPosRef         = useRef(null);   // timestamp ultima posizione ricevuta
  const userMarkerRef      = useRef(null);
  const userAccCircleRef   = useRef(null);
  const highlightMarkerRef = useRef(null);
  const searchTimerRef     = useRef(null);

  /* Mantiene ref e state sincronizzati */
  const setTracked = useCallback((id, vehicleData) => {
    trackedIdRef.current = id;
    setTrackedId(id);
    setTrackedInfo(vehicleData || null);
  }, []);

  const stopTracking = useCallback(() => {
    setTracked(null, null);
    // Riapre la mappa libera
    mapRef.current?.closePopup();
  }, [setTracked]);

  /* ── Fetch veicoli ogni 30s (stimate) / 15s (GPS) ───────────────── */
  const { data: vehicleData, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['vehicles'],
    queryFn:  getVehicles,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    staleTime:       25_000,
  });

  /* ── Fetch posizione stimata per tripId da URL ───────────────────── */
  const { data: liveData } = useQuery({
    queryKey: ['trip-live', requestedTripId],
    queryFn:  () => getTripLive(requestedTripId),
    enabled:  !!requestedTripId,
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
    staleTime:       15_000,
  });

  /* ── Fetch dati fermata da evidenziare (da URL stopId) ──────────── */
  const { data: requestedStopData } = useQuery({
    queryKey: ['stop', requestedStopId],
    queryFn:  () => getStop(requestedStopId),
    enabled:  !!requestedStopId,
    staleTime: 10 * 60_000,
  });

  /* ── Fetch arrivi per fermata selezionata dalla ricerca ─────────── */
  const { data: stopArrivalsData, isLoading: arrivalsLoading } = useQuery({
    queryKey: ['stop-arrivals-map', selectedStop?.stop_id],
    queryFn:  () => getArrivals(selectedStop.stop_id, 5),
    enabled:  !!selectedStop?.stop_id,
    refetchInterval: 30_000,
    staleTime:       20_000,
  });

  /* ── Init mappa ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;

    // Guard against React StrictMode double-invocation: if the cleanup fires
    // before the dynamic import resolves, `cancelled` will be true and the
    // async callback won't try to initialize an already-removed container.
    let cancelled = false;

    import('leaflet').then(L => {
      if (cancelled || mapRef.current || !mapElRef.current) return;

      delete L.Icon.Default.prototype._getIconUrl;
      leafletRef.current = L;

      const map = L.map(mapElRef.current, {
        center: TURIN_CENTER,
        zoom:   INITIAL_ZOOM,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      routeLayerRef.current   = L.layerGroup().addTo(map);
      vehicleLayerRef.current = L.layerGroup().addTo(map);
      stopLayerRef.current    = L.layerGroup().addTo(map);

      // Quando l'utente muove la mappa manualmente, interrompe il tracking
      map.on('dragstart', () => {
        if (trackedIdRef.current) stopTracking();
      });

      map.on('moveend', () => loadStops(L, map));

      mapRef.current = map;
      setMapReady(true);
      loadStops(L, map);

      // Espone callback globale per il pulsante "Segui" dentro il popup
      window.__gttTrack = (id) => {
        const vehicles = vehicleData?.vehicles || [];
        const v = vehicles.find(x => x.id === id);
        setTracked(id, v || null);
        map.closePopup();
      };
    });

    return () => {
      cancelled = true;
      clearTimeout(searchTimerRef.current);
      delete window.__gttTrack;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []); // eslint-disable-line

  /* ── GPS utente ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError('unavailable');
      return;
    }
    // Ottimizzazione batteria: alta precisione solo durante monitoraggio corsa
    const highAccuracy = !!requestedTripId;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        lastPosRef.current = Date.now();
        setGpsStale(false);
        setUserPos({ lat, lon, accuracy });
        setGpsError(accuracy > 150 ? 'inaccurate' : null);
      },
      (err) => {
        const codes = { 1: 'denied', 2: 'unavailable', 3: 'timeout' };
        setGpsError(codes[err.code] || 'unavailable');
      },
      { enableHighAccuracy: highAccuracy, timeout: 12000, maximumAge: highAccuracy ? 5000 : 15000 }
    );
    // Rileva perdita segnale durante corsa attiva (>30s senza aggiornamenti)
    const staleCheck = setInterval(() => {
      if (lastPosRef.current && Date.now() - lastPosRef.current > 30000 && requestedTripId) {
        setGpsStale(true);
      }
    }, 10000);
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      clearInterval(staleCheck);
    };
  }, [requestedTripId]);

  /* ── Marker posizione utente ─────────────────────────────────────── */
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !userPos) return;
    const latlng = [userPos.lat, userPos.lon];
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(latlng);
      userAccCircleRef.current?.setLatLng(latlng).setRadius(userPos.accuracy);
    } else {
      const icon = L.divIcon({
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 0 0 5px rgba(37,99,235,0.25)"></div>`,
        className: '', iconSize: [18, 18], iconAnchor: [9, 9],
      });
      userMarkerRef.current = L.marker(latlng, { icon, zIndexOffset: 2000 })
        .bindTooltip('La tua posizione', { direction: 'top', offset: [0, -12] })
        .addTo(map);
      if (userPos.accuracy < 500) {
        userAccCircleRef.current = L.circle(latlng, {
          radius: userPos.accuracy, color: '#2563EB',
          fillColor: '#2563EB', fillOpacity: 0.08, weight: 1,
        }).addTo(map);
      }
    }
  }, [userPos]);

  /* ── Marker fermata evidenziata da URL ──────────────────────────── */
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !requestedStopData?.stop) return;

    const stop = requestedStopData.stop;
    if (!stop.stop_lat || !stop.stop_lon) return;

    if (requestedStopMarkerRef.current) {
      requestedStopMarkerRef.current.remove();
      requestedStopMarkerRef.current = null;
    }

    const stopName = stop.stop_name?.replace(/Fermata \d+ - /i, '') || stop.stop_name;

    const icon = L.divIcon({
      html: `<div style="
        width:22px;height:22px;border-radius:50%;
        background:#FF3D20;border:3px solid white;
        box-shadow:0 0 0 7px rgba(255,61,32,0.25),0 2px 8px rgba(0,0,0,0.4);
      "></div>`,
      className: '',
      iconSize:   [22, 22],
      iconAnchor: [11, 11],
    });

    requestedStopMarkerRef.current = L.marker(
      [stop.stop_lat, stop.stop_lon],
      { icon, zIndexOffset: 2500 }
    )
      .bindTooltip(stopName, {
        permanent: true,
        direction: 'top',
        offset: [0, -16],
      })
      .addTo(map);

  }, [requestedStopData, mapReady]);

  /* Aggiorna il callback globale quando vehicleData cambia */
  useEffect(() => {
    window.__gttTrack = (id) => {
      const v = vehicleData?.vehicles?.find(x => x.id === id);
      setTracked(id, v || null);
      mapRef.current?.closePopup();
      if (v && mapRef.current) {
        mapRef.current.setView([v.lat, v.lon], Math.max(mapRef.current.getZoom(), TRACK_ZOOM), { animate: true });
      }
    };
  }, [vehicleData, setTracked]);

  /* ── Carica fermate (zoom ≥ 15) ──────────────────────────────────── */
  const loadStops = useCallback(async (L, map) => {
    if (map.getZoom() < 15) { stopLayerRef.current?.clearLayers(); return; }
    const c = map.getCenter();
    try {
      const { stops } = await getNearbyStops(c.lat, c.lng, 0.6);
      stopLayerRef.current.clearLayers();
      const icon = buildStopIcon(L, 10, '#E84B24');
      stops.forEach(s => {
        if (!s.stop_lat || !s.stop_lon) return;
        const name = s.stop_name?.replace(/Fermata \d+ - /i, '') || s.stop_name;
        L.marker([s.stop_lat, s.stop_lon], { icon })
          .bindPopup(`<b>${name}</b><br><small>#${s.stop_code || s.stop_id}</small><br>
            <a href="/stops/${s.stop_id}" style="color:#E84B24;font-size:12px">Vedi arrivi →</a>`)
          .addTo(stopLayerRef.current);
      });
    } catch {}
  }, []);

  /* ── Auto-tracking da tripId URL param (feed VP live) ───────────── */
  useEffect(() => {
    if (!requestedTripId || !vehicleData?.vehicles?.length) return;
    const match = vehicleData.vehicles.find(v => v.tripId === requestedTripId);
    if (match && !match.estimated) {
      // Veicolo GPS reale trovato nel feed: attiva tracking
      if (!tripTrackedRef.current) {
        tripTrackedRef.current = true;
        routeCenteredRef.current = true; // non ri-centrare sulla stima OTP
        setTripNotFound(false);
        setTracked(match.id, match);
        if (mapRef.current) {
          mapRef.current.setView([match.lat, match.lon], TRACK_ZOOM, { animate: true });
        }
      }
    } else if (!tripTrackedRef.current) {
      // Veicolo non nel feed o solo stimato: mostra posizione OTP
      setTripNotFound(true);
    }
  }, [requestedTripId, vehicleData, setTracked]);

  /* ── Disegna percorso + posizione stimata (quando feed VP vuoto) ── */
  useEffect(() => {
    const L = leafletRef.current;
    if (!L || !routeLayerRef.current || !liveData?.found) return;

    routeLayerRef.current.clearLayers();

    const { stops = [], position, route, status, firstStop } = liveData;
    if (!stops.length) return;

    const color = route?.color || '#E84B24';

    // Polyline percorso: fermate passate in grigio, future nel colore linea
    const passedCoords = stops.filter(s => s.passed).map(s => [s.lat, s.lon]);
    const futureCoords = stops.filter(s => !s.passed).map(s => [s.lat, s.lon]);

    const lastPassed = passedCoords[passedCoords.length - 1];
    if (passedCoords.length > 1) {
      L.polyline(passedCoords, { color: '#AEAEB2', weight: 3, opacity: 0.6 })
        .addTo(routeLayerRef.current);
    }
    if (futureCoords.length > 1 || (lastPassed && futureCoords.length > 0)) {
      const full = lastPassed ? [lastPassed, ...futureCoords] : futureCoords;
      L.polyline(full, { color, weight: 4, opacity: 0.85 })
        .addTo(routeLayerRef.current);
    }

    // Marker fermate percorso: dot colorati, popup al click con nome (stesso stile tab Mappa)
    stops.forEach((s, i) => {
      const isEndpoint = (i === 0 || i === stops.length - 1);
      const dotSz = isEndpoint ? 12 : 7;
      const dotColor = s.passed ? '#AEAEB2' : color;
      const icon = buildStopIcon(L, dotSz, dotColor);
      const stopLabel = s.name || '';
      L.marker([s.lat, s.lon], { icon, zIndexOffset: isEndpoint ? 100 : 0 })
        .bindPopup(`<div style="font-family:-apple-system,sans-serif;min-width:140px">
          <b style="font-size:13px">${stopLabel}</b>
          ${isEndpoint ? `<div style="font-size:11px;color:#8E8E93;margin-top:4px">${i === 0 ? '🟢 Partenza' : '🏁 Arrivo'}</div>` : ''}
        </div>`, { maxWidth: 200 })
        .addTo(routeLayerRef.current);
    });

    // Marker posizione stimata: solo se NON c'è già un veicolo reale tracciato
    if (!trackedId) {
      if (status === 'in_progress' && position) {
        setEstimatedPos(liveData);

        const estIcon = L.divIcon({
          html: `<div style="
            width:36px;height:36px;border-radius:50%;
            background:${color};border:3px solid white;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 8px rgba(0,0,0,0.35);
            font-size:11px;font-weight:700;color:white;
            font-family:-apple-system,sans-serif;">
            ${route?.shortName || '?'}
          </div>`,
          className: '', iconSize: [36, 36], iconAnchor: [18, 18],
        });

        L.marker([position.lat, position.lon], { icon: estIcon, zIndexOffset: 500 })
          .bindPopup(`
            <div style="font-family:-apple-system,sans-serif;min-width:160px">
              <div style="background:${color};color:white;padding:4px 10px;border-radius:8px;font-weight:700;font-size:13px;margin-bottom:8px;display:inline-block">
                ${route?.shortName}
              </div>
              <div style="font-size:12px;color:#3C3C43;margin-bottom:4px">${route?.longName || ''}</div>
              <div style="font-size:11px;color:#8E8E93;margin-top:6px">📍 Posizione stimata<br>Aggiornata ogni 20s</div>
            </div>`, { maxWidth: 220 })
          .addTo(routeLayerRef.current);

        // Prima apertura: centra sulla posizione stimata
        if (!routeCenteredRef.current && mapRef.current) {
          routeCenteredRef.current = true;
          mapRef.current.setView([position.lat, position.lon], TRACK_ZOOM, { animate: true });
        } else if (mapRef.current) {
          // Aggiornamenti successivi: insegui la posizione stimata
          mapRef.current.panTo([position.lat, position.lon], { animate: true, duration: 0.8 });
        }
      } else if (status === 'not_started' && firstStop) {
        setEstimatedPos(liveData);
        if (!routeCenteredRef.current && mapRef.current) {
          routeCenteredRef.current = true;
          mapRef.current.setView([firstStop.lat, firstStop.lon], TRACK_ZOOM, { animate: true });
        }
      } else if (status === 'completed') {
        setEstimatedPos(liveData);
      }
    }
  }, [liveData, trackedId, mapReady]);

  /* ── Aggiorna marker veicoli ─────────────────────────────────────── */
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !vehicleLayerRef.current || !vehicleData?.vehicles) return;

    const currentTracked = trackedIdRef.current;
    const vehicles = vehicleData.vehicles;

    vehicleLayerRef.current.clearLayers();
    markersRef.current = {};

    // Se c'è un tripId richiesto: mostra solo veicoli GPS reali con quel tripId
    // (i veicoli stimati vengono mostrati tramite il marker OTP su routeLayer)
    // Altrimenti mostra tutti con il filtro per tipo
    const filtered = requestedTripId
      ? vehicles.filter(v => v.tripId === requestedTripId && !v.estimated)
      : vehicles.filter(v => filter === 'all' || String(v.routeType) === filter);

    filtered.forEach(v => {
      if (!v.lat || !v.lon) return;
      const isTracked = v.id === currentTracked;
      const icon = buildVehicleIcon(L, v, isTracked);

      const marker = L.marker([v.lat, v.lon], { icon, zIndexOffset: isTracked ? 1000 : 0 })
        .bindPopup(buildPopupHtml(v, isTracked), { maxWidth: 260 })
        .addTo(vehicleLayerRef.current);

      markersRef.current[v.id] = marker;
    });

    // ── Logica di tracking ──────────────────────────────────────────
    if (currentTracked) {
      const tracked = vehicles.find(v => v.id === currentTracked);

      if (tracked && tracked.lat && tracked.lon) {
        // Aggiorna info pannello
        setTrackedInfo(tracked);
        // Centra mappa sul veicolo con animazione fluida
        map.panTo([tracked.lat, tracked.lon], { animate: true, duration: 0.8 });
        // Assicura zoom adeguato
        if (map.getZoom() < 15) map.setZoom(TRACK_ZOOM, { animate: true });
      } else {
        // Veicolo scomparso dal feed (fine servizio)
        setTracked(null, null);
      }
    }
  }, [vehicleData, filter, requestedTripId, mapReady, setTracked]);

  /* ── Ricerca fermate sulla mappa ────────────────────────────────── */
  function handleSearchInput(q) {
    setSearchQuery(q);
    clearTimeout(searchTimerRef.current);
    if (q.length < 2) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/stops/search?q=${encodeURIComponent(q)}&limit=6`);
        const d = await r.json();
        setSearchResults(d.stops || []);
      } catch {}
    }, 300);
  }

  function focusStop(s) {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !s.stop_lat || !s.stop_lon) return;
    if (highlightMarkerRef.current) { highlightMarkerRef.current.remove(); highlightMarkerRef.current = null; }
    map.setView([s.stop_lat, s.stop_lon], 17, { animate: true });
    const icon = L.divIcon({
      html: `<div style="width:26px;height:26px;border-radius:50%;background:#FF3D20;border:3px solid white;box-shadow:0 0 0 8px rgba(255,61,32,0.25)"></div>`,
      className: '', iconSize: [26, 26], iconAnchor: [13, 13],
    });
    highlightMarkerRef.current = L.marker([s.stop_lat, s.stop_lon], { icon, zIndexOffset: 3000 })
      .bindPopup(`<div style="font-family:-apple-system,sans-serif;">
        <b>${s.stop_name}</b><br>
        <small style="color:#6C6C70">#${s.stop_code || s.stop_id}</small><br>
        <a href="/v2/stops/${s.stop_id}" style="color:#E84B24;font-size:12px">Vedi arrivi →</a>
      </div>`, { maxWidth: 220 })
      .addTo(map).openPopup();
    setSearchQuery(s.stop_name);
    setSearchResults([]);
    setShowSearch(false);
    setSelectedStop({ stop_id: s.stop_id, stop_name: s.stop_name, stop_code: s.stop_code });
  }

  /* ── Monitoraggio posizione utente sul percorso ──────────────────── */
  useEffect(() => {
    if (!userPos || !liveData?.stops?.length) {
      setUserRouteProgress(null);
      return;
    }
    const stops = liveData.stops;

    // Trova fermata del percorso più vicina all'utente
    let minDist = Infinity, nearestStop = null, nearestIdx = -1;
    stops.forEach((s, i) => {
      if (!s.lat || !s.lon) return;
      const d = distMeters(userPos.lat, userPos.lon, s.lat, s.lon);
      if (d < minDist) { minDist = d; nearestStop = s; nearestIdx = i; }
    });

    // "A bordo" = entro 200m da una fermata del percorso
    const onRoute = minDist < 200;

    const futureStops = stops.filter(s => !s.passed);
    const dest      = futureStops.length ? futureStops[futureStops.length - 1] : null;
    const destDist  = dest ? Math.round(distMeters(userPos.lat, userPos.lon, dest.lat, dest.lon)) : null;

    setUserRouteProgress({
      nearestStop, nearestDist: Math.round(minDist), nearestIdx, onRoute,
      destDist, destName: dest?.name,
    });

    // Alert avvicinamento: solo se utente sembra a bordo E < 400m dalla destinazione
    if (onRoute && dest && destDist < 400) {
      setDestAlert({ name: dest.name, dist: destDist });
    } else {
      setDestAlert(null);
    }
  }, [userPos, liveData]);

  /* ── UI ──────────────────────────────────────────────────────────── */
  const counts = vehicleData?.vehicles
    ? {
        all:   vehicleData.vehicles.length,
        metro: vehicleData.vehicles.filter(v => v.routeType === 1).length,
        tram:  vehicleData.vehicles.filter(v => v.routeType === 0).length,
        bus:   vehicleData.vehicles.filter(v => v.routeType === 3).length,
      }
    : null;

  const updatedTime = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('it-IT',
        { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const trackColor = trackedInfo ? getVehicleColor(trackedInfo) : 'var(--color-brand)';

  const isMetroRoute = !!(
    liveData?.route?.type === 1 ||
    estimatedPos?.route?.type === 1 ||
    trackedInfo?.routeType === 1
  );

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {requestedTripId && (
              <button
                onClick={() => navigate(-1)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-brand)' }}
                aria-label="Torna indietro"
              >
                <svg width="10" height="17" viewBox="0 0 10 17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M9 1L1 8.5 9 16"/>
                </svg>
              </button>
            )}
            <div>
              <div className="page-title">
                {requestedTripId && (trackedInfo || estimatedPos)
                  ? `Linea ${trackedInfo?.routeShortName || estimatedPos?.route?.shortName || '…'}`
                  : 'Mappa veicoli'}
              </div>
              <div className="page-subtitle">
                {isLoading ? 'Caricamento…'
                  : requestedTripId
                    ? (trackedInfo
                        ? `${trackedInfo.headsign || trackedInfo.routeLongName || ''}${trackedInfo.estimated ? ' · stimato' : ' · GPS'}`
                        : estimatedPos?.found
                          ? `${estimatedPos.route?.longName || ''} · pos. stimata`
                          : 'Ricerca veicolo…')
                    : counts?.all > 0
                      ? `${counts.all} veicoli${vehicleData?.source === 'gtfs-estimated' ? ' · pos. stimate' : ' in circolazione'}`
                      : 'Nessun veicolo attivo al momento'}
              </div>
            </div>
          </div>
          {updatedTime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-2)' }}>
              <span className="realtime-dot" />
              {updatedTime}
            </div>
          )}
        </div>

        {/* Banner posizione stimata (feed VP vuoto, uso interpolazione OTP) */}
        {tripNotFound && estimatedPos?.found && (
          <div className="notice notice-info" style={{ margin: '8px 0 0' }}>
            <span>📍</span>
            <span>
              {estimatedPos.status === 'not_started'
                ? `Corsa non ancora iniziata · parte tra ${estimatedPos.startsIn} min da ${estimatedPos.firstStop?.name}`
                : estimatedPos.status === 'completed'
                ? 'Corsa terminata'
                : 'Posizione calcolata — GPS non disponibile nel feed pubblico GTT'}
            </span>
          </div>
        )}
        {tripNotFound && !estimatedPos?.found && requestedTripId && (
          <div className="notice notice-info" style={{ margin: '8px 0 0' }}>
            <span>ℹ️</span>
            <span>Posizione non disponibile per questa corsa</span>
          </div>
        )}

        {/* GPS error banners */}
        {gpsError === 'denied' && (
          <div className="notice notice-warn" style={{ margin: '8px 0 0' }}>
            <span>🔒</span>
            <span>Posizione non disponibile: permesso GPS negato. Abilitalo nelle impostazioni del browser.</span>
          </div>
        )}
        {gpsError === 'unavailable' && (
          <div className="notice notice-warn" style={{ margin: '8px 0 0' }}>
            <span>📡</span>
            <span>GPS non disponibile su questo dispositivo o browser.</span>
          </div>
        )}
        {gpsError === 'timeout' && (
          <div className="notice notice-info" style={{ margin: '8px 0 0' }}>
            <span>⏳</span>
            <span>Segnale GPS assente o debole — ricerca posizione in corso…</span>
          </div>
        )}
        {gpsError === 'inaccurate' && (
          <div className="notice notice-info" style={{ margin: '8px 0 0' }}>
            <span>📡</span>
            <span>Segnale GPS debole — la posizione mostrata potrebbe essere imprecisa</span>
          </div>
        )}
        {gpsStale && requestedTripId && (
          <div className="notice notice-warn" style={{ margin: '8px 0 0' }}>
            <span>⚠️</span>
            <span>Segnale GPS perso durante il viaggio — ultima posizione nota mostrata</span>
          </div>
        )}
        {/* Banner metro: GPS assente in galleria */}
        {requestedTripId && isMetroRoute && !['denied','unavailable'].includes(gpsError) && (
          <div className="notice notice-info" style={{ margin: '8px 0 0' }}>
            <span>🚇</span>
            <span>Metro: il GPS può essere assente in galleria — il monitoraggio potrebbe essere limitato</span>
          </div>
        )}
        {/* Metro degrado: GPS in galleria */}
        {requestedTripId && isMetroRoute && userPos && !gpsError && (
          <div className="notice notice-info" style={{ margin: '8px 0 0' }}>
            <span>🚇</span>
            <span>Metro: il GPS può essere assente in galleria — il monitoraggio potrebbe essere limitato</span>
          </div>
        )}

        {/* Filtri: nascosti quando si segue un singolo veicolo */}
        {!requestedTripId && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
            {[
              { key: 'all', label: `Tutti${counts ? ` (${counts.all})` : ''}`,  color: 'var(--color-text)' },
              { key: '1',   label: `Metro${counts ? ` (${counts.metro})` : ''}`, color: TYPE_COLORS[1] },
              { key: '0',   label: `Tram${counts ? ` (${counts.tram})` : ''}`,   color: TYPE_COLORS[0] },
              { key: '3',   label: `Bus${counts ? ` (${counts.bus})` : ''}`,     color: TYPE_COLORS[3] },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                whiteSpace: 'nowrap',
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                border: filter === f.key ? `2px solid ${f.color}` : '2px solid transparent',
                background: filter === f.key ? f.color + '20' : 'var(--color-bg-input)',
                color: filter === f.key ? f.color : 'var(--color-text-2)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Corpo mappa ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <style>{`
          .leaflet-container { font-family: -apple-system, sans-serif; }
          .leaflet-popup-content-wrapper {
            border-radius: 14px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.18);
            padding: 0;
          }
          .leaflet-popup-content { margin: 14px; }
          .leaflet-popup-tip { display: none; }
        `}</style>

        <div ref={mapElRef} style={{ width: '100%', height: '100%' }} />

        {/* ── Ricerca fermate sulla mappa ─────────────────────────── */}
        {!requestedTripId && (
          <div style={{ position: 'absolute', top: 10, left: 10, right: 54, zIndex: 1001 }}>
            <div style={{
              background: 'var(--color-bg-card)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 2px 14px rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8,
              border: showSearch ? '1.5px solid var(--color-brand)' : '1.5px solid transparent',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-2)" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>
              </svg>
              <input
                type="search"
                value={searchQuery}
                onFocus={() => setShowSearch(true)}
                onChange={e => handleSearchInput(e.target.value)}
                placeholder="Cerca fermata…"
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: 'var(--color-text)', fontSize: 14,
                  fontFamily: '-apple-system, sans-serif',
                  padding: '10px 0',
                }}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearch(false); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-2)', padding: 0, fontSize: 16, lineHeight: 1 }}>
                  ✕
                </button>
              )}
            </div>

            {showSearch && searchResults.length > 0 && (
              <div style={{
                marginTop: 4, background: 'var(--color-bg-card)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
                overflow: 'hidden',
              }}>
                {searchResults.map(s => (
                  <button key={s.stop_id} onClick={() => focusStop(s)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', width: '100%', background: 'none',
                      border: 'none', borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer', textAlign: 'left',
                      fontFamily: '-apple-system, sans-serif',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>🚏</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{s.stop_name}</div>
                      {s.stop_desc && <div style={{ fontSize: 11, color: 'var(--color-text-2)' }}>{s.stop_desc}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Avviso avvicinamento destinazione ────────────────────── */}
        {destAlert && (
          <div style={{
            position: 'absolute', top: showSearch ? 70 : 10, left: 10, right: 10,
            background: 'linear-gradient(135deg,#15803D,#166534)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 18px rgba(0,0,0,0.45)',
            padding: '12px 14px', zIndex: 1002,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 24 }}>🔔</span>
            <div style={{ flex: 1, color: 'white' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Stai per arrivare!</div>
              <div style={{ fontSize: 12, opacity: 0.88, marginTop: 2 }}>
                <b>{destAlert.name}</b> è a {destAlert.dist}m — preparati a scendere
              </div>
            </div>
            <button onClick={() => setDestAlert(null)}
              style={{
                background: 'rgba(255,255,255,0.22)', border: 'none',
                borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                color: 'white', fontSize: 12, fontWeight: 600, flexShrink: 0,
              }}>
              OK
            </button>
          </div>
        )}

        {/* ── Pannello posizione stimata (tripId URL, feed VP vuoto) ─── */}
        {tripNotFound && estimatedPos?.found && estimatedPos.status === 'in_progress' && (
          <div style={{
            position: 'absolute', bottom: 16, left: 12, right: 12,
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            padding: '14px 16px', zIndex: 1000,
            borderLeft: `4px solid ${estimatedPos.route?.color || 'var(--color-brand)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: estimatedPos.route?.color || 'var(--color-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>
                  {estimatedPos.route?.shortName || '?'}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-3)', fontWeight: 600,
                                 textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    📍 Pos. stimata · {estimatedPos.progress}% percorso
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 1 }} className="truncate">
                  {estimatedPos.route?.longName || `Linea ${estimatedPos.route?.shortName}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 3 }} className="truncate">
                  → {estimatedPos.nextStop?.name}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Pannello "Stai seguendo" ──────────────────────────────── */}
        {trackedId && trackedInfo && (
          <div style={{
            position: 'absolute', bottom: 16, left: 12, right: 12,
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            padding: '14px 16px',
            zIndex: 1000,
            borderLeft: `4px solid ${trackColor}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Indicatore veicolo */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: trackColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>
                  {trackedInfo.routeShortName}
                </span>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="realtime-dot" />
                  <span style={{ fontSize: 11, color: 'var(--color-text-2)', fontWeight: 600,
                                 textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Stai seguendo
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 1 }} className="truncate">
                  {trackedInfo.routeLongName || `Linea ${trackedInfo.routeShortName}`}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 3, fontSize: 12, color: 'var(--color-text-2)' }}>
                  <span>{trackedInfo.currentStatus}</span>
                  {trackedInfo.speed != null && <span>⚡ {trackedInfo.speed} km/h</span>}
                  {trackedInfo.occupancy && <span>👥 {trackedInfo.occupancy}</span>}
                </div>
                {/* Posizione utente sul percorso */}
                {userRouteProgress?.onRoute && (
                  <div style={{ marginTop: 5, fontSize: 11, color: '#2563EB', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563EB', display: 'inline-block', flexShrink: 0 }} />
                    Sei vicino a <b style={{ marginLeft: 3 }}>{userRouteProgress.nearestStop?.name}</b>
                    {userRouteProgress.destDist != null && (
                      <span style={{ color: 'var(--color-text-3)', marginLeft: 4 }}>· {userRouteProgress.destDist}m alla dest.</span>
                    )}
                  </div>
                )}
                {userRouteProgress && !userRouteProgress.onRoute && userPos && (
                  <div style={{ marginTop: 5, fontSize: 11, color: 'var(--color-text-3)' }}>
                    ⚠️ Posizione lontana dal percorso ({userRouteProgress.nearestDist}m)
                  </div>
                )}
              </div>

              {/* Stop tracking */}
              <button
                onClick={stopTracking}
                style={{
                  background: 'var(--color-bg-input)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--color-text-2)',
                  flexShrink: 0,
                }}
              >
                ✕ Stop
              </button>
            </div>
          </div>
        )}

        {/* ── Pulsante centra su di me ─────────────────────────────── */}
        {userPos && mapReady && (
          <button
            onClick={() => mapRef.current?.setView([userPos.lat, userPos.lon], Math.max(mapRef.current.getZoom(), 16), { animate: true })}
            style={{
              position: 'absolute', bottom: 84, right: 10, zIndex: 1001,
              width: 40, height: 40,
              background: 'var(--color-bg-card)',
              border: '2px solid var(--color-border)',
              borderRadius: 8,
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}
            title="Centra su di me"
            aria-label="Centra la mappa sulla tua posizione"
          >
            📍
          </button>
        )}

        {/* ── Pannello informativo fermata (ricerca) ───────────────── */}
        {selectedStop && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1005,
            background: 'var(--color-bg-card)',
            borderRadius: '16px 16px 0 0',
            boxShadow: '0 -4px 28px rgba(0,0,0,0.45)',
            maxHeight: '55vh',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Handle drag */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border)' }} />
            </div>
            {/* Header fermata */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0 16px 10px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>
                  {selectedStop.stop_name}
                </div>
                {selectedStop.stop_code && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-2)', marginTop: 2 }}>
                    Fermata #{selectedStop.stop_code}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <a href={`/v2/stops/${selectedStop.stop_id}`}
                  style={{ fontSize: 13, color: 'var(--color-brand)', fontWeight: 600, textDecoration: 'none' }}>
                  Tutti gli arrivi →
                </a>
                <button onClick={() => { setSelectedStop(null); if (highlightMarkerRef.current) { highlightMarkerRef.current.remove(); highlightMarkerRef.current = null; } }}
                  style={{ background: 'var(--color-bg-input)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: 'var(--color-text-2)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ✕
                </button>
              </div>
            </div>
            {/* Lista arrivi */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px 20px' }}>
              {arrivalsLoading && (
                <div style={{ color: 'var(--color-text-2)', fontSize: 13, padding: '12px 0' }}>
                  Caricamento prossimi arrivi…
                </div>
              )}
              {!arrivalsLoading && !(stopArrivalsData?.arrivals?.length) && (
                <div style={{ color: 'var(--color-text-2)', fontSize: 13, padding: '12px 0' }}>
                  Nessun passaggio nei prossimi 90 minuti
                </div>
              )}
              {(stopArrivalsData?.arrivals || []).map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  <div style={{
                    background: a.routeColor ? `#${a.routeColor}` : 'var(--color-brand)',
                    color: a.routeTextColor ? `#${a.routeTextColor}` : 'white',
                    fontWeight: 700, fontSize: 13, padding: '4px 10px',
                    borderRadius: 5, flexShrink: 0, minWidth: 38, textAlign: 'center',
                  }}>
                    {a.routeShortName}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.headsign}
                    </div>
                    {a.delay > 60 && (
                      <div style={{ fontSize: 11, color: '#FF5C3A', marginTop: 1 }}>
                        +{Math.round(a.delay / 60)} min ritardo
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: 17, fontWeight: 800, flexShrink: 0,
                    color: a.delay > 60 ? '#FF5C3A' : a.realtime ? '#2DD17A' : 'var(--color-text)',
                  }}>
                    {a.waitMinutes === 0 ? 'Ora' : `${a.waitMinutes}′`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Istruzione iniziale (solo se nessun veicolo tracciato) ── */}
        {mapReady && !trackedId && counts?.all > 0 && (
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(28,28,30,0.82)', borderRadius: 'var(--radius-pill)',
            padding: '8px 16px', zIndex: 1000,
            fontSize: 12, color: 'white', whiteSpace: 'nowrap',
            backdropFilter: 'blur(8px)',
          }}>
            Tocca un veicolo per seguirlo 📍
          </div>
        )}

        {/* ── Empty state notturno ─────────────────────────────────── */}
        {mapReady && vehicleData?.vehicles?.length === 0 && (
          <div style={{
            position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--color-bg-card)', borderRadius: 'var(--radius-md)',
            padding: '12px 16px', boxShadow: 'var(--shadow-card)',
            fontSize: 13, color: 'var(--color-text-2)', textAlign: 'center',
            zIndex: 1000, maxWidth: 280,
          }}>
            🌙 Nessun veicolo in circolazione.<br/>
            Il servizio riprende al mattino.
          </div>
        )}

        {/* ── Legenda ──────────────────────────────────────────────── */}
        {mapReady && !trackedId && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'var(--color-bg-card)', borderRadius: 'var(--radius-sm)',
            padding: '8px 10px', boxShadow: 'var(--shadow-card)',
            fontSize: 11, zIndex: 1000, lineHeight: 1.8,
          }}>
            <div style={{ color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 2 }}>LEGENDA</div>
            {[
              { color: TYPE_COLORS[1], label: 'Metro' },
              { color: TYPE_COLORS[0], label: 'Tram' },
              { color: TYPE_COLORS[3], label: 'Bus' },
              { color: '#E84B24',      label: 'Fermata (zoom 15+)' },
              { color: '#2563EB',      label: userPos ? 'La tua posizione' : null },
            ].filter(i => i.label).map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%',
                              background: item.color, flexShrink: 0 }} />
                <span style={{ color: 'var(--color-text-2)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
