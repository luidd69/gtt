/**
 * JourneyPlannerV2.jsx (V2)
 * Pianificatore tragitto con design V2, OTP multi-leg, time picker e ricerca luoghi.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { planJourney } from '../../utils/api';
import { getRouteTypeInfo } from '../../utils/formatters';
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
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab]     = useState('fermate'); // 'fermate' | 'luoghi'

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
      {legs.map((leg, i) => {
        const isLast = i === legs.length - 1;
        if (leg.mode === 'WALK') {
          // Walk: blocco visivamente distinto con sfondo
          return (
            <span key={i} style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 11, color: 'var(--v2-text-3)',
              background: 'var(--v2-surface-2)', borderRadius: 4,
              padding: '2px 6px',
            }}>
              🚶 {leg.durationMin}min
              {!isLast && <span style={{ marginLeft: 4, opacity: 0.25 }}>→</span>}
            </span>
          );
        }
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <RouteChip
                route={{ route_short_name: leg.route?.shortName || leg.mode, route_type: leg.route?.type ?? 3, route_color: leg.route?.color?.replace('#', ''), route_text_color: leg.route?.textColor?.replace('#', '') }}
              />
              {leg.durationMin > 0 && (
                <span style={{ fontSize: 9, color: 'var(--v2-text-3)', fontVariantNumeric: 'tabular-nums' }}>
                  {leg.durationMin}′
                </span>
              )}
            </span>
            {!isLast && <span style={{ fontSize: 10, opacity: 0.25, flexShrink: 0 }}>→</span>}
          </span>
        );
      })}
    </div>
  );
}

// ─── ItineraryCardV2 ──────────────────────────────────────────────────────────

function ItineraryCardV2({ itinerary, index, onClick, isFastest, isSoonest }) {
  const hasRealtime = itinerary.legs.some(l => l.realTime);
  const transferLabel = itinerary.transfers === 0
    ? 'diretto'
    : `${itinerary.transfers} ${itinerary.transfers === 1 ? 'cambio' : 'cambi'}`;

  const delayClass = `v2-animate-in v2-animate-in-d${Math.min(index + 1, 6)}`;

  return (
    <button
      onClick={onClick}
      className={`v2-itin-card ${isFastest ? 'recommended' : ''} ${delayClass}`}
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

      {/* Time column */}
      <div className="v2-itin-times" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 1, minWidth: 54 }}>
        <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--v2-text-1)', lineHeight: 1.1 }}>
          {itinerary.departureTime}
        </span>
        <span style={{ fontSize: 11, color: 'var(--v2-text-3)' }}>→ {itinerary.arrivalTime}</span>
      </div>

      <div style={{ width: 1, height: 44, background: 'var(--v2-border)', flexShrink: 0 }} />

      {/* Legs + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <LegStripV2 legs={itinerary.legs} />

        {/* Board/alight stops e direzione */}
        {(() => {
          const tLegs = itinerary.legs?.filter(l => l.mode !== 'WALK') || [];
          if (!tLegs.length) return null;
          const first = tLegs[0];
          const last  = tLegs[tLegs.length - 1];
          return (
            <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--v2-on-time)', letterSpacing: '0.06em', flexShrink: 0 }}>↑ SALI</span>
                <span className="v2-truncate" style={{ fontSize: 12, color: 'var(--v2-text-2)' }}>{first.from?.name}</span>
                {first.headsign && (
                  <span className="v2-truncate" style={{ fontSize: 11, color: 'var(--v2-text-3)' }}>· dir. {first.headsign}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--v2-brand)', letterSpacing: '0.06em', flexShrink: 0 }}>↓ SCENDI</span>
                <span className="v2-truncate" style={{ fontSize: 12, color: 'var(--v2-text-2)' }}>{last.to?.name}</span>
              </div>
            </div>
          );
        })()}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--v2-text-1)' }}>{itinerary.durationMin} min</span>
          <span style={{ fontSize: 12, color: 'var(--v2-text-3)' }}>·</span>
          <span style={{ fontSize: 12, color: 'var(--v2-text-2)' }}>{transferLabel}</span>
          {itinerary.walkMin > 0 && (
            <>
              <span style={{ fontSize: 12, color: 'var(--v2-text-3)' }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--v2-text-2)' }}>🚶 {itinerary.walkMin}min</span>
            </>
          )}
          {itinerary.waitingMin > 0 && (
            <>
              <span style={{ fontSize: 12, color: 'var(--v2-text-3)' }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--v2-text-2)' }}>⏳ {itinerary.waitingMin}min attesa</span>
            </>
          )}
          {hasRealtime && <span className="v2-rt-dot" />}
        </div>
      </div>

      <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="var(--v2-text-3)" strokeWidth="1.8" strokeLinecap="round">
        <path d="M1 1l5 5-5 5"/>
      </svg>
    </button>
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function JourneyPlannerV2() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [fromStop, setFromStop] = useState(location.state?.fromStop ?? null);
  const [toStop,   setToStop]   = useState(location.state?.toStop   ?? null);
  const [searched, setSearched] = useState(false);

  // Orario
  const [timeMode, setTimeMode] = useState('now');   // 'now' | 'depart' | 'arrive'
  const [timeVal,  setTimeVal]  = useState('');

  const getTopFrequentRoutes = useFavoritesStore(s => s.getTopFrequentRoutes);
  const favStops = useFavoritesStore(s => s.stops);
  const recentStops = Object.values(favStops);

  const arriveBy = timeMode === 'arrive' ? timeVal : undefined;
  const departAt = timeMode === 'depart' ? timeVal : undefined;

  const { data, isLoading, isError, refetch } = usePlan(
    fromStop, toStop, searched, { arriveBy, departAt }
  );

  useEffect(() => {
    if (location.state?.fromStop && location.state?.toStop) setSearched(true);
  }, []);

  const handleSwap = useCallback(() => {
    setFromStop(toStop);
    setToStop(fromStop);
    if (searched) refetch();
  }, [fromStop, toStop, searched, refetch]);

  const handleSearch = () => {
    if (!fromStop || !toStop) return;
    setSearched(true);
  };

  const itineraries = data?.itineraries ?? [];
  const isFallback  = data?.fallback === true;

  // Identifica percorso più veloce e prima corsa
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
              {isFallback && (
                <div className="v2-notice info" style={{ marginBottom: 12 }}>
                  <span>ℹ️</span>
                  <span>Pianificazione OTP non disponibile — risultati da orari GTFS</span>
                </div>
              )}

              {itineraries.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--v2-text-3)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🤷</div>
                  Nessun percorso trovato
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
                        isFastest={i === fastestIdx && fastestIdx !== soonestIdx}
                        isSoonest={i === soonestIdx && itineraries.length > 1}
                        onClick={() => navigate('/v2/journey/itinerary', {
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
