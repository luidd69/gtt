/**
 * SearchV2.jsx (V2)
 * Ricerca fermate e linee con design V2.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { searchStops, getLines } from '../../utils/api';
import { getRouteTypeInfo } from '../../utils/formatters';
import RouteChip from '../../components/v2/RouteChip';
import StopCardV2 from '../../components/v2/StopCardV2';

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const TYPE_TABS = [
  { type: null, label: 'Tutte' },
  { type: 1, label: '🚇 Metro' },
  { type: 0, label: '🚃 Tram' },
  { type: 3, label: '🚌 Bus' },
];

function LineItemV2({ route }) {
  const info = getRouteTypeInfo(route.route_type);
  return (
    <Link
      to={`/lines/${route.route_id}`}
      className="v2-list-item"
      style={{ textDecoration: 'none' }}
    >
      <RouteChip
        shortName={route.route_short_name}
        routeType={route.route_type}
        color={route.route_color ? `#${route.route_color}` : null}
        textColor={route.route_text_color ? `#${route.route_text_color}` : null}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="v2-fw-600 v2-truncate" style={{ fontSize: 15, color: 'var(--v2-text-1)' }}>
          {route.route_long_name || route.route_short_name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--v2-text-3)' }}>{info.label}</div>
      </div>
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
        stroke="var(--v2-text-3)" strokeWidth="1.8" strokeLinecap="round">
        <path d="M1 1l5 5-5 5"/>
      </svg>
    </Link>
  );
}

function StopsResults({ stops, loading, query }) {
  if (query.length < 2) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--v2-text-3)', fontSize: 14 }}>
        Digita almeno 2 caratteri per cercare
      </div>
    );
  }
  if (loading) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--v2-text-3)', fontSize: 14 }}>
        Ricerca in corso…
      </div>
    );
  }
  if (stops.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--v2-text-3)', fontSize: 14 }}>
        Nessuna fermata trovata per "<strong style={{ color: 'var(--v2-text-2)' }}>{query}</strong>"
      </div>
    );
  }
  return (
    <div className="v2-list">
      {stops.map(s => (
        <StopCardV2
          key={s.stop_id}
          stop={{ stopId: s.stop_id, stopName: s.stop_name, stopDesc: s.stop_desc }}
          routes={s.routes}
        />
      ))}
    </div>
  );
}


function LinesExplorerV2({ query = '' }) {
  const [activeType, setActiveType] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['lines', activeType],
    queryFn: () => getLines(activeType),
    staleTime: 10 * 60_000,
  });

  const q = query.trim().toLowerCase();
  const allRoutes = data?.lines?.flatMap(g => g.routes) ?? [];
  const filtered = q
    ? allRoutes.filter(r =>
        r.route_short_name?.toLowerCase().includes(q) ||
        r.route_long_name?.toLowerCase().includes(q)
      )
    : allRoutes;

  return (
    <div>
      {/* Type filter tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 4 }}>
        {TYPE_TABS.map(t => (
          <button
            key={String(t.type)}
            onClick={() => setActiveType(t.type)}
            style={{
              whiteSpace: 'nowrap',
              padding: '7px 14px',
              borderRadius: 'var(--v2-r-pill)',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: activeType === t.type ? 'var(--v2-brand)' : 'var(--v2-surface-2)',
              color: activeType === t.type ? '#fff' : 'var(--v2-text-2)',
              transition: 'background 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--v2-text-3)' }}>Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--v2-text-3)' }}>
          Nessuna linea trovata
        </div>
      ) : (
        <div className="v2-list">
          {filtered.slice(0, 60).map(route => (
            <LineItemV2 key={route.route_id} route={route} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Fermate vicino a me ───────────────────────────────────────────────────────

function NearbyStops() {
  const [geoState, setGeoState] = useState('idle'); // idle | loading | done | error | denied | unsupported
  const [coords, setCoords]     = useState(null);

  const { data, isFetching } = useQuery({
    queryKey: ['nearby-stops', coords?.lat?.toFixed(4), coords?.lon?.toFixed(4)],
    queryFn: async () => {
      const r = await fetch(`/api/stops/nearby?lat=${coords.lat}&lon=${coords.lon}&radius=0.6`);
      return r.json();
    },
    enabled: !!coords,
    staleTime: 60_000,
  });

  const locate = useCallback(() => {
    if (!window.isSecureContext) { setGeoState('unsupported'); return; }
    if (!navigator.geolocation)  { setGeoState('unsupported'); return; }
    setGeoState('loading');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoState('done');
      },
      err => setGeoState(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, []);

  if (geoState === 'idle') {
    return (
      <button
        onClick={locate}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          padding: '14px 16px', marginBottom: 16,
          background: 'var(--v2-surface-2)', border: '1.5px dashed var(--v2-border)',
          borderRadius: 'var(--v2-r-lg)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--v2-brand)" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/>
          <circle cx="12" cy="9" r="2.5"/>
        </svg>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--v2-brand)' }}>Fermate vicino a me</div>
          <div style={{ fontSize: 12, color: 'var(--v2-text-3)', marginTop: 2 }}>Usa il GPS per trovare fermate nelle vicinanze</div>
        </div>
      </button>
    );
  }

  if (geoState === 'loading' || isFetching) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', color: 'var(--v2-text-3)', fontSize: 14 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        Rilevamento posizione…
      </div>
    );
  }

  if (geoState === 'denied') {
    return (
      <div style={{ padding: '12px 14px', marginBottom: 12, background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 'var(--v2-r-md)', fontSize: 13, color: '#c53030' }}>
        Accesso alla posizione negato — abilitalo nelle impostazioni del browser.
      </div>
    );
  }

  if (geoState === 'unsupported') {
    return (
      <div style={{ padding: '12px 14px', marginBottom: 12, background: 'var(--v2-surface-2)', borderRadius: 'var(--v2-r-md)', fontSize: 13, color: 'var(--v2-text-3)' }}>
        La geolocalizzazione richiede HTTPS.
      </div>
    );
  }

  if (geoState === 'error') {
    return (
      <div style={{ padding: '12px 14px', marginBottom: 12, background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 'var(--v2-r-md)', fontSize: 13, color: '#c53030' }}>
        Impossibile rilevare la posizione. Riprova.
      </div>
    );
  }

  const nearby = data?.stops ?? [];
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          📍 Fermate vicine
        </div>
        <button
          onClick={() => { setGeoState('idle'); setCoords(null); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--v2-text-3)', padding: '2px 4px' }}
        >
          ✕
        </button>
      </div>
      {nearby.length === 0
        ? <div style={{ fontSize: 13, color: 'var(--v2-text-3)', padding: '8px 0' }}>Nessuna fermata trovata nelle vicinanze (600 m).</div>
        : <div className="v2-list">
            {nearby.map(s => (
              <StopCardV2
                key={s.stop_id}
                stop={{ stopId: s.stop_id, stopName: s.stop_name, stopDesc: s.stop_desc }}
                routes={s.routes}
                distanceM={s.distanceKm != null ? Math.round(s.distanceKm * 1000) : undefined}
              />
            ))}
          </div>
      }
    </div>
  );
}

const TABS = ['Fermate', 'Linee'];

// Chiave sessionStorage — si azzera alla chiusura del browser/tab
const SS_QUERY = 'gtt_search_query';
const SS_TAB   = 'gtt_search_tab';

export default function SearchV2() {
  const [query, setQuery] = useState(() => sessionStorage.getItem(SS_QUERY) ?? '');
  const [activeTab, setActiveTab] = useState(() => Number(sessionStorage.getItem(SS_TAB) ?? 0));
  const debouncedQuery = useDebounce(query, 300);

  // Persiste query e tab corrente nella sessione
  useEffect(() => { sessionStorage.setItem(SS_QUERY, query); }, [query]);
  useEffect(() => { sessionStorage.setItem(SS_TAB, String(activeTab)); }, [activeTab]);

  const { data: stopsData, status: stopsStatus, isFetching } = useQuery({
    queryKey: ['search-stops', debouncedQuery],
    queryFn: () => searchStops(debouncedQuery),
    enabled: activeTab === 0 && debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const stops = stopsData?.stops ?? [];

  return (
    <div className="v2-page">
      {/* Header */}
      <div className="v2-header">
        <div className="v2-title">Cerca</div>
      </div>

      <div style={{ padding: 'var(--v2-sp-md)' }}>
        {/* Search bar */}
        <div className="v2-search-bar" style={{ marginBottom: 'var(--v2-sp-md)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--v2-text-3)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7"/>
            <path d="M16.5 16.5L21 21"/>
          </svg>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={activeTab === 0 ? 'Cerca fermata o numero…' : 'Cerca linea…'}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              flex: 1,
              fontSize: 16,
              color: 'var(--v2-text-1)',
              fontFamily: 'inherit',
            }}
            autoFocus
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
              aria-label="Cancella ricerca"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="var(--v2-text-3)" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 'var(--v2-sp-md)', background: 'var(--v2-surface-2)', borderRadius: 'var(--v2-r-md)', padding: 3 }}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setActiveTab(i)}
              style={{
                flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                borderRadius: 'calc(var(--v2-r-md) - 2px)',
                background: activeTab === i ? 'var(--v2-surface-1)' : 'transparent',
                color: activeTab === i ? 'var(--v2-text-1)' : 'var(--v2-text-3)',
                boxShadow: activeTab === i ? 'var(--v2-shadow-sm)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Results */}
        {activeTab === 0 ? (
          <>
            {/* Fermate vicino a me — solo quando la ricerca è vuota */}
            {debouncedQuery.length < 2 && <NearbyStops />}
            <StopsResults
              stops={stops}
              loading={stopsStatus === 'pending' && isFetching}
              query={debouncedQuery}
            />
          </>
        ) : (
          <LinesExplorerV2 query={query} />
        )}
      </div>
    </div>
  );
}
