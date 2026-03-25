/**
 * JourneyPlannerV2.jsx (V2)
 * Pianificatore tragitto con design V2 e supporto OTP multi-leg.
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { planJourney } from '../../utils/api';
import { getRouteTypeInfo } from '../../utils/formatters';
import useFavoritesStore from '../../store/favoritesStore';
import RouteChip from '../../components/v2/RouteChip';

// ─── Hook usePlan ─────────────────────────────────────────────────────────────

function usePlan(fromStopId, toStopId, enabled, options = {}) {
  const { arriveBy } = options;
  return useQuery({
    queryKey: ['journey-plan', fromStopId, toStopId, arriveBy],
    queryFn: () => planJourney(fromStopId, toStopId, { arriveBy }),
    enabled: enabled && !!fromStopId && !!toStopId,
    staleTime: 60_000,
    retry: 1,
  });
}

// ─── StopInput V2 ─────────────────────────────────────────────────────────────

function StopInputV2({ label, icon, stop, onPick, recentStops = [] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data } = useQuery({
    queryKey: ['stop-search-v2', query],
    queryFn: async () => {
      if (!query || query.length < 2) return { stops: [] };
      const r = await fetch(`/api/stops/search?q=${encodeURIComponent(query)}&limit=10`);
      return r.json();
    },
    enabled: query.length >= 2,
    staleTime: 30_000,
  });

  const results = data?.stops ?? [];

  function pickStop(s) {
    onPick({ stopId: s.stop_id || s.stopId, stopName: s.stop_name || s.stopName });
    setOpen(false);
    setQuery('');
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
            <div className="v2-truncate" style={{ fontSize: 15, fontWeight: 600, color: 'var(--v2-text-1)' }}>
              {stop.stopName}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--v2-text-3)' }}>Tocca per scegliere</div>
          )}
        </div>
        {stop && (
          <button
            onClick={e => { e.stopPropagation(); onPick(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--v2-text-3)' }}
            aria-label="Rimuovi fermata"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Picker dialog */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'flex-end',
        }}
          onClick={e => e.target === e.currentTarget && (setOpen(false), setQuery(''))}
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
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--v2-text-1)' }}>Seleziona fermata {label.toLowerCase()}</div>
                <button onClick={() => { setOpen(false); setQuery(''); }}
                  style={{ background: 'var(--v2-surface-2)', border: 'none', borderRadius: 'var(--v2-r-sm)', padding: 8, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <div className="v2-search-bar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--v2-text-3)" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>
                </svg>
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Nome o numero fermata…"
                  style={{ background: 'transparent', border: 'none', outline: 'none', flex: 1, fontSize: 15, fontFamily: 'inherit', color: 'var(--v2-text-1)' }}
                />
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {query.length < 2 && recentStops.length > 0 && (
                <div>
                  <div className="v2-section-label">Recenti / preferiti</div>
                  {recentStops.slice(0, 5).map(s => (
                    <button key={s.stopId} onClick={() => pickStop(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px var(--v2-sp-md)', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: '1px solid var(--v2-border)' }}
                    >
                      <span style={{ fontSize: 16 }}>📍</span>
                      <span style={{ fontSize: 14, color: 'var(--v2-text-1)', fontWeight: 600 }}>{s.stopName}</span>
                    </button>
                  ))}
                </div>
              )}
              {query.length >= 2 && results.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--v2-text-3)' }}>
                  Nessuna fermata trovata
                </div>
              )}
              {results.map(s => (
                <button key={s.stop_id} onClick={() => pickStop(s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px var(--v2-sp-md)', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderBottom: '1px solid var(--v2-border)', textAlign: 'left' }}
                >
                  <span style={{ fontSize: 16 }}>📍</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v2-text-1)' }}>{s.stop_name}</div>
                    {s.stop_desc && <div style={{ fontSize: 12, color: 'var(--v2-text-3)' }}>{s.stop_desc}</div>}
                  </div>
                </button>
              ))}
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', margin: '6px 0' }}>
      {legs.map((leg, i) => {
        if (leg.mode === 'WALK') {
          return (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--v2-text-3)' }}>
              🚶‍♂️ {leg.durationMin}min
              {i < legs.length - 1 && <span style={{ margin: '0 2px', opacity: 0.3 }}>──</span>}
            </span>
          );
        }
        const typeInfo = getRouteTypeInfo(leg.route?.type ?? 3);
        const chipStyle = leg.route?.color
          ? { backgroundColor: leg.route.color, color: leg.route.textColor || '#fff' }
          : null;
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <RouteChip
              route={{ route_short_name: leg.route?.shortName || leg.mode, route_type: leg.route?.type ?? 3, route_color: leg.route?.color?.replace('#', ''), route_text_color: leg.route?.textColor?.replace('#', '') }}
            />
            {i < legs.length - 1 && <span style={{ fontSize: 10, opacity: 0.3 }}>──</span>}
          </span>
        );
      })}
    </div>
  );
}

