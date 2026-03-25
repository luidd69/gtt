/**
 * Search.jsx
 * Ricerca fermate e linee con autocomplete.
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { searchStops, getLines } from '../utils/api';
import SearchBar from '../components/SearchBar';
import StopCard from '../components/StopCard';
import { getRouteTypeInfo } from '../utils/formatters';
import LoadingSpinner from '../components/LoadingSpinner';

// Debounce semplice per non cercare ad ogni tasto
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function LineItem({ route }) {
  const info = getRouteTypeInfo(route.route_type);
  const chipStyle = route.route_color
    ? { backgroundColor: `#${route.route_color}`, color: route.route_text_color ? `#${route.route_text_color}` : '#fff' }
    : null;

  return (
    <Link to={`/lines/${route.route_id}`} className="list-item" style={{ textDecoration: 'none' }}>
      <span
        className={`route-chip ${chipStyle ? 'custom' : info.cssClass}`}
        style={chipStyle ?? undefined}
      >
        {route.route_short_name}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fw-600 truncate" style={{ fontSize: 15 }}>
          {route.route_long_name || route.route_short_name}
        </div>
        <div className="text-xs text-2">{info.label}</div>
      </div>
      <svg className="chevron" width="8" height="14" viewBox="0 0 8 14" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M1 1l6 6-6 6"/>
      </svg>
    </Link>
  );
}

function LinesExplorer() {
  const [activeType, setActiveType] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['lines', activeType],
    queryFn: () => getLines(activeType),
    staleTime: 10 * 60_000,
  });

  const TYPE_TABS = [
    { type: null, label: 'Tutte' },
    { type: 1,    label: '🚇 Metro' },
    { type: 0,    label: '🚃 Tram' },
    { type: 3,    label: '🚌 Bus' },
  ];

  return (
    <div>
      {/* Tab filter */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 4 }}>
        {TYPE_TABS.map(t => (
          <button
            key={String(t.type)}
            onClick={() => setActiveType(t.type)}
            style={{
              whiteSpace: 'nowrap',
              padding: '7px 14px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              background: activeType === t.type ? 'var(--color-brand)' : 'var(--color-bg-input)',
              color: activeType === t.type ? 'white' : 'var(--color-text)',
              transition: 'background 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="list-card">
          {data?.lines?.flatMap(group => group.routes).map(route => (
            <LineItem key={route.route_id} route={route} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Search() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 280);
  const [activeTab, setActiveTab] = useState('stops'); // 'stops' | 'lines'

  const { data: stopsData, isLoading: stopsLoading } = useQuery({
    queryKey: ['stops-search', debouncedQuery],
    queryFn: () => searchStops(debouncedQuery),
    enabled: debouncedQuery.length >= 2 && activeTab === 'stops',
    staleTime: 30_000,
  });

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Cerca</div>
        <div style={{ marginTop: 10 }}>
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Nome o codice fermata..."
            autoFocus={false}
          />
        </div>

        {/* Tabs fermate / linee */}
        <div style={{ display: 'flex', gap: 0, marginTop: 12, background: 'var(--color-bg-input)', borderRadius: 'var(--radius-sm)', padding: 3 }}>
          {[['stops', 'Fermate'], ['lines', 'Linee']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                flex: 1, padding: '7px 0', border: 'none', borderRadius: 'calc(var(--radius-sm) - 2px)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                background: activeTab === id ? 'var(--color-bg-card)' : 'transparent',
                color: activeTab === id ? 'var(--color-text)' : 'var(--color-text-2)',
                boxShadow: activeTab === id ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content">
        {/* Tab Fermate */}
        {activeTab === 'stops' && (
          <>
            {query.length < 2 && (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <p className="empty-state-msg">Digita il nome o il codice di una fermata</p>
              </div>
            )}

            {query.length >= 2 && stopsLoading && <LoadingSpinner />}

            {stopsData?.stops?.length === 0 && query.length >= 2 && !stopsLoading && (
              <div className="empty-state">
                <div className="empty-state-icon">🚏</div>
                <p className="empty-state-title">Nessuna fermata trovata</p>
                <p className="empty-state-msg">Prova con un nome diverso o il codice fermata</p>
              </div>
            )}

            {stopsData?.stops?.length > 0 && (
              <div className="list-card">
                {stopsData.stops.map(stop => (
                  <StopCard key={stop.stop_id} stop={stop} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Tab Linee */}
        {activeTab === 'lines' && <LinesExplorer />}
      </div>
    </div>
  );
}
