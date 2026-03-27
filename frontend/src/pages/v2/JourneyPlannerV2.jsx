/**
 * JourneyPlannerV2.jsx (V2)
 * Pianificatore tragitto con design V2, OTP multi-leg, time picker e ricerca luoghi.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { planJourney } from '../../utils/api';
import useFavoritesStore from '../../store/favoritesStore';
import RouteChip from '../../components/v2/RouteChip';

// ─── Hook usePlan ─────────────────────────────────────────────────────────────

function usePlan(from, to, enabled, options = {}) {
  const { arriveBy, departAt } = options;
  const fromKey = from?.stopId ?? (from?.lat ? `${from.lat},${from.lon}` : null);
  const toKey   = to?.stopId   ?? (to?.lat   ? `${to.lat},${to.lon}`     : null);
  return useQuery({
    queryKey: ['journey-plan', fromKey, toKey, arriveBy, departAt],
    queryFn: () => planJourney(from, to, { arriveBy, departAt }),
    enabled: enabled && !!from && !!to,
    staleTime: 60_000,
    retry: 1,
  });
}

// ─── StopInput V2 (fermate + luoghi) ─────────────────────────────────────────

function StopInputV2({ label, icon, stop, onPick, recentStops = [] }) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [tab, setTab]         = useState('fermate'); // 'fermate' | 'luoghi'
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError,   setGeoError]   = useState(null);

  function pickMyLocation() {
    if (!navigator.geolocation) { setGeoError('Geolocalizzazione non supportata'); return; }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGeoLoading(false);
        onPick({
          stopId: null,
          stopName: 'La mia posizione',
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          isPlace: true,
          isMyLocation: true,
        });
        close();
      },
      err => {
        setGeoLoading(false);
        setGeoError(err.code === 1 ? 'Accesso negato — abilita la posizione' : 'Impossibile rilevare la posizione');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // Ricerca fermate GTT
  const { data: stopsData } = useQuery({
    queryKey: ['stop-search-v2', query],
    queryFn: async () => {
      if (!query || query.length < 2) return { stops: [] };
      const r = await fetch(`/api/stops/search?q=${encodeURIComponent(query)}&limit=10`);
      return r.json();
    },
    enabled: query.length >= 2 && tab === 'fermate',
    staleTime: 30_000,
  });

  // Ricerca luoghi via Nominatim
  const { data: placesData, isFetching: placesLoading } = useQuery({
    queryKey: ['places-search-v2', query],
    queryFn: async () => {
      if (!query || query.length < 3) return { places: [] };
      const r = await fetch(`/api/stops/places?q=${encodeURIComponent(query)}&limit=6`);
      return r.json();
    },
    enabled: query.length >= 3 && tab === 'luoghi',
    staleTime: 60_000,
  });

  const stopResults  = stopsData?.stops ?? [];
  const placeResults = placesData?.places ?? [];

  function pickStop(s) {
    onPick({ stopId: s.stop_id || s.stopId, stopName: s.stop_name || s.stopName });
    close();
  }
  function pickPlace(p) {
    onPick({ stopId: null, stopName: p.name, lat: p.lat, lon: p.lon, isPlace: true });
    close();
  }
  function close() {
    setOpen(false);
    setQuery('');
    setTab('fermate');
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={e => e.key === 'Enter' && setOpen(true)}
        className="v2-stop-input-wrap"
        style={{ cursor: 'pointer' }}
        aria-label={`${label}: ${stop?.stopName || 'Non selezionata'}`}
      >
        <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--v2-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 1 }}>{label}</div>
          {stop ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="v2-truncate" style={{ fontSize: 15, fontWeight: 600, color: 'var(--v2-text-1)' }}>
                {stop.stopName}
              </div>
              {stop.isPlace && (
                <span style={{ fontSize: 10, background: 'var(--v2-surface-3)', color: 'var(--v2-text-3)', padding: '1px 5px', borderRadius: 3 }}>luogo</span>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--v2-text-3)' }}>Fermata o indirizzo…</div>
          )}
        </div>
        {/* Pulsante "La mia posizione" direttamente sul campo */}
        {!stop && (
          <button
            onClick={e => { e.stopPropagation(); pickMyLocation(); }}
            disabled={geoLoading}
            title="Usa la mia posizione"
            aria-label="La mia posizione"
            style={{
              background: 'none', border: 'none', cursor: geoLoading ? 'default' : 'pointer',
              padding: 6, color: 'var(--v2-brand)', flexShrink: 0,
              display: 'flex', alignItems: 'center',
            }}
          >
            {geoLoading
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            }
          </button>
        )}
        {stop && (
          <button
            onClick={e => { e.stopPropagation(); onPick(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--v2-text-3)' }}
            aria-label="Rimuovi"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Picker dialog */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end',
        }}
          onClick={e => e.target === e.currentTarget && close()}
        >
          <div style={{
            background: 'var(--v2-bg)',
            borderRadius: '20px 20px 0 0',
            padding: '20px 0 40px',
            width: '100%',
            maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '0 var(--v2-sp-md)', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--v2-text-1)' }}>
                  {label === 'Da' ? 'Partenza' : 'Destinazione'}
                </div>
                <button onClick={close}
                  style={{ background: 'var(--v2-surface-2)', border: 'none', borderRadius: 'var(--v2-r-sm)', padding: 8, cursor: 'pointer', color: 'var(--v2-text-1)' }}
                >✕</button>
              </div>

              {/* Search bar */}
              <div className="v2-search-bar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v2-text-3)" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>
                </svg>
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Via, piazza, fermata…"
                  style={{ background: 'transparent', border: 'none', outline: 'none', flex: 1, fontSize: 15, fontFamily: 'inherit', color: 'var(--v2-text-1)' }}
                />
              </div>

              {/* Tab: Fermate / Luoghi */}
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                {['fermate', 'luoghi'].map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    style={{
                      flex: 1, padding: '6px 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 13, fontWeight: 600, borderRadius: 'var(--v2-r-sm)',
                      background: tab === t ? 'var(--v2-brand)' : 'var(--v2-surface-2)',
                      color: tab === t ? '#fff' : 'var(--v2-text-2)',
                    }}
                  >
                    {t === 'fermate' ? '🚏 Fermate GTT' : '📍 Luoghi e indirizzi'}
                  </button>
                ))}
              </div>
            </div>

            {/* La mia posizione */}
            <div style={{ padding: '0 var(--v2-sp-md) 8px', borderBottom: '1px solid var(--v2-border)' }}>
              <button
                onClick={pickMyLocation}
                disabled={geoLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '11px 14px',
                  background: 'var(--v2-surface-2)', border: '1px solid var(--v2-border)',
                  borderRadius: 'var(--v2-r-md)', cursor: geoLoading ? 'default' : 'pointer',
                  fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 20 }}>{geoLoading ? '⏳' : '📍'}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--v2-brand)' }}>
                    {geoLoading ? 'Rilevamento in corso…' : 'La mia posizione'}
                  </div>
                  {geoError && <div style={{ fontSize: 12, color: '#e53e3e', marginTop: 1 }}>{geoError}</div>}
                  {!geoError && !geoLoading && (
                    <div style={{ fontSize: 11, color: 'var(--v2-text-3)' }}>Usa la posizione GPS attuale</div>
                  )}
                </div>
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {/* TAB FERMATE */}
              {tab === 'fermate' && (
                <>
                  {query.length < 2 && recentStops.filter(s => !s.isPlace).length > 0 && (
                    <div>
                      <div className="v2-section-label">Recenti / preferiti</div>
                      {recentStops.filter(s => !s.isPlace).slice(0, 5).map(s => (
                        <button key={s.stopId} onClick={() => pickStop(s)}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px var(--v2-sp-md)', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: '1px solid var(--v2-border)' }}
                        >
                          <span style={{ fontSize: 16 }}>🕐</span>
                          <span style={{ fontSize: 14, color: 'var(--v2-text-1)', fontWeight: 600 }}>{s.stopName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {query.length >= 2 && stopResults.length === 0 && (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--v2-text-3)' }}>Nessuna fermata trovata</div>
                  )}
                  {stopResults.map(s => (
                    <button key={s.stop_id} onClick={() => pickStop(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px var(--v2-sp-md)', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: '1px solid var(--v2-border)', textAlign: 'left' }}
                    >
                      <span style={{ fontSize: 16 }}>🚏</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v2-text-1)' }}>{s.stop_name}</div>
                        {s.stop_desc && <div style={{ fontSize: 12, color: 'var(--v2-text-3)' }}>{s.stop_desc}</div>}
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* TAB LUOGHI */}
              {tab === 'luoghi' && (
                <>
                  {query.length < 3 && (
                    <div style={{ padding: '16px var(--v2-sp-md)', color: 'var(--v2-text-3)', fontSize: 13 }}>
                      Scrivi almeno 3 lettere per cercare vie, piazze, luoghi…
                    </div>
                  )}
                  {placesLoading && query.length >= 3 && (
                    <div style={{ padding: '16px var(--v2-sp-md)', color: 'var(--v2-text-3)', fontSize: 13 }}>Ricerca in corso…</div>
                  )}
                  {!placesLoading && query.length >= 3 && placeResults.length === 0 && (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--v2-text-3)' }}>Nessun luogo trovato</div>
                  )}
                  {placeResults.map((p, i) => (
                    <button key={i} onClick={() => pickPlace(p)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px var(--v2-sp-md)', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: '1px solid var(--v2-border)', textAlign: 'left' }}
                    >
                      <span style={{ fontSize: 16 }}>📍</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v2-text-1)' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--v2-text-3)', marginTop: 2 }}>{p.fullName}</div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LegStripV2 ───────────────────────────────────────────────────────────────

function LegStripV2({ legs }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 1 }}>
      {legs.map((leg, i) => {
        const isLast = i === legs.length - 1;
        if (leg.mode === 'WALK') {
          return (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 11, color: 'var(--v2-walk)',
                background: 'var(--v2-walk-bg)', borderRadius: 4,
                padding: '2px 7px', fontWeight: 500,
              }}>
                <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="5" cy="2" r="1.2"/><path d="M5 4v4l-2 4M5 8l2 4M3 6h4"/></svg>
                {leg.durationMin}′
              </span>
              {!isLast && <span style={{ fontSize: 11, color: 'var(--v2-text-3)', flexShrink: 0 }}>›</span>}
            </span>
          );
        }
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <RouteChip
                shortName={leg.route?.shortName || leg.mode}
                routeType={leg.route?.type ?? 3}
                color={leg.route?.color}
                textColor={leg.route?.textColor}
              />
              {leg.durationMin > 0 && (
                <span style={{ fontSize: 9, color: 'var(--v2-text-3)', fontVariantNumeric: 'tabular-nums' }}>
                  {leg.durationMin}′
                </span>
              )}
            </span>
            {!isLast && <span style={{ fontSize: 11, color: 'var(--v2-text-3)', flexShrink: 0 }}>›</span>}
          </span>
        );
      })}
    </div>
  );
}

// ─── TripFiltersBar ───────────────────────────────────────────────────────────

function TripFiltersBar({ maxTransfers, setMaxTransfers, timeMode, time }) {
  const opts = [
    { key: -1, label: 'Tutti' },
    { key: 0,  label: 'Diretto' },
    { key: 1,  label: 'Max 1 cambio' },
    { key: 2,  label: 'Max 2 cambi' },
  ];
  return (
    <div style={{
      display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2,
      scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      marginBottom: 12,
    }}>
      {/* Chip orario */}
      <span style={{
        flexShrink: 0, fontSize: 12, fontWeight: 600,
        background: 'var(--v2-surface-2)', color: 'var(--v2-text-2)',
        border: '1px solid var(--v2-border)', borderRadius: 20,
        padding: '5px 11px', display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        {timeMode === 'now' ? 'Adesso' : timeMode === 'depart' ? `Partenza ${time}` : `Arrivo ${time}`}
      </span>

      {/* Chip trasferimenti */}
      {opts.map(o => (
        <button key={o.key} onClick={() => setMaxTransfers(o.key)}
          style={{
            flexShrink: 0, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', border: 'none', borderRadius: 20,
            padding: '5px 11px',
            background: maxTransfers === o.key ? 'var(--v2-brand)' : 'var(--v2-surface-2)',
            color: maxTransfers === o.key ? '#fff' : 'var(--v2-text-2)',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── ItineraryMap ─────────────────────────────────────────────────────────────

function ItineraryMap({ itinerary }) {
  const mapElRef       = useRef(null);
  const fsMapElRef     = useRef(null);
  const mapRef         = useRef(null);
  const fsMapRef       = useRef(null);
  const layerRef       = useRef(null);
  const fsLayerRef     = useRef(null);
  const initDone       = useRef(false);
  const fsInitDone     = useRef(false);
  const lRef           = useRef(null);   // Leaflet module cached
  const userLayerRef   = useRef(null);   // layer pos utente (mappa piccola)
  const fsUserLayerRef = useRef(null);   // layer pos utente (fullscreen)
  const userPosRef     = useRef(null);   // mirror ref per accesso in callback async
  const [userPos, setUserPos] = useState(null);  // { lat, lon, accuracy }
  const [fullscreen, setFullscreen] = useState(false);

  function buildPopup(html) {
    return `<div style="font-size:13px;line-height:1.4;min-width:120px">${html}</div>`;
  }

  function drawRoute(L, itin, layer, map) {
    if (!layer) return;
    layer.clearLayers();
    const allPts = [];

    for (const leg of itin.legs) {
      const isWalk = leg.mode === 'WALK';
      const color  = isWalk ? '#888888'
        : leg.mode === 'SUBWAY' ? '#E84B24'
        : (leg.route?.color || '#4A90FF');

      const pts = [];
      if (leg.from?.lat && leg.from?.lon) pts.push([leg.from.lat, leg.from.lon]);
      for (const s of leg.intermediateStops ?? []) {
        if (s.lat && s.lon) pts.push([s.lat, s.lon]);
      }
      if (leg.to?.lat && leg.to?.lon) pts.push([leg.to.lat, leg.to.lon]);
      if (pts.length < 2) continue;
      allPts.push(...pts);

      L.polyline(pts, {
        color, weight: isWalk ? 2 : 5,
        opacity: isWalk ? 0.45 : 0.9,
        dashArray: isWalk ? '5 8' : null,
        lineJoin: 'round',
      }).addTo(layer);

      if (!isWalk) {
        // Fermata salita
        if (leg.from?.lat) {
          const popHtml = buildPopup(
            `<b style="color:${color}">↑ Sali — ${leg.startTime}</b><br>${leg.from.name || ''}`
          );
          L.circleMarker([leg.from.lat, leg.from.lon], {
            radius: 7, color, fillColor: '#fff', fillOpacity: 1, weight: 2.5,
          }).bindPopup(popHtml).addTo(layer);
        }

        // Fermate intermedie
        for (const s of leg.intermediateStops ?? []) {
          if (!s.lat || !s.lon) continue;
          const popHtml = buildPopup(`${s.name || 'Fermata'}`);
          L.circleMarker([s.lat, s.lon], {
            radius: 3.5, color, fillColor: color, fillOpacity: 0.5, weight: 1,
          }).bindPopup(popHtml).addTo(layer);
        }

        // Fermata discesa
        if (leg.to?.lat) {
          const popHtml = buildPopup(
            `<b style="color:${color}">↓ Scendi — ${leg.endTime}</b><br>${leg.to.name || ''}`
          );
          L.circleMarker([leg.to.lat, leg.to.lon], {
            radius: 7, color, fillColor: '#fff', fillOpacity: 1, weight: 2.5,
          }).bindPopup(popHtml).addTo(layer);
        }
      }
    }

    // Origine
    const first = itin.legs[0];
    if (first?.from?.lat) {
      L.circleMarker([first.from.lat, first.from.lon], {
        radius: 9, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1, weight: 0,
      }).bindPopup(buildPopup(`<b>Partenza</b><br>${first.from.name || ''}`)).addTo(layer);
    }
    // Destinazione
    const last = itin.legs[itin.legs.length - 1];
    if (last?.to?.lat) {
      L.circleMarker([last.to.lat, last.to.lon], {
        radius: 9, color: '#FF3D20', fillColor: '#FF3D20', fillOpacity: 1, weight: 0,
      }).bindPopup(buildPopup(`<b>Arrivo</b><br>${last.to.name || ''}`)).addTo(layer);
    }

    if (allPts.length > 1) {
      map.fitBounds(L.latLngBounds(allPts), { padding: [32, 32], animate: false });
    }
  }

  function drawUserPos(L, map, uLayRef, pos) {
    if (!L || !map || !pos) return;
    const { lat, lon, accuracy } = pos;
    if (uLayRef.current) { uLayRef.current.clearLayers(); } else {
      uLayRef.current = L.layerGroup().addTo(map);
    }
    L.circle([lat, lon], {
      radius: accuracy,
      color: '#3b82f6', fillColor: '#3b82f6',
      fillOpacity: 0.08, weight: 1, opacity: 0.3,
    }).addTo(uLayRef.current);
    L.circleMarker([lat, lon], {
      radius: 8, color: '#fff', fillColor: '#3b82f6',
      fillOpacity: 1, weight: 3,
    }).bindPopup('<b>La mia posizione</b>').addTo(uLayRef.current);
  }

  function initMap(el, ref, layRef, doneRef, opts = {}) {
    if (doneRef.current || !el) return;
    doneRef.current = true;
    import('leaflet').then(mod => {
      const L = mod.default ?? mod;
      delete L.Icon.Default.prototype._getIconUrl;
      const map = L.map(el, {
        zoomControl: opts.zoomControl ?? false,
        attributionControl: false,
        scrollWheelZoom: opts.scrollWheelZoom ?? false,
        dragging: true,
        tap: true,
      });
      if (opts.zoomControl) L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, subdomains: 'abcd',
      }).addTo(map);
      lRef.current   = L;
      ref.current    = map;
      layRef.current = L.layerGroup().addTo(map);
      if (itinerary) drawRoute(L, itinerary, layRef.current, map);
      // Disegna posizione utente se già disponibile
      if (opts.userLayRef) drawUserPos(L, map, opts.userLayRef, userPosRef.current);
    });
  }

  // Init mappa piccola
  useEffect(() => {
    initMap(mapElRef.current, mapRef, layerRef, initDone, { scrollWheelZoom: false, userLayRef: userLayerRef });
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      initDone.current = false;
    };
  }, []);

  // Watch geolocalizzazione → aggiorna state (triggera effetto disegno)
  useEffect(() => {
    if (!window.isSecureContext || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy };
        userPosRef.current = p;
        setUserPos(p);
      },
      () => {},  // silenzioso su errore/diniego
      { enableHighAccuracy: true, timeout: 10_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Disegna dot posizione utente su entrambe le mappe quando cambia
  useEffect(() => {
    const L = lRef.current;
    if (!L) return;
    if (mapRef.current)   drawUserPos(L, mapRef.current,   userLayerRef,   userPos);
    if (fsMapRef.current) drawUserPos(L, fsMapRef.current, fsUserLayerRef, userPos);
  }, [userPos]);

  // Init mappa fullscreen quando si apre
  useEffect(() => {
    if (!fullscreen) return;
    const el = fsMapElRef.current;
    if (!el || fsInitDone.current) {
      if (fsMapRef.current && itinerary) {
        const L = lRef.current;
        if (L) {
          fsMapRef.current.invalidateSize();
          drawRoute(L, itinerary, fsLayerRef.current, fsMapRef.current);
          drawUserPos(L, fsMapRef.current, fsUserLayerRef, userPosRef.current);
        }
      }
      return;
    }
    fsInitDone.current = true;
    import('leaflet').then(mod => {
      const L = mod.default ?? mod;
      lRef.current = L;
      delete L.Icon.Default.prototype._getIconUrl;
      const map = L.map(el, {
        zoomControl: false, attributionControl: false,
        scrollWheelZoom: true, dragging: true, tap: true,
      });
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, subdomains: 'abcd',
      }).addTo(map);
      fsMapRef.current   = map;
      fsLayerRef.current = L.layerGroup().addTo(map);
      if (itinerary) drawRoute(L, itinerary, fsLayerRef.current, map);
      drawUserPos(L, map, fsUserLayerRef, userPosRef.current);
    });
    return () => {
      if (fsMapRef.current) { fsMapRef.current.remove(); fsMapRef.current = null; }
      fsInitDone.current = false;
    };
  }, [fullscreen]);

  // Ridisegna mappa piccola quando cambia itinerario
  useEffect(() => {
    if (!mapRef.current || !itinerary) return;
    import('leaflet').then(mod => {
      const L = mod.default ?? mod;
      drawRoute(L, itinerary, layerRef.current, mapRef.current);
    });
  }, [itinerary]);

  // Blocca scroll body quando fullscreen
  useEffect(() => {
    document.body.style.overflow = fullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [fullscreen]);

  return (
    <>
      {/* Mappa piccola */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <div
          ref={mapElRef}
          style={{
            height: 200,
            borderRadius: 'var(--v2-r-lg)',
            overflow: 'hidden',
            border: '1px solid var(--v2-border)',
            background: 'var(--v2-surface-2)',
          }}
        />
        {/* Pulsante espandi */}
        <button
          onClick={() => setFullscreen(true)}
          title="Espandi mappa"
          style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'rgba(255,255,255,0.92)', border: '1px solid var(--v2-border)',
            borderRadius: 6, padding: '5px 7px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>
          </svg>
        </button>
        {/* Hint tap-to-popup */}
        <div style={{
          position: 'absolute', bottom: 8, left: 8,
          background: 'rgba(255,255,255,0.85)', borderRadius: 4, padding: '2px 7px',
          fontSize: 10, color: '#555', pointerEvents: 'none',
        }}>
          Tocca una fermata
        </div>
      </div>

      {/* Overlay fullscreen */}
      {fullscreen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: '#000',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px',
            background: 'var(--v2-surface-1)', borderBottom: '1px solid var(--v2-border)',
            zIndex: 1,
          }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--v2-text-1)' }}>
              Percorso dettagliato
            </span>
            <button
              onClick={() => setFullscreen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 22, lineHeight: 1, color: 'var(--v2-text-1)', padding: 4,
              }}
            >
              ✕
            </button>
          </div>

          {/* Legenda */}
          <div style={{
            display: 'flex', gap: 12, padding: '8px 16px', flexWrap: 'wrap',
            background: 'var(--v2-surface-1)', borderBottom: '1px solid var(--v2-border)',
            fontSize: 11, color: 'var(--v2-text-2)',
          }}>
            {itinerary?.legs?.filter(l => l.mode !== 'WALK').map((leg, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  display: 'inline-block', width: 14, height: 5,
                  background: leg.route?.color || '#4A90FF', borderRadius: 2,
                }} />
                <span style={{ fontWeight: 600 }}>{leg.route?.shortName}</span>
                <span style={{ color: 'var(--v2-text-3)' }}>
                  {leg.startTime}→{leg.endTime}
                  {' · '}
                  {leg.stopsCount} ferm.
                </span>
              </span>
            ))}
          </div>

          {/* Mappa fullscreen */}
          <div ref={fsMapElRef} style={{ flex: 1 }} />
        </div>
      )}
    </>
  );
}

// ─── ItineraryCardV2 ──────────────────────────────────────────────────────────

function ItineraryCardV2({ itinerary, index, onSelect, onDetail, isFastest, isSoonest, isSelected }) {
  const hasRealtime = itinerary.legs.some(l => l.realTime);
  const tLegs = itinerary.legs?.filter(l => l.mode !== 'WALK') || [];
  const firstTransit = tLegs[0];

  const previstoLine = firstTransit
    ? `Previsto: ${firstTransit.startTime ?? itinerary.departureTime} da ${firstTransit.from?.name ?? ''}`
    : null;

  const transferLabel = itinerary.transfers === 0
    ? 'diretto'
    : `${itinerary.transfers} ${itinerary.transfers === 1 ? 'cambio' : 'cambi'}`;

  const delayClass = `v2-animate-in v2-animate-in-d${Math.min(index + 1, 6)}`;

  return (
    <div
      className={`v2-itin-card ${isFastest ? 'recommended' : ''} ${delayClass}`}
      style={{
        position: 'relative', flexDirection: 'column', alignItems: 'stretch', gap: 0,
        padding: '14px var(--v2-sp-md) 10px',
        borderLeftColor: isSelected ? 'var(--v2-brand)' : undefined,
        boxShadow: isSelected ? '0 0 0 1.5px var(--v2-brand) inset' : undefined,
        cursor: 'pointer',
      }}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => e.key === 'Enter' && onSelect()}
      aria-label={`Opzione ${index + 1}: ${itinerary.departureTime} - ${itinerary.arrivalTime}, ${itinerary.durationMin} minuti`}
    >
      {/* Badge */}
      {(isFastest || isSoonest) && (
        <div style={{
          position: 'absolute', top: -10, left: 12,
          background: isFastest ? 'var(--v2-on-time)' : 'var(--v2-brand)',
          color: '#fff', fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 'var(--v2-r-xs)',
        }}>
          {isFastest ? '⚡ PIÙ VELOCE' : '🕐 PRIMA CORSA'}
        </div>
      )}

      {/* Riga principale: orari + durata */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--v2-text-1)', lineHeight: 1 }}>
            {itinerary.departureTime}
          </span>
          <span style={{ fontSize: 13, color: 'var(--v2-text-3)' }}>–</span>
          <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--v2-text-2)' }}>
            {itinerary.arrivalTime}
          </span>
          {hasRealtime && <span className="v2-rt-dot" style={{ marginLeft: 2 }} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--v2-text-1)', fontVariantNumeric: 'tabular-nums' }}>
            {itinerary.durationMin}
          </span>
          <span style={{ fontSize: 12, color: 'var(--v2-text-3)', fontWeight: 500 }}>min</span>
        </div>
      </div>

      {/* Leg strip */}
      <LegStripV2 legs={itinerary.legs} />

      {/* Riga meta + pulsante dettaglio */}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--v2-text-3)',
            background: 'var(--v2-surface-2)', borderRadius: 10,
            padding: '2px 8px', flexShrink: 0,
          }}>
            {transferLabel}
          </span>
          {itinerary.walkMin > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'var(--v2-walk)',
              background: 'var(--v2-walk-bg)', borderRadius: 10,
              padding: '2px 8px', flexShrink: 0,
            }}>
              🚶 {itinerary.walkMin}min
            </span>
          )}
        </div>

        {/* Pulsante "Dettaglio" — apre timeline */}
        <button
          onClick={e => { e.stopPropagation(); onDetail(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: isSelected ? 'var(--v2-brand)' : 'var(--v2-surface-2)',
            color: isSelected ? '#fff' : 'var(--v2-text-2)',
            border: 'none', borderRadius: 20, padding: '5px 10px 5px 12px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            flexShrink: 0, transition: 'background 0.15s, color 0.15s',
          }}
          aria-label="Vedi percorso dettagliato"
        >
          Dettaglio
          <svg width="7" height="11" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l5 5-5 5"/>
          </svg>
        </button>
      </div>

      {/* Riga previsto */}
      {previstoLine && (
        <div style={{ marginTop: 5, fontSize: 11, color: 'var(--v2-text-3)', fontStyle: 'italic' }}>
          {hasRealtime ? '🔴 ' : ''}{previstoLine}
        </div>
      )}
    </div>
  );
}

// ─── TimePicker ───────────────────────────────────────────────────────────────

function TimePickerRow({ mode, setMode, time, setTime }) {
  // mode: 'now' | 'depart' | 'arrive'
  const inputRef = useRef(null);

  const modeLabels = { now: '🕐 Adesso', depart: '🟢 Parti alle', arrive: '🔴 Arriva entro' };

  function cycleModes() {
    const order = ['now', 'depart', 'arrive'];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next);
    if (next !== 'now') {
      // Default: ora attuale arrotondata ai 5 min
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = Math.ceil(now.getMinutes() / 5) * 5;
      setTime(`${h}:${m === 60 ? '00' : m.toString().padStart(2, '0')}`);
      setTimeout(() => inputRef.current?.showPicker?.(), 50);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={cycleModes}
        style={{
          background: mode === 'now' ? 'var(--v2-surface-2)' : 'var(--v2-brand-tint-2)',
          border: `1px solid ${mode === 'now' ? 'var(--v2-border)' : 'var(--v2-brand)'}`,
          borderRadius: 'var(--v2-r-sm)', padding: '6px 12px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          color: mode === 'now' ? 'var(--v2-text-2)' : 'var(--v2-brand)',
          flexShrink: 0,
        }}
      >
        {modeLabels[mode]}
      </button>

      {mode !== 'now' && (
        <input
          ref={inputRef}
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          style={{
            background: 'var(--v2-surface-2)',
            border: '1px solid var(--v2-brand)',
            borderRadius: 'var(--v2-r-sm)',
            color: 'var(--v2-text-1)',
            padding: '5px 10px',
            fontSize: 15, fontWeight: 700,
            fontFamily: 'inherit',
            fontVariantNumeric: 'tabular-nums',
            outline: 'none',
            colorScheme: 'dark',
          }}
        />
      )}
    </div>
  );
}

// ─── Session state helpers ─────────────────────────────────────────────────────

const SESSION_KEY = 'journeyPlannerState';

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(patch) {
  try {
    const prev = loadSession() || {};
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...prev, ...patch }));
  } catch {}
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function JourneyPlannerV2() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const session = loadSession();

  const [fromStop, setFromStopRaw] = useState(
    location.state?.fromStop ?? session?.fromStop ?? null
  );
  const [toStop, setToStopRaw] = useState(
    location.state?.toStop ?? session?.toStop ?? null
  );
  const [searched, setSearchedRaw] = useState(
    session?.searched ?? false
  );

  // Orario
  const [timeMode, setTimeModeRaw] = useState(session?.timeMode ?? 'now');
  const [timeVal,  setTimeValRaw]  = useState(session?.timeVal  ?? '');

  // Filtri lato client
  const [maxTransfers, setMaxTransfers] = useState(-1);  // -1 = tutti
  const [selectedIdx, setSelectedIdx]   = useState(0);

  // Wrappers che persistono in sessionStorage
  const setFromStop = (v) => { setFromStopRaw(v); saveSession({ fromStop: v }); };
  const setToStop   = (v) => { setToStopRaw(v);   saveSession({ toStop: v }); };
  const setSearched = (v) => { setSearchedRaw(v); saveSession({ searched: v }); };
  const setTimeMode = (v) => { setTimeModeRaw(v); saveSession({ timeMode: v }); };
  const setTimeVal  = (v) => { setTimeValRaw(v);  saveSession({ timeVal: v }); };

  const getTopFrequentRoutes = useFavoritesStore(s => s.getTopFrequentRoutes);
  const favStops = useFavoritesStore(s => s.stops);
  const recentStops = Object.values(favStops);

  const arriveBy = timeMode === 'arrive' ? timeVal : undefined;
  const departAt = timeMode === 'depart' ? timeVal : undefined;

  const { data, isLoading, isError, refetch } = usePlan(
    fromStop, toStop, searched, { arriveBy, departAt }
  );

  // Se arriva da link esterno con state, forza ricerca
  useEffect(() => {
    if (location.state?.fromStop && location.state?.toStop) {
      setFromStop(location.state.fromStop);
      setToStop(location.state.toStop);
      setSearched(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwap = useCallback(() => {
    setFromStop(toStop);
    setToStop(fromStop);
    if (searched) refetch();
  }, [fromStop, toStop, searched, refetch]);

  const handleSearch = () => {
    if (!fromStop || !toStop) return;
    setSearched(true);
  };

  const allItineraries = data?.itineraries ?? [];
  // Reset selezione quando arrivano nuovi risultati
  useEffect(() => { setSelectedIdx(0); }, [data]);
  const isFallback     = data?.fallback === true;

  // Filtra lato client per max cambi
  const itineraries = maxTransfers < 0
    ? allItineraries
    : allItineraries.filter(it => it.transfers <= maxTransfers);

  // Identifica percorso più veloce e prima corsa (sull'elenco filtrato)
  const fastestIdx = itineraries.length > 1
    ? itineraries.reduce((best, it, i) => it.durationMin < itineraries[best].durationMin ? i : best, 0)
    : -1;
  const soonestIdx = itineraries.length > 1 ? 0 : -1; // già ordinati per orario

  return (
    <div className="v2-page" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div className="v2-header">
        <div className="v2-title">Pianifica tragitto</div>
        <div className="v2-subtitle">Fermate, indirizzi e trasporti GTT Torino</div>
      </div>

      <div style={{ padding: '0 var(--v2-sp-md) var(--v2-sp-md)' }}>
        {/* Stop pickers */}
        <div style={{
          background: 'var(--v2-surface-1)',
          borderRadius: 'var(--v2-r-lg)',
          border: '1px solid var(--v2-border)',
          boxShadow: 'var(--v2-shadow-sm)',
          overflow: 'hidden',
          position: 'relative',
          marginBottom: 10,
        }}>
          <StopInputV2 label="Da" icon="🟢" stop={fromStop} onPick={setFromStop} recentStops={recentStops} />
          <div style={{ height: 1, background: 'var(--v2-border)', margin: '0 var(--v2-sp-md)' }} />
          <StopInputV2 label="A"  icon="🔴" stop={toStop}   onPick={setToStop}   recentStops={recentStops} />

          {/* Swap button */}
          <button
            onClick={handleSwap}
            style={{
              position: 'absolute', right: 'var(--v2-sp-md)', top: '50%', transform: 'translateY(-50%)',
              background: 'var(--v2-surface-2)', border: '1px solid var(--v2-border)',
              borderRadius: '50%', width: 32, height: 32, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, zIndex: 1,
            }}
            aria-label="Scambia partenza e arrivo"
          >
            <svg width="13" height="17" viewBox="0 0 13 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 1v15M2.5 16l-2-2.5M2.5 16l2-2.5M10.5 16V1M10.5 1l-2 2.5M10.5 1l2 2.5"/>
            </svg>
          </button>
        </div>

        {/* Time picker */}
        <div style={{ marginBottom: 12 }}>
          <TimePickerRow mode={timeMode} setMode={setTimeMode} time={timeVal} setTime={setTimeVal} />
        </div>

        {/* Search CTA */}
        <button
          className="v2-btn v2-btn-primary"
          style={{ width: '100%', fontSize: 15, opacity: (!fromStop || !toStop) ? 0.5 : 1 }}
          disabled={!fromStop || !toStop}
          onClick={handleSearch}
        >
          Cerca percorso
        </button>
      </div>

      {/* Results */}
      {searched && (
        <div style={{ padding: '0 var(--v2-sp-md)' }}>
          {isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{
                  height: 90, background: 'var(--v2-surface-2)',
                  borderRadius: 'var(--v2-r-lg)',
                  animation: 'v2-pulse 1.4s ease-in-out infinite',
                  animationDelay: `${i * 0.15}s`,
                }} />
              ))}
            </div>
          )}

          {isError && (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>❌</div>
              <div style={{ color: 'var(--v2-text-2)', fontSize: 14, marginBottom: 16 }}>
                Impossibile calcolare il percorso
              </div>
              <button className="v2-btn v2-btn-primary" onClick={() => refetch()}>Riprova</button>
            </div>
          )}

          {!isLoading && !isError && (
            <>
              {/* Filtri chip */}
              <TripFiltersBar
                maxTransfers={maxTransfers}
                setMaxTransfers={setMaxTransfers}
                timeMode={timeMode}
                time={timeVal}
              />

              {isFallback && (
                <div className="v2-notice info" style={{ marginBottom: 12 }}>
                  <span>ℹ️</span>
                  <span>Pianificazione OTP non disponibile — risultati da orari GTFS</span>
                </div>
              )}

              {/* Mappa percorso selezionato */}
              {itineraries.length > 0 && (
                <ItineraryMap itinerary={itineraries[Math.min(selectedIdx, itineraries.length - 1)]} />
              )}

              {itineraries.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--v2-text-3)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>
                    {allItineraries.length > 0 ? '🔍' : '🤷'}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--v2-text-2)', marginBottom: 8 }}>
                    {allItineraries.length > 0
                      ? 'Nessun percorso con i filtri selezionati'
                      : 'Nessun percorso trovato'}
                  </div>
                  {allItineraries.length > 0 && (
                    <button className="v2-btn v2-btn-secondary" style={{ fontSize: 13 }}
                      onClick={() => setMaxTransfers(-1)}>
                      Mostra tutti i percorsi
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <div className="v2-section-label">
                    {itineraries.length} opzion{itineraries.length === 1 ? 'e' : 'i'} trovat{itineraries.length === 1 ? 'a' : 'e'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {itineraries.map((itin, i) => (
                      <ItineraryCardV2
                        key={i}
                        itinerary={itin}
                        index={i}
                        isSelected={i === selectedIdx}
                        isFastest={i === fastestIdx && fastestIdx !== soonestIdx}
                        isSoonest={i === soonestIdx && itineraries.length > 1}
                        onSelect={() => setSelectedIdx(i)}
                        onDetail={() => navigate('/v2/journey/itinerary', {
                          state: { itinerary: itin, fromStop, toStop },
                        })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Frequent routes suggestions */}
      {!searched && (
        <FrequentSuggestions
          routes={getTopFrequentRoutes().slice(0, 3)}
          onSelect={(from, to) => { setFromStop(from); setToStop(to); setSearched(true); }}
        />
      )}
    </div>
  );
}

function FrequentSuggestions({ routes, onSelect }) {
  if (!routes.length) return null;
  return (
    <div style={{ padding: '0 var(--v2-sp-md)' }}>
      <div className="v2-section-label">Tragitti frequenti</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {routes.map(r => (
          <button
            key={r.key}
            onClick={() => onSelect(r.fromStop, r.toStop)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', background: 'var(--v2-surface-1)',
              border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-r-md)',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              boxShadow: 'var(--v2-shadow-sm)',
            }}
          >
            <span style={{ fontSize: 18 }}>🔄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="v2-fw-600 v2-truncate" style={{ fontSize: 14, color: 'var(--v2-text-1)' }}>
                {r.fromStop.stopName}
              </div>
              <div className="v2-truncate" style={{ fontSize: 12, color: 'var(--v2-text-2)' }}>
                → {r.toStop.stopName}
              </div>
            </div>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="var(--v2-text-3)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1 1l5 5-5 5"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
