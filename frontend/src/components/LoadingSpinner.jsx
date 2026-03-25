export default function LoadingSpinner({ message }) {
  return (
    <div className="spinner-wrap" aria-live="polite" aria-label="Caricamento in corso">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="spinner" />
        {message && <p className="text-sm text-2">{message}</p>}
      </div>
    </div>
  );
}

/** Versione skeleton per liste */
export function SkeletonList({ rows = 4 }) {
  return (
    <div className="list-card" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="skeleton" style={{ height: 14, width: '60%' }} />
            <div className="skeleton" style={{ height: 12, width: '40%' }} />
          </div>
          <div className="skeleton" style={{ width: 48, height: 24, borderRadius: 12 }} />
        </div>
      ))}
    </div>
  );
}
