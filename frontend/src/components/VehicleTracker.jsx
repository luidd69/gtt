/**
 * VehicleTracker.jsx
 * Pannello informativo sulla posizione realtime del veicolo.
 *
 * Tre stati:
 *  1. realtime non abilitato → notice-info (orari programmati)
 *  2. realtime attivo ma veicolo non trovato → notice-warning (corsa non iniziata/terminata)
 *  3. veicolo disponibile → card con stato, velocità, occupazione
 *
 * Non usa Leaflet: è un pannello testuale, la mappa è in VehicleMap.jsx.
 * Riusa le classi CSS esistenti: .card, .card-padded, .notice-*, .realtime-dot, .delay-badge
 */

export default function VehicleTracker({ vehicle, realtimeAvailable, routeColor, summary }) {
  // Caso 1: realtime non configurato/disponibile
  if (!realtimeAvailable) {
    return (
      <div className="notice notice-info" style={{ margin: '0 var(--space-md)' }}>
        <span>ℹ️</span>
        <span>Posizione non disponibile · vengono mostrati gli orari programmati ufficiali GTT</span>
      </div>
    );
  }

  // Caso 2: realtime attivo ma il veicolo non è nel feed
  if (!vehicle?.available) {
    return (
      <div className="notice notice-warning" style={{ margin: '0 var(--space-md)' }}>
        <span>⏳</span>
        <span>Corsa non ancora iniziata o posizione temporaneamente non disponibile</span>
      </div>
    );
  }

  // Caso 3: veicolo trovato con posizione
  const color = routeColor || 'var(--color-brand)';
  const delayMin = summary?.delayMinutes;
  const isDelayed = delayMin != null && delayMin > 1;
  const isEarly   = delayMin != null && delayMin < -1;
  const isOnTime  = delayMin != null && !isDelayed && !isEarly;

  const updatedTime = vehicle.timestamp
    ? new Date(vehicle.timestamp).toLocaleTimeString('it-IT', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : null;

  return (
    <div
      className="card card-padded"
      style={{ margin: '0 var(--space-md)', borderLeft: `4px solid ${color}` }}
    >
      {/* Header: stato realtime + delay badge */}
      <div className="flex-row gap-sm" style={{ marginBottom: 'var(--space-sm)' }}>
        <span className="realtime-dot" />
        <span className="text-sm fw-600">In tempo reale</span>

        {isDelayed && (
          <span className="delay-badge" style={{ marginLeft: 'auto' }}>
            +{delayMin} min
          </span>
        )}
        {isEarly && (
          <span
            className="on-time-badge"
            style={{ marginLeft: 'auto', background: 'var(--color-info)' }}
          >
            {Math.abs(delayMin)} min anticipo
          </span>
        )}
        {isOnTime && (
          <span className="on-time-badge" style={{ marginLeft: 'auto' }}>
            In orario
          </span>
        )}
      </div>

      {/* Dati principali */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-md)',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
      }}>
        <div>
          <div className="text-xs text-2">Stato</div>
          <div className="text-sm fw-600">{vehicle.currentStatus}</div>
        </div>

        {vehicle.speed != null && (
          <div>
            <div className="text-xs text-2">Velocità</div>
            <div className="text-sm fw-600">{vehicle.speed} km/h</div>
          </div>
        )}

        {summary?.remainingStops !== undefined && (
          <div>
            <div className="text-xs text-2">Fermate rimanenti</div>
            <div className="text-sm fw-600">{summary.remainingStops}</div>
          </div>
        )}

        {vehicle.occupancy && (
          <div>
            <div className="text-xs text-2">Occupazione</div>
            <div className="text-sm fw-600">{vehicle.occupancy}</div>
          </div>
        )}
      </div>

      {/* Timestamp ultimo aggiornamento */}
      {updatedTime && (
        <div className="text-xs text-3" style={{ marginTop: 'var(--space-sm)' }}>
          Posizione rilevata alle {updatedTime}
        </div>
      )}
    </div>
  );
}
