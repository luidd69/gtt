/**
 * Metro.jsx
 * Sezione dedicata alla metropolitana di Torino (Linea 1 M1).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMetroInfo } from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';

function MetroStationItem({ stop, color }) {
  return (
    <Link
      to={`/stops/${stop.stop_id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 16px',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-input)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* Linea verticale + dot */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
          <div style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: `2.5px solid ${color}`,
            background: 'var(--color-bg-card)',
            flexShrink: 0,
            zIndex: 1,
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fw-600" style={{ fontSize: 15 }}>{stop.stop_name}</div>
          {stop.stop_code && (
            <div className="text-xs text-2">#{stop.stop_code}</div>
          )}
        </div>

        {/* Orario primo passaggio */}
        {stop.departure_time && (
          <span style={{ fontSize: 13, color: 'var(--color-text-2)', fontVariantNumeric: 'tabular-nums' }}>
            {stop.departure_time.substring(0, 5)}
          </span>
        )}

        <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
          stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round">
          <path d="M1 1l5 5-5 5"/>
        </svg>
      </div>
    </Link>
  );
}

function DirectionSection({ direction, color }) {
  const [expanded, setExpanded] = useState(false);
  const stops = direction.stops || [];
  const visibleStops = expanded ? stops : stops.slice(0, 5);

  return (
    <div>
      {/* Header direzione */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px var(--space-md)',
        background: color + '15',
        borderBottom: `1px solid ${color}30`,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color, flexShrink: 0,
        }} />
        <div>
          <div className="text-xs fw-600" style={{ color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Direzione
          </div>
          <div className="fw-700" style={{ fontSize: 16 }}>
            {direction.headsign}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-2)' }}>
          {stops.length} fermate
        </div>
      </div>

      {/* Fermate con linea verticale */}
      <div style={{ position: 'relative' }}>
        {/* Linea verticale di sfondo */}
        <div style={{
          position: 'absolute',
          left: 29, top: 20, bottom: 20,
          width: 2,
          background: color + '40',
          zIndex: 0,
        }} />

        {visibleStops.map((stop, i) => (
          <MetroStationItem key={stop.stop_id} stop={stop} color={color} />
        ))}
      </div>

      {stops.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="btn btn-ghost btn-full"
          style={{ borderRadius: 0, padding: '12px', fontSize: 14 }}
        >
          {expanded ? 'Mostra meno ▲' : `Mostra tutte le ${stops.length} fermate ▼`}
        </button>
      )}
    </div>
  );
}

export default function Metro() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['metro'],
    queryFn: getMetroInfo,
    staleTime: 10 * 60_000,
  });

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>🚇</span>
          <div>
            <div className="page-title">Metropolitana</div>
            <div className="page-subtitle">GTT Torino — Linea M1</div>
          </div>
        </div>
      </div>

      <div style={{ paddingTop: 'var(--space-sm)' }}>
        {isLoading && <LoadingSpinner message="Caricamento dati metro..." />}
        {isError && <ErrorState onRetry={refetch} message="Impossibile caricare i dati della metropolitana" />}

        {data && !data.available && (
          <div className="empty-state" style={{ marginTop: 'var(--space-xl)' }}>
            <div className="empty-state-icon">🚇</div>
            <p className="empty-state-title">Dati non disponibili</p>
            <p className="empty-state-msg">{data.message}</p>
          </div>
        )}

        {data?.available && data.routes.map(route => (
          <div key={route.routeId}>
            {/* Header linea */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 'var(--space-md)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <div style={{
                background: route.color || 'var(--color-metro)',
                color: 'white',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: 1,
              }}>
                {route.name}
              </div>
              <div>
                <div className="fw-600">{route.fullName}</div>
              </div>
            </div>

            {/* Direzioni */}
            {route.directions.map(dir => (
              <div key={dir.direction_id} className="card" style={{ margin: 'var(--space-md)', overflow: 'hidden' }}>
                <DirectionSection direction={dir} color={route.color || 'var(--color-metro)'} />
              </div>
            ))}
          </div>
        ))}

        {/* Nota informativa */}
        <div className="notice notice-info" style={{ margin: 'var(--space-md)' }}>
          <span>ℹ️</span>
          <div>
            <div>Per gli orari in tempo reale della metro, consulta</div>
            <div>
              <a href="https://www.gtt.to.it" style={{ color: 'var(--color-brand)' }} target="_blank" rel="noopener">
                gtt.to.it
              </a>
              {' '}o l'app Muoversi a Torino.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
