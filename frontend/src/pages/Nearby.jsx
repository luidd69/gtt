/**
 * Nearby.jsx
 * Fermate vicine con geolocalizzazione.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNearbyStops } from '../utils/api';
import { useGeolocation } from '../hooks/useGeolocation';
import StopCard from '../components/StopCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';

export default function Nearby() {
  const { position, error, loading, requestLocation } = useGeolocation();

  // Chiede automaticamente la posizione al mount
  useEffect(() => {
    requestLocation();
  }, []);

  const { data, isLoading: stopsLoading, isError, refetch } = useQuery({
    queryKey: ['nearby', position?.lat, position?.lon],
    queryFn: () => getNearbyStops(position.lat, position.lon, 0.75),
    enabled: !!position,
    staleTime: 30_000,
    refetchInterval: 60_000, // aggiorna ogni minuto
  });

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Fermate vicine</div>
        {position && (
          <div className="page-subtitle">
            Entro 750 m dalla tua posizione
          </div>
        )}
      </div>

      <div className="page-content">
        {/* Richiesta permesso / loading geo */}
        {!position && !error && loading && (
          <LoadingSpinner message="Rilevamento posizione..." />
        )}

        {/* Errore geolocalizzazione */}
        {error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div className="notice notice-warning">
              <span>📍</span>
              <span>{error}</span>
            </div>
            <button className="btn btn-primary btn-full" onClick={requestLocation}>
              Riprova a rilevare posizione
            </button>
          </div>
        )}

        {/* Primo avvio: chiedi permesso */}
        {!position && !error && !loading && (
          <div className="empty-state">
            <div className="empty-state-icon">📍</div>
            <p className="empty-state-title">Trova fermate vicino a te</p>
            <p className="empty-state-msg">
              Per vedere le fermate GTT più vicine, consenti l'accesso alla tua posizione.
            </p>
            <button className="btn btn-primary" onClick={requestLocation}>
              📍 Usa la mia posizione
            </button>
          </div>
        )}

        {/* Loading fermate */}
        {position && stopsLoading && <LoadingSpinner message="Ricerca fermate vicine..." />}

        {/* Errore API */}
        {position && isError && (
          <ErrorState
            onRetry={refetch}
            message="Impossibile caricare le fermate vicine"
          />
        )}

        {/* Risultati */}
        {data?.stops && (
          <>
            {data.stops.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🚏</div>
                <p className="empty-state-title">Nessuna fermata trovata</p>
                <p className="empty-state-msg">
                  Non ci sono fermate GTT entro 750 m dalla tua posizione.
                </p>
              </div>
            ) : (
              <div className="list-card">
                {data.stops.map(stop => (
                  <StopCard
                    key={stop.stop_id}
                    stop={stop}
                    distance={stop.distanceM}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