// ─── ItineraryCardV2 ──────────────────────────────────────────────────────────

function ItineraryCardV2({ itinerary, index, onClick }) {
  const hasRealtime = itinerary.legs.some(l => l.realTime);
  const transferLabel = itinerary.transfers === 0
    ? 'diretto'
    : `${itinerary.transfers} ${itinerary.transfers === 1 ? 'cambio' : 'cambi'}`;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        width: '100%', textAlign: 'left', background: 'var(--v2-surface-1)',
        border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-r-lg)',
        padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: 'var(--v2-shadow-sm)',
        transition: 'box-shadow 0.15s',
      }}
      aria-label={`Opzione ${index + 1}: ${itinerary.departureTime} - ${itinerary.arrivalTime}, ${itinerary.durationMin} minuti`}
    >
      {/* Time column */}
      <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 56 }}>
        <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--v2-text-1)', lineHeight: 1.1 }}>
          {itinerary.departureTime}
        </div>
        <div style={{ fontSize: 11, color: 'var(--v2-text-3)', marginTop: 2 }}>
          → {itinerary.arrivalTime}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 44, background: 'var(--v2-border)', flexShrink: 0 }} />

      {/* Legs + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <LegStripV2 legs={itinerary.legs} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--v2-text-1)' }}>{itinerary.durationMin} min</span>
          <span style={{ fontSize: 12, color: 'var(--v2-text-3)' }}>·</span>
          <span style={{ fontSize: 12, color: 'var(--v2-text-2)' }}>{transferLabel}</span>
          {itinerary.walkMin > 0 && (
            <>
              <span style={{ fontSize: 12, color: 'var(--v2-text-3)' }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--v2-text-2)' }}>🚶 {itinerary.walkMin} min</span>
            </>
          )}
          {hasRealtime && <span className="v2-rt-dot" />}
        </div>
      </div>

      {/* Arrow */}
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="var(--v2-text-3)" strokeWidth="1.8" strokeLinecap="round">
        <path d="M1 1l5 5-5 5"/>
      </svg>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function JourneyPlannerV2() {
  const navigate = useNavigate();
  const location = useLocation();

  const [fromStop, setFromStop] = useState(location.state?.fromStop ?? null);
  const [toStop, setToStop] = useState(location.state?.toStop ?? null);
  const [arriveBy, setArriveBy] = useState(false);
  const [searched, setSearched] = useState(false);

  const getTopFrequentRoutes = useFavoritesStore(s => s.getTopFrequentRoutes);
  const favStops = useFavoritesStore(s => s.stops);

  const recentStops = Object.values(favStops);

  const { data, isLoading, isError, refetch } = usePlan(
    fromStop?.stopId,
    toStop?.stopId,
    searched,
    { arriveBy },
  );

  // Auto-search if both stops come from location.state
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
  const isFallback = data?.fallback === true;

  return (
    <div className="v2-page" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div className="v2-header">
        <div className="v2-title">Pianifica tragitto</div>
        <div className="v2-subtitle">Fermate e trasporti GTT Torino</div>
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
          marginBottom: 12,
        }}>
          <StopInputV2 label="Da" icon="🟢" stop={fromStop} onPick={setFromStop} recentStops={recentStops} />
          <div style={{ height: 1, background: 'var(--v2-border)', margin: '0 var(--v2-sp-md)' }} />
          <StopInputV2 label="A" icon="🔴" stop={toStop} onPick={setToStop} recentStops={recentStops} />

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
            ⇅
          </button>
        </div>

        {/* Options row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <button
            onClick={() => setArriveBy(!arriveBy)}
            style={{
              background: arriveBy ? 'var(--v2-brand)' : 'var(--v2-surface-2)',
              color: arriveBy ? '#fff' : 'var(--v2-text-2)',
              border: 'none', borderRadius: 'var(--v2-r-pill)',
              padding: '7px 14px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {arriveBy ? '⏰ Arrivo' : '🕐 Partenza'}
          </button>
        </div>

        {/* Search CTA */}
        <button
          className="v2-btn v2-btn-primary"
          style={{ width: '100%', fontSize: 15, opacity: (!fromStop || !toStop) ? 0.5 : 1 }}
          disabled={!fromStop || !toStop}
          onClick={handleSearch}
        >
          Cerca itinerario
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {itineraries.map((itin, i) => (
                      <ItineraryCardV2
                        key={i}
                        itinerary={itin}
                        index={i}
                        onClick={() => {
                          const transitLeg = itin.legs?.find(l => l.tripId);
                          if (transitLeg?.tripId) navigate(`/trips/${transitLeg.tripId}`);
                        }}
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
