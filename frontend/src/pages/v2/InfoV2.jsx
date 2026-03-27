/**
 * InfoV2.jsx (V2)
 * Pagina informazioni servizio: stato realtime, avvisi, dati GTFS, crediti app.
 */

import { useQuery } from '@tanstack/react-query';
import { getServiceStatus, getGtfsInfo } from '../../utils/api';

function RealtimeBadge({ enabled }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      background: enabled ? 'var(--v2-ok-bg, #d1fadf)' : 'var(--v2-delayed-bg, #fef3c7)',
      color: enabled ? 'var(--v2-ok, #15803d)' : 'var(--v2-delayed, #b45309)',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: enabled ? 'var(--v2-ok, #16a34a)' : 'var(--v2-delayed, #d97706)',
        display: 'inline-block',
        ...(enabled ? {
          boxShadow: '0 0 0 0 rgba(22,163,74,0.4)',
          animation: 'v2-pulse 2s infinite',
        } : {}),
      }} />
      {enabled ? 'Realtime attivo' : 'Solo orari programmati'}
    </span>
  );
}

function ServiceStatusSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['service-status'],
    queryFn: getServiceStatus,
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <section>
      <div className="v2-section-label">Stato realtime</div>
      <div style={{ padding: '0 var(--v2-sp-md)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLoading ? (
          <div className="v2-card" style={{ padding: 'var(--v2-sp-md)' }}>
            <div style={{ color: 'var(--v2-text-3)', fontSize: 14 }}>Caricamento...</div>
          </div>
        ) : (
          <div className="v2-card" style={{
            padding: 'var(--v2-sp-md)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div className="v2-fw-600" style={{ fontSize: 15, color: 'var(--v2-text-1)', marginBottom: 4 }}>
                {data?.realtimeEnabled ? 'Aggiornamenti in tempo reale' : 'Modalità orari programmati'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--v2-text-2)' }}>
                {data?.realtimeEnabled
                  ? 'I passaggi mostrano la posizione live dei veicoli.'
                  : 'Il sistema usa gli orari teorici. Dati realtime non disponibili.'}
              </div>
            </div>
            <RealtimeBadge enabled={!!data?.realtimeEnabled} />
          </div>
        )}
      </div>
    </section>
  );
}

