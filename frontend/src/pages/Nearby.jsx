/**
 * Nearby.jsx
 * Fermate vicine con geolocalizzazione.
 * Gestisce il caso HTTP (non-HTTPS) con un messaggio esplicativo
 * e un campo per inserire manualmente le coordinate.
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNearbyStops } from '../utils/api';
import { useGeolocation } from '../hooks/useGeolocation';
import StopCard from '../components/StopCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';

// Fallback manuale: l'utente inserisce il CAP o le coordinate
// In assenza di HTTPS, proponiamo coordinate di Torino centro come default
const TORINO_CENTER = { lat: 45.0703, lon: 7.6869 };

function HttpsWarning({ onUseDefault }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div className="notice notice-warning">
        <span>🔒</span>
        <div>
          <div className="fw-600">HTTPS richiesto per la geolocalizzazione</div>
          <div style={{ marginTop: 4 }}>
            I browser bloccano l'accesso alla posizione GPS su connessioni HTTP.
            Puoi usare le fermate vicine al centro di Torino oppure cercare
            manualmente una fermata dalla pagina <strong>Cerca</strong>.
          </div>
        </div>
      </div>
      <button className="btn btn-secondary btn-full" onClick={onUseDefault}>
        📍 Mostra fermate vicino a Torino centro
      </button>
    </div>
  );
}

export default function Nearby() {
  const { position, error, loading, requestLocation } = useGeolocation();
  const [manualPosition, setManualPosition] = useState(null);

  const isHttpsError = error === 'HTTPS_REQUIRED';
  const activePosition = position || manualPosition;

  // Chiede automaticamente la posizione al mount
  useEffect(() => {
    requestLocation();
  }, []);

  const { data, isLoading: stopsLoading, isError, refetch } = useQuery({
    queryKey: ['nearby', activePosition?.lat, activePosition?.lon],
    queryFn: () => getNearbyStops(activePosition.lat, activePosition.lon, 0.75),
    enabled: !!activePosition,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Fermate vicine</div>
        {activePosition && (
          <div className="page-subtitle">
            {position ? 'Entro 750 m dalla tua posizione' : 'Entro 750 m da Torino centro'}
          </div>
        )}
      </div>

      <div className="page-content">
        {/* Loading geo */}
        {!activePosition && !error && loading && (
          <LoadingSpinner message="Rilevamento posizione..." />
        )}

        {/* Errore HTTPS */}
        {isHttpsError && !manualPosition && (
          <HttpsWarning onUseDefault={() => setManualPosition(TORINO_CENTER)} />
        )}

        {/* Errore geolocalizzazione generico */}
        {error && !isHttpsError && (
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
        {!activePosition && !error && !loading && (
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
        {activePosition && stopsLoading && <LoadingSpinner message="Ricerca fermate vicine..." />}

        {/* Errore API */}
        {activePosition && isError && (
          <ErrorState
            onRetry={refetch}
            message="Impossibile caricare le fermate vicine"
          />
        )}

        {/* Risultati */}
        {activePosition && data?.stops && (
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
