/**
 * JourneyPlanner.jsx
 * Pianificazione tragitto con:
 *  - modalità "Parti adesso" e "Arriva entro [ora]"
 *  - confronto soluzioni: più veloce · prima disponibile · più affidabile
 *  - salvataggio percorso tra i frequenti
 *  - dettaglio completo: durata, attesa, fermate, ritardo
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useJourney } from '../hooks/useJourney';
import StopPicker from '../components/StopPicker';
import { SkeletonList } from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import { getRouteTypeInfo } from '../utils/formatters';
import useFavoritesStore from '../store/favoritesStore';

// ─── Icone ────────────────────────────────────────────────────────────────────

function IconSwap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16V4m0 0L3 8m4-4l4 4" />
      <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

// ─── Etichette soluzioni ─────────────────────────────────────────────────────

const SOLUTION_LABELS = {
  soonest:  { label: 'Prima disponibile', icon: '⚡', color: 'var(--color-info)' },
  fastest:  { label: 'Più veloce',        icon: '🏃', color: 'var(--color-success)' },
  reliable: { label: 'Più affidabile',    icon: '✓',  color: 'var(--color-brand)' },
};

// ─── Componente singola corsa ────────────────────────────────────────────────

function JourneyCard({ journey, highlighted, onClick }) {
  const typeInfo  = getRouteTypeInfo(journey.routeType);
  const chipStyle = journey.routeColor
    ? { backgroundColor: journey.routeColor, color: journey.routeTextColor || '#fff' }
    : null;

  const isDelayed = journey.realtimeDelay !== null && journey.realtimeDelay > 1;
  const isEarly   = journey.realtimeDelay !== null && journey.realtimeDelay < -1;
  const tags      = journey.solutionTags || [];

  return (
    <button
      className="list-item"
      onClick={onClick}
      style={highlighted ? {
        background: 'var(--color-brand-light)',
        borderLeft: '3px solid var(--color-brand)',
      } : undefined}
      aria-label={`Corsa linea ${journey.routeShortName} direzione ${journey.headsign}, partenza ${journey.departureTime}, durata ${journey.durationMinutes} minuti`}
    >
      {/* Chip linea */}
      <span
        className={`route-chip ${chipStyle ? 'custom' : typeInfo.cssClass}`}
        style={chipStyle ?? undefined}
        aria-hidden="true"
      >
        {journey.routeShortName}
      </span>

      {/* Corpo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Tag soluzioni */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 3, flexWrap: 'wrap' }}>
            {tags.map(tag => {
              const s = SOLUTION_LABELS[tag];
              if (!s) return null;
              return (
                <span key={tag} style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-pill)',
                  background: s.color,
                  color: '#fff',
                  letterSpacing: 0.3,
                }}>
                  {s.icon} {s.label}
                </span>
              );
            })}
          </div>
        )}

        <div className="fw-600 truncate" style={{ fontSize: 15 }}>{journey.headsign}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          {journey.dataType === 'realtime' && (
            <span className="realtime-dot" aria-label="Dati in tempo reale" />
          )}
          <span className="text-xs text-2">
            {journey.durationMinutes} min
          </span>
          <span className="text-xs text-3">·</span>
          <span className="text-xs text-2">
            {journey.waitMinutes != null && journey.waitMinutes <= 120
              ? `attesa ${journey.waitMinutes} min`
              : ''}
          </span>
          {journey.intermediateStops > 0 && (
            <>
              <span className="text-xs text-3">·</span>
              <span className="text-xs text-2">{journey.intermediateStops} fermate</span>
            </>
          )}
        </div>

        {/* Badge ritardo/anticipo */}
        {(isDelayed || isEarly) && (
          <div style={{ marginTop: 3 }}>
            <span className={isDelayed ? 'delay-badge' : 'on-time-badge'}>
              {isDelayed ? `+${journey.realtimeDelay} min` : `${journey.realtimeDelay} min`}
            </span>
          </div>
        )}
      </div>

      {/* Orari */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        flexShrink: 0, gap: 2,
      }}>
        <span style={{
          fontSize: 22, fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-text)',
          lineHeight: 1.1,
        }}>
          {journey.departureTime}
        </span>
        <span className="text-xs text-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
          arr. {journey.arrivalTime}
        </span>
      </div>

      {/* Chevron */}
      <svg className="chevron" width="8" height="13" viewBox="0 0 8 13" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M1 1l6 5.5L1 12" />
      </svg>
    </button>
  );
}

