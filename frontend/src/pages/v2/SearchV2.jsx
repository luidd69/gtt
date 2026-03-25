/**
 * SearchV2.jsx (V2)
 * Ricerca fermate e linee con design V2.
 */

import { useState, useEffect } from 'react';
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
      style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}
    >
      <RouteChip route={route} />
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

const TABS = ['Fermate', 'Linee'];

export default function SearchV2() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const debouncedQuery = useDebounce(query, 300);

  const { data: stopsData, isLoading: stopsLoading, isFetching } = useQuery({
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
            {stopsLoading && isFetching && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--v2-text-3)' }}>
                Ricerca in corso…
              </div>
            )}
            {debouncedQuery.length >= 2 && !stopsLoading && stops.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--v2-text-3)' }}>
                Nessuna fermata trovata per "<strong>{debouncedQuery}</strong>"
              </div>
            )}
            {debouncedQuery.length < 2 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--v2-text-3)' }}>
                Digita almeno 2 caratteri per cercare
              </div>
            )}
            {stops.length > 0 && (
              <div className="v2-list">
                {stops.map(s => (
                  <StopCardV2 key={s.stop_id} stop={{
                    stopId: s.stop_id,
                    stopName: s.stop_name,
                    stopDesc: s.stop_desc,
                  }} />
                ))}
              </div>
            )}
          </>
        ) : (
          <LinesExplorerV2 query={query} />
        )}
      </div>
    </div>
  );
}