function AlertsSection({ alerts }) {
  if (!alerts || alerts.length === 0) return null;

  const formatPeriod = (period) => {
    if (!period) return null;
    const parts = [];
    if (period.start) {
      parts.push(new Date(period.start * 1000).toLocaleString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }));
    }
    if (period.end) {
      parts.push(new Date(period.end * 1000).toLocaleString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }));
    }
    return parts.length === 2 ? `${parts[0]} — ${parts[1]}` : parts[0] || null;
  };

  return (
    <section>
      <div className="v2-section-label">
        Avvisi di servizio
        <span style={{
          marginLeft: 8,
          background: 'var(--v2-brand)',
          color: '#fff',
          borderRadius: 10,
          padding: '1px 7px',
          fontSize: 11,
          fontWeight: 700,
          verticalAlign: 'middle',
        }}>{alerts.length}</span>
      </div>
      <div className="v2-list" style={{ margin: '0 var(--v2-sp-md)', gap: 8, display: 'flex', flexDirection: 'column' }}>
        {alerts.map((alert, i) => (
          <div key={i} className="v2-card" style={{ padding: 'var(--v2-sp-md)', borderLeft: '3px solid var(--v2-delayed, #d97706)' }}>
            {alert.header && (
              <div className="v2-fw-600" style={{ fontSize: 14, color: 'var(--v2-text-1)', marginBottom: 6 }}>
                {alert.header}
              </div>
            )}
            {alert.description && (
              <div style={{ fontSize: 13, color: 'var(--v2-text-2)', lineHeight: 1.5 }}>
                {alert.description}
              </div>
            )}
            {alert.activePeriods?.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {alert.activePeriods.map((p, j) => {
                  const label = formatPeriod(p);
                  if (!label) return null;
                  return (
                    <div key={j} style={{
                      fontSize: 11, color: 'var(--v2-text-3)',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      {label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function GtfsInfoSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['gtfs-info'],
    queryFn: getGtfsInfo,
    staleTime: 60_000,
    retry: 1,
  });

  const rows = data?.loaded
    ? [
        {
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
          ),
          label: 'Aggiornamento dati',
          value: data.loadedAt
            ? new Date(data.loadedAt).toLocaleString('it-IT', {
                day: '2-digit', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })
            : '—',
        },
        {
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9h18M9 21V9" />
            </svg>
          ),
          label: 'Fermate',
          value: data.stats?.stops != null ? data.stats.stops.toLocaleString('it-IT') : '—',
        },
        {
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 12h18" />
            </svg>
          ),
          label: 'Linee',
          value: data.stats?.routes != null ? data.stats.routes.toLocaleString('it-IT') : '—',
        },
        {
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" />
              <path d="M6 17V9a3 3 0 0 1 3-3h6" /><path d="M15 3l3 2-3 2" />
            </svg>
          ),
          label: 'Corse',
          value: data.stats?.trips != null ? data.stats.trips.toLocaleString('it-IT') : '—',
        },
      ]
    : [];

  return (
    <section>
      <div className="v2-section-label">Dati GTFS</div>
      <div style={{ padding: '0 var(--v2-sp-md)' }}>
        {isLoading ? (
          <div className="v2-card" style={{ padding: 'var(--v2-sp-md)', color: 'var(--v2-text-3)', fontSize: 14 }}>
            Caricamento...
          </div>
        ) : !data?.loaded ? (
          <div className="v2-card" style={{ padding: 'var(--v2-sp-md)', color: 'var(--v2-text-3)', fontSize: 14 }}>
            Dati GTFS non disponibili.
          </div>
        ) : (
          <div className="v2-card" style={{ padding: 0, overflow: 'hidden' }}>
            {rows.map((row, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px var(--v2-sp-md)',
                borderBottom: i < rows.length - 1 ? '1px solid var(--v2-border)' : 'none',
              }}>
                <span style={{ color: 'var(--v2-text-3)', flexShrink: 0 }}>{row.icon}</span>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--v2-text-2)' }}>{row.label}</span>
                <span className="v2-fw-600" style={{ fontSize: 14, color: 'var(--v2-text-1)' }}>{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AppInfoSection() {
  return (
    <section>
      <div className="v2-section-label">App</div>
      <div style={{ padding: '0 var(--v2-sp-md)' }}>
        <div className="v2-card" style={{ padding: 'var(--v2-sp-md)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40,
              borderRadius: 10,
              background: 'var(--v2-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
              boxShadow: '0 2px 8px rgba(232,67,43,.3)',
            }}>
              🚌
            </div>
            <div>
              <div className="v2-fw-600" style={{ fontSize: 15, color: 'var(--v2-text-1)' }}>GTT Torino v2.0</div>
              <div style={{ fontSize: 12, color: 'var(--v2-text-3)' }}>Orari e percorsi GTT</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--v2-border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--v2-text-2)', lineHeight: 1.6 }}>
              Dati orari e fermate:{' '}
              <a
                href="https://www.gtt.to.it"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--v2-brand)', fontWeight: 600, textDecoration: 'none' }}
              >
                GTT Torino
              </a>
            </div>
            <div style={{ fontSize: 13, color: 'var(--v2-text-2)', lineHeight: 1.6 }}>
              Mappe:{' '}
              <a
                href="https://www.openstreetmap.org"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--v2-brand)', fontWeight: 600, textDecoration: 'none' }}
              >
                OpenStreetMap
              </a>{' '}
              contributors
            </div>
          </div>

          <a
            href="https://www.gtt.to.it"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px var(--v2-sp-md)',
              background: 'var(--v2-surface-2)',
              border: '1px solid var(--v2-border)',
              borderRadius: 'var(--v2-r-md)',
              color: 'var(--v2-text-1)',
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Sito ufficiale GTT
          </a>
        </div>
      </div>
    </section>
  );
}

export default function InfoV2() {
  const { data: statusData } = useQuery({
    queryKey: ['service-status'],
    queryFn: getServiceStatus,
    staleTime: 60_000,
    retry: 1,
  });

  const realtimeEnabled = !!statusData?.realtimeEnabled;

  return (
    <div className="v2-page">
      {/* Header sticky */}
      <div className="v2-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="v2-title" style={{ fontSize: 19 }}>Info servizio</div>
          </div>
          <RealtimeBadge enabled={realtimeEnabled} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-sp-md)', paddingTop: 'var(--v2-sp-md)', paddingBottom: 'var(--v2-sp-xl)' }}>
        <ServiceStatusSection />

        {statusData?.alerts?.length > 0 && (
          <AlertsSection alerts={statusData.alerts} />
        )}

        <GtfsInfoSection />

        <AppInfoSection />
      </div>
    </div>
  );
}