// ─── Modale riepilogo soluzioni ──────────────────────────────────────────────

function SolutionsSummary({ journeys, solutions, onSelect }) {
  if (!journeys.length || !solutions) return null;

  // Raccogli tag unici in ordine (soonest > fastest > reliable)
  const tagOrder = ['soonest', 'fastest', 'reliable'];
  const highlighted = new Set();

  tagOrder.forEach(tag => {
    const idx = solutions[tag];
    if (idx != null) highlighted.add(idx);
  });

  if (highlighted.size === 0) return null;

  // Mostra solo se ci sono differenze tra le soluzioni
  const allSame = highlighted.size === 1 && journeys.length <= 2;
  if (allSame) return null;

  return (
    <div style={{ margin: '0 var(--space-md)', marginBottom: 'var(--space-sm)' }}>
      <div className="section-label" style={{ paddingLeft: 0 }}>Soluzioni consigliate</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tagOrder.map(tag => {
          const idx = solutions[tag];
          if (idx == null) return null;
          const j = journeys[idx];
          const s = SOLUTION_LABELS[tag];
          const typeInfo = getRouteTypeInfo(j.routeType);
          const chipStyle = j.routeColor
            ? { backgroundColor: j.routeColor, color: j.routeTextColor || '#fff' }
            : null;

          return (
            <button
              key={tag}
              onClick={() => onSelect(j)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: 'var(--color-bg-card)',
                border: `1.5px solid ${s.color}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: 'var(--shadow-card)',
              }}
              aria-label={`${s.label}: linea ${j.routeShortName}, partenza ${j.departureTime}`}
            >
              <span style={{
                width: 28, height: 28, borderRadius: '50%',
                background: s.color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
              }}>{s.icon}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {s.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                  <span className={`route-chip ${chipStyle ? 'custom' : typeInfo.cssClass}`}
                    style={chipStyle ?? undefined}>
                    {j.routeShortName}
                  </span>
                  <span className="fw-600 truncate" style={{ fontSize: 14 }}>{j.headsign}</span>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
                  {j.departureTime}
                </div>
                <div className="text-xs text-2">{j.durationMinutes} min</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Pagina principale ───────────────────────────────────────────────────────

export default function JourneyPlanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const addFrequentRoute = useFavoritesStore(s => s.addFrequentRoute);

  // Pre-popola dal state di navigazione (percorsi frequenti)
  const navState = location.state;
  const [fromStop, setFromStop] = useState(
    navState?.fromStop
      ? { stop_id: navState.fromStop.stopId, stop_name: navState.fromStop.stopName, stop_code: navState.fromStop.stopCode }
      : null
  );
  const [toStop, setToStop] = useState(
    navState?.toStop
      ? { stop_id: navState.toStop.stopId, stop_name: navState.toStop.stopName, stop_code: navState.toStop.stopCode }
      : null
  );
  const [searched, setSearched] = useState(false);

  // Modalità orario
  const [searchMode, setSearchMode] = useState('departNow'); // 'departNow' | 'arriveBy'
  const [arriveByTime, setArriveByTime] = useState('');

  // Calcola il valore arriveBy da passare all'hook
  const arriveBy = searchMode === 'arriveBy' && arriveByTime ? arriveByTime : undefined;

  const { data, isLoading, isError, error, refetch } = useJourney(
    fromStop?.stop_id,
    toStop?.stop_id,
    searched,
    { arriveBy }
  );

  const handleSearch = useCallback(() => {
    if (fromStop && toStop && fromStop.stop_id !== toStop.stop_id) {
      setSearched(true);
      if (searched) refetch();
    }
  }, [fromStop, toStop, searched, refetch]);

  const handleSwap = useCallback(() => {
    setFromStop(toStop);
    setToStop(fromStop);
    setSearched(false);
  }, [fromStop, toStop]);

  const handleJourneySelect = useCallback((journey) => {
    // Salva il percorso tra i frequenti
    if (fromStop && toStop) {
      addFrequentRoute(
        { stopId: fromStop.stop_id, stopName: fromStop.stop_name, stopCode: fromStop.stop_code },
        { stopId: toStop.stop_id,   stopName: toStop.stop_name,   stopCode: toStop.stop_code }
      );
    }
    const params = new URLSearchParams();
    if (fromStop) params.set('fromStop', fromStop.stop_id);
    if (toStop)   params.set('toStop',   toStop.stop_id);
    navigate(`/journey/trip/${journey.tripId}?${params.toString()}`);
  }, [navigate, fromStop, toStop, addFrequentRoute]);

  const isSameStop = fromStop && toStop && fromStop.stop_id === toStop.stop_id;
  const canSearch  = fromStop && toStop && !isSameStop &&
    (searchMode === 'departNow' || (searchMode === 'arriveBy' && arriveByTime));
  const journeys   = data?.journeys || [];

  // Orario default per il time picker: ora corrente + 30 min
  const defaultArriveBy = (() => {
    const d = new Date(Date.now() + 30 * 60_000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  })();

  return (
    <div className="page">
      {/* Header sticky */}
      <div className="page-header">
        <div className="page-title">Tragitto</div>

        <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {/* Selettori fermate */}
          <StopPicker
            value={fromStop}
            onChange={(stop) => { setFromStop(stop); setSearched(false); }}
            placeholder="Fermata di partenza…"
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            <button
              onClick={handleSwap}
              disabled={!fromStop && !toStop}
              style={{
                width: 40, height: 40,
                border: '2px solid var(--color-border)',
                borderRadius: '50%',
                background: 'var(--color-bg-card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-card)',
                color: 'var(--color-text-2)',
                flexShrink: 0,
              }}
              aria-label="Inverti partenza e arrivo"
            >
              <IconSwap />
            </button>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>

          <StopPicker
            value={toStop}
            onChange={(stop) => { setToStop(stop); setSearched(false); }}
            placeholder="Fermata di arrivo…"
          />

          {isSameStop && (
            <p style={{ fontSize: 12, color: 'var(--color-danger)', padding: '0 2px' }} role="alert">
              Seleziona due fermate diverse
            </p>
          )}

          {/* Selettore modalità orario */}
          <div style={{
            display: 'flex',
            background: 'var(--color-bg-input)',
            borderRadius: 'var(--radius-pill)',
            padding: 3,
            gap: 3,
          }}
            role="group"
            aria-label="Modalità di ricerca"
          >
            <button
              onClick={() => setSearchMode('departNow')}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: searchMode === 'departNow' ? 'var(--color-bg-card)' : 'transparent',
                color: searchMode === 'departNow' ? 'var(--color-text)' : 'var(--color-text-2)',
                boxShadow: searchMode === 'departNow' ? 'var(--shadow-card)' : 'none',
              }}
              aria-pressed={searchMode === 'departNow'}
            >
              Parti adesso
            </button>
            <button
              onClick={() => {
                setSearchMode('arriveBy');
                if (!arriveByTime) setArriveByTime(defaultArriveBy);
              }}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: searchMode === 'arriveBy' ? 'var(--color-bg-card)' : 'transparent',
                color: searchMode === 'arriveBy' ? 'var(--color-text)' : 'var(--color-text-2)',
                boxShadow: searchMode === 'arriveBy' ? 'var(--shadow-card)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
              aria-pressed={searchMode === 'arriveBy'}
            >
              <IconClock />
              Arriva entro
            </button>
          </div>

          {/* Time picker per "arriva entro" */}
          {searchMode === 'arriveBy' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--color-bg-input)',
              borderRadius: 'var(--radius-md)',
              padding: '10px var(--space-md)',
            }}>
              <IconClock />
              <span style={{ fontSize: 14, color: 'var(--color-text-2)', flexShrink: 0 }}>
                Arrivo entro le
              </span>
              <input
                type="time"
                value={arriveByTime}
                onChange={e => { setArriveByTime(e.target.value); setSearched(false); }}
                style={{
                  flex: 1,
                  border: 'none', background: 'transparent',
                  fontSize: 18, fontWeight: 700,
                  color: 'var(--color-text)',
                  fontVariantNumeric: 'tabular-nums',
                  outline: 'none',
                }}
                aria-label="Orario di arrivo desiderato"
              />
            </div>
          )}

          <button
            className="btn btn-primary btn-full"
            onClick={handleSearch}
            disabled={!canSearch}
            style={{ marginTop: 'var(--space-xs)', minHeight: 48 }}
          >
            Cerca corse
          </button>
        </div>
      </div>

      {/* Contenuto */}
      <div style={{ paddingTop: 'var(--space-md)' }}>

        {!searched && (
          <div className="empty-state">
            <div className="empty-state-icon">🗺️</div>
            <p className="empty-state-title">Pianifica il tragitto</p>
            <p className="empty-state-msg">
              Seleziona partenza e arrivo, poi scegli se vuoi partire adesso
              o arrivare entro un certo orario.
            </p>
            <FrequentRoutesQuickAccess onSelect={(from, to) => {
              setFromStop({ stop_id: from.stopId, stop_name: from.stopName, stop_code: from.stopCode });
              setToStop({ stop_id: to.stopId, stop_name: to.stopName, stop_code: to.stopCode });
            }} />
          </div>
        )}

        {searched && isLoading && <SkeletonList rows={4} />}

        {searched && isError && (
          <ErrorState
            onRetry={refetch}
            message={error?.response?.data?.error || 'Impossibile calcolare il percorso'}
          />
        )}

        {searched && !isLoading && !isError && journeys.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <p className="empty-state-title">Nessuna corsa trovata</p>
            <p className="empty-state-msg">
              {data?.message || `Nessuna corsa diretta ${searchMode === 'arriveBy' ? `prima delle ${arriveByTime}` : 'nei prossimi 120 minuti'}`}
            </p>
          </div>
        )}

        {searched && !isLoading && !isError && journeys.length > 0 && (
          <div>
            {/* Soluzioni consigliate */}
            <SolutionsSummary
              journeys={journeys}
              solutions={data?.solutions}
              onSelect={handleJourneySelect}
            />

            {/* Lista completa */}
            <div className="section-label">
              {journeys.length} {journeys.length === 1 ? 'corsa disponibile' : 'corse disponibili'}
              {searchMode === 'arriveBy' && <span style={{ fontWeight: 400, color: 'var(--color-text-3)' }}> · prima delle {arriveByTime}</span>}
            </div>

            <div className="list-card" style={{ margin: '0 var(--space-md)' }}>
              {journeys.map(j => {
                const isSolution = j.solutionTags?.length > 0;
                return (
                  <JourneyCard
                    key={`${j.tripId}-${j.departureTime}`}
                    journey={j}
                    highlighted={isSolution}
                    onClick={() => handleJourneySelect(j)}
                  />
                );
              })}
            </div>

            {/* Stato realtime */}
            <div className="rt-status-bar" style={{ margin: 'var(--space-sm) var(--space-md) var(--space-md)' }}>
              {data.realtimeAvailable ? (
                <>
                  <span className="realtime-dot" />
                  <span>Orari in tempo reale</span>
                </>
              ) : (
                <span>📅 Orari programmati ufficiali</span>
              )}
              {data.generatedAt && (
                <span style={{ marginLeft: 'auto' }}>
                  {new Date(data.generatedAt).toLocaleTimeString('it-IT', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Percorsi frequenti ──────────────────────────────────────────────────────

function FrequentRoutesQuickAccess({ onSelect }) {
  const getTopFrequentRoutes = useFavoritesStore(s => s.getTopFrequentRoutes);
  const routes = getTopFrequentRoutes();

  if (!routes.length) return null;

  return (
    <div style={{ width: '100%', marginTop: 'var(--space-md)', textAlign: 'left' }}>
      <div className="section-label" style={{ paddingLeft: 0 }}>Percorsi recenti</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {routes.map(r => (
          <button
            key={r.key}
            onClick={() => onSelect(r.fromStop, r.toStop)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer', textAlign: 'left',
              boxShadow: 'var(--shadow-card)',
            }}
            aria-label={`Percorso da ${r.fromStop.stopName} a ${r.toStop.stopName}`}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>🔄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="fw-600 truncate" style={{ fontSize: 14 }}>
                {r.fromStop.stopName}
              </div>
              <div className="text-xs text-2 truncate">
                → {r.toStop.stopName}
              </div>
            </div>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
              stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round"
              aria-hidden="true">
              <path d="M1 1l5 5-5 5"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
