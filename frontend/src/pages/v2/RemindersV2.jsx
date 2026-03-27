/**
 * RemindersV2.jsx — Lista promemoria attivi (Web Push)
 *
 * Mostra i reminder salvati in localStorage (che riflettono quelli sul backend).
 * Permette di cancellarli.
 */

import { useState, useEffect, useCallback } from 'react';
import { getUiReminders, pruneUiReminders, cancelReminder } from '../../utils/notifications';

function formatCountdown(fireAt) {
  const diff = fireAt - Date.now();
  if (diff <= 0) return 'In scadenza...';
  const totalMin = Math.ceil(diff / 60_000);
  if (totalMin < 60) return `tra ${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `tra ${h}h ${m}min` : `tra ${h}h`;
}

function formatTime(fireAt) {
  return new Date(fireAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export default function RemindersV2() {
  const [reminders, setReminders] = useState([]);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => {
    setReminders(pruneUiReminders());
  }, []);

  useEffect(() => {
    reload();
    const id = setInterval(() => {
      setTick(t => t + 1);
      reload();
    }, 30_000);
    return () => clearInterval(id);
  }, [reload]);

  // Aggiorna countdown ogni minuto
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const handleCancel = async (id) => {
    await cancelReminder(id);
    reload();
  };

  return (
    <div className="v2-page" style={{ paddingBottom: 100 }}>
      <div className="v2-header">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
          Promemoria
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--v2-text-1)' }}>
          Notifiche attive
        </div>
        <div style={{ fontSize: 13, color: 'var(--v2-text-3)', marginTop: 4 }}>
          Le notifiche arrivano anche con l'app chiusa
        </div>
      </div>

      <div style={{ padding: '0 var(--v2-sp-md)' }}>
        {reminders.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--v2-text-3)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔕</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v2-text-2)', marginBottom: 8 }}>
              Nessun promemoria attivo
            </div>
            <div style={{ fontSize: 13 }}>
              Vai su una fermata, premi ⏰ accanto a un orario e imposta un reminder.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reminders.map(r => (
              <div
                key={r.id}
                className="v2-card"
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 'var(--v2-r-md)',
                  background: 'var(--v2-brand-tint-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, flexShrink: 0,
                }}>
                  ⏰
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--v2-text-1)', marginBottom: 3 }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--v2-text-2)', marginBottom: 4 }}>
                    {r.body}
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 700,
                    color: 'var(--v2-brand)',
                    background: 'var(--v2-brand-tint-2)',
                    border: '1px solid var(--v2-brand)',
                    borderRadius: 4,
                    padding: '2px 8px',
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                    </svg>
                    {formatTime(r.fireAt)} · {formatCountdown(r.fireAt)}
                  </div>
                </div>

                <button
                  onClick={() => handleCancel(r.id)}
                  aria-label="Cancella reminder"
                  style={{
                    background: 'var(--v2-surface-2)',
                    border: '1px solid var(--v2-border)',
                    borderRadius: 'var(--v2-r-sm)',
                    padding: '7px 10px',
                    cursor: 'pointer',
                    color: 'var(--v2-text-3)',
                    fontSize: 16,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
