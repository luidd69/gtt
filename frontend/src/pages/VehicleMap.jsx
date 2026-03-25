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
import { useQuery } from '@tanstack/react-query';
import { getVehicles, getNearbyStops } from '../utils/api';
import { getRouteTypeInfo } from '../utils/formatters';

const TURIN_CENTER = [45.0703, 7.6869];
const INITIAL_ZOOM  = 13;
const TRACK_ZOOM    = 16; // zoom usato quando si inizia a seguire

const TYPE_COLORS = { 0: '#007AFF', 1: '#E84B24', 3: '#34C759', 7: '#FF9500' };

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
function buildStopIcon(L) {
  return L.divIcon({
    html: `<div style="width:10px;height:10px;border-radius:50%;
                background:#E84B24;border:2px solid white;
                box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
    className: '',
    iconSize:   [10, 10],
    iconAnchor: [5, 5],
    popupAnchor:[0, -8],
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
      </div>
      ${v.routeLongName
        ? `<div style="font-size:12px;color:#3C3C43;margin-bottom:6px;
                       overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">${v.routeLongName}</div>`
        : ''}
      <div style="display:flex;flex-direction:column;gap:3px;font-size:12px">
        <div><b>Stato:</b> ${v.currentStatus}</div>
        ${v.speed  != null ? `<div><b>Velocità:</b> ${v.speed} km/h</div>` : ''}
        ${v.occupancy       ? `<div><b>Occupazione:</b> ${v.occupancy}</div>` : ''}
        ${v.bearing != null ? `<div><b>Direzione:</b> ${Math.round(v.bearing)}°</div>` : ''}
        ${v.vehicleLabel    ? `<div><b>Veicolo:</b> ${v.vehicleLabel}</div>` : ''}
      </div>
      ${v.timestamp
        ? `<div style="font-size:10px;color:#AEAEB2;margin-top:4px">
             Aggiornato: ${new Date(v.timestamp).toLocaleTimeString('it-IT')}
           </div>`
        : ''}
      ${trackBtn}
    </div>`;
}

/* ── Componente principale ────────────────────────────────────────── */
export default function VehicleMap() {
  const mapRef          = useRef(null);
  const mapElRef        = useRef(null);
  const vehicleLayerRef = useRef(null);
  const stopLayerRef    = useRef(null);
  const leafletRef      = useRef(null);
  const markersRef      = useRef({});      // id → marker Leaflet
  const trackedIdRef    = useRef(null);    // id del veicolo tracciato

  const [filter,        setFilter]        = useState('all');
  const [mapReady,      setMapReady]      = useState(false);
  const [trackedId,     setTrackedId]     = useState(null);   // stato React (per UI)
  const [trackedInfo,   setTrackedInfo]   = useState(null);   // dati ultimo aggiornamento

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

  /* ── Fetch veicoli ogni 15s ─────────────────────────────────────── */
  const { data: vehicleData, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['vehicles'],
    queryFn:  getVehicles,
    refetchInterval: 15_000,
    staleTime:       10_000,
  });

  /* ── Init mappa ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;

    import('leaflet').then(L => {
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
      delete window.__gttTrack;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []); // eslint-disable-line

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
      const icon = buildStopIcon(L);
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

  /* ── Aggiorna marker veicoli ─────────────────────────────────────── */
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !vehicleLayerRef.current || !vehicleData?.vehicles) return;

    const currentTracked = trackedIdRef.current;
    const vehicles = vehicleData.vehicles;

    vehicleLayerRef.current.clearLayers();
    markersRef.current = {};

    const filtered = vehicles.filter(v =>
      filter === 'all' || String(v.routeType) === filter
    );

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
  }, [vehicleData, filter, setTracked]);

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

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="page-title">Mappa veicoli</div>
            <div className="page-subtitle">
              {isLoading ? 'Caricamento...'
                : counts?.all > 0 ? `${counts.all} veicoli in circolazione`
                : 'Nessun veicolo attivo al momento'}
            </div>
          </div>
          {updatedTime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-2)' }}>
              <span className="realtime-dot" />
              {updatedTime}
            </div>
          )}
        </div>

        {/* Filtri */}
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
            ].map(item => (
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
