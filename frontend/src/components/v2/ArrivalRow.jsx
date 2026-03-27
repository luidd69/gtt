/**
 * ArrivalRow.jsx (V2)
 * Riga arrivo con numero linea, destinazione, orario grande e badge stato.
 * Click → mappa veicolo. Pulsante ⏰ → reminder per quell'orario.
 */

import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { truncateHeadsign, formatWait } from '../../utils/formatters';
import { scheduleReminder, requestNotificationPermission } from '../../utils/notifications';
import RouteChip from './RouteChip';
import DelayBadge from './DelayBadge';

const REMINDER_MINS = [2, 5, 10, 15];

function ReminderPanel({ scheduledTime, routeShortName, onClose }) {
  const [mins, setMins]       = useState(5);
  const [scheduled, setScheduled] = useState(false);

  const handleSet = async () => {
    if (!scheduledTime) return;

    if (typeof Notification === 'undefined') {
      alert('Le notifiche non sono supportate da questo browser.');
      return;
    }

    const granted = await requestNotificationPermission();
    if (!granted) {
      alert('Permesso notifiche negato — abilitalo nelle impostazioni del browser.');
      return;
    }

    const [hh, mm] = scheduledTime.split(':').map(Number);
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
    target.setMinutes(target.getMinutes() - mins);
    // Se l'orario è già passato oggi, prova domani
    if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);

    try {
      await scheduleReminder({
        id: `arrival-${routeShortName}-${scheduledTime}-${Date.now()}`,
        title: `⏰ Linea ${routeShortName} — GTT`,
        body: `Tra ${mins} min passa la corsa delle ${scheduledTime}`,
        tag: `gtt-arrival-${routeShortName}-${scheduledTime}`,
        fireAt: target.getTime(),
      });
      setScheduled(true);
    } catch (err) {
      alert(`Errore impostando il reminder: ${err.message}`);
    }
  };

  if (scheduled) {
    return (
      <div style={{
        padding: '10px 14px',
        background: 'var(--v2-on-time-bg)',
        borderTop: '1px solid var(--v2-divider)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 15 }}>✅</span>
        <span style={{ fontSize: 13, color: 'var(--v2-on-time)', fontWeight: 600, flex: 1 }}>
          Reminder: {mins} min prima delle {scheduledTime}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v2-text-3)', fontSize: 18, lineHeight: 1, padding: 0 }}
        >×</button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--v2-surface-2)',
      borderTop: '1px solid var(--v2-divider)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-text-2)', marginBottom: 8 }}>
        ⏰ Reminder per le {scheduledTime} — Linea {routeShortName}
      </div>
      <div style={{ fontSize: 12, color: 'var(--v2-text-3)', marginBottom: 6 }}>Avvisami:</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {REMINDER_MINS.map(m => (
          <button
            key={m}
            onClick={() => setMins(m)}
            style={{
              padding: '5px 12px', border: 'none', borderRadius: 'var(--v2-r-pill)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              background: mins === m ? 'var(--v2-brand)' : 'var(--v2-surface-3)',
              color: mins === m ? '#fff' : 'var(--v2-text-2)',
            }}
          >
            {m} min prima
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSet}
          style={{
            flex: 1, padding: '8px 0', border: 'none', borderRadius: 'var(--v2-r-md)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            background: 'var(--v2-brand)', color: '#fff',
          }}
        >
          Imposta reminder
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '8px 14px', border: '1px solid var(--v2-border)',
            borderRadius: 'var(--v2-r-md)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            background: 'var(--v2-surface-1)', color: 'var(--v2-text-2)',
          }}
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

export default function ArrivalRow({ arrival, fetchedAt, stopId }) {
  const navigate = useNavigate();
  const {
    tripId,
    routeShortName,
    routeType,
    routeColor,
    routeTextColor,
    headsign,
    scheduledTime,
    realtimeTime,
    waitMinutes,
    delayMinutes,
    dataType,
    canceled,
    nextDay,
    nextDayDate,
  } = arrival;

  // Countdown live
  const [liveWait, setLiveWait] = useState(waitMinutes);
  useEffect(() => {
    if (waitMinutes === null || waitMinutes === undefined) return;
    const update = () => {
      const elapsed = fetchedAt ? (Date.now() - fetchedAt) / 60_000 : 0;
      setLiveWait(Math.max(0, Math.round(waitMinutes - elapsed)));
    };
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, [waitMinutes, fetchedAt]);

  const [reminderOpen, setReminderOpen] = useState(false);

  const isRealtime  = dataType === 'realtime';
  const isSoon      = liveWait !== null && liveWait < 3;
  const displayTime = realtimeTime || scheduledTime;
  const waitText    = formatWait(liveWait, displayTime);

  const hasTimeShift = isRealtime && realtimeTime && scheduledTime && realtimeTime !== scheduledTime;
  const shiftLabel = hasTimeShift
    ? (delayMinutes > 0
        ? `+${delayMinutes} min ritardo`
        : `${Math.abs(delayMinutes)} min anticipo`)
    : null;

  const handleClick = () => {
    if (tripId) {
      const params = new URLSearchParams({ tripId });
      if (stopId) params.set('stopId', stopId);
      navigate(`/map?${params.toString()}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        className="v2-list-item"
        onClick={handleClick}
        role={tripId ? 'button' : undefined}
        tabIndex={tripId ? 0 : undefined}
        onKeyDown={tripId ? (e) => e.key === 'Enter' && handleClick() : undefined}
        style={{
          cursor: tripId ? 'pointer' : 'default',
          opacity: canceled ? 0.6 : nextDay ? 0.7 : 1,
          borderLeft: nextDay ? '2px solid var(--v2-text-3)' : undefined,
          paddingLeft: nextDay ? 'calc(var(--v2-sp-md) - 2px)' : undefined,
        }}
        aria-label={tripId ? `Vedi veicolo linea ${routeShortName}` : undefined}
      >
        {/* Chip linea */}
        <RouteChip
          shortName={routeShortName}
          routeType={routeType}
          color={routeColor !== '#null' ? routeColor : null}
          textColor={routeTextColor}
          size="lg"
        />

        {/* Destinazione + stato */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="v2-truncate v2-fw-600"
            style={{
              fontSize: 15,
              textDecoration: canceled ? 'line-through' : 'none',
              color: 'var(--v2-text-1)',
            }}
          >
            {truncateHeadsign(headsign)}
          </div>
          <div className="v2-row v2-gap-xs" style={{ marginTop: 4, alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
            {nextDay && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 700,
                color: 'var(--v2-text-3)',
                background: 'var(--v2-surface-2)',
                border: '1px solid var(--v2-border)',
                borderRadius: 3,
                padding: '1px 5px',
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}>
                Domani{nextDayDate ? ` ${nextDayDate}` : ''}
              </span>
            )}
            {isRealtime && !canceled && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 11, fontWeight: 700, color: '#3A8FFF',
                background: 'rgba(58,143,255,0.10)',
                border: '1px solid rgba(58,143,255,0.20)',
                borderRadius: 4,
                padding: '1px 6px 1px 4px',
                letterSpacing: 0.1,
              }}>
                <svg width="12" height="10" viewBox="0 0 24 18" fill="none" stroke="#3A8FFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 6.5C5.5 2.5 18.5 2.5 23 6.5"/>
                  <path d="M4.5 10.5C7.5 7.5 16.5 7.5 19.5 10.5"/>
                  <path d="M8.5 14.5C10 13 14 13 15.5 14.5"/>
                  <circle cx="12" cy="18" r="1.2" fill="#3A8FFF" stroke="none"/>
                </svg>
                Tempo reale
              </span>
            )}
            <DelayBadge
              delayMinutes={delayMinutes}
              dataType={dataType}
              cancelled={canceled}
            />
          </div>
        </div>

        {/* Orario + attesa + reminder */}
        <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <div className={`v2-arrival-time${isSoon ? ' soon' : ''}`}>
              {isSoon ? waitText : displayTime}
            </div>
            {!canceled && shiftLabel && (
              <div style={{
                fontSize: 11, fontWeight: 700, marginTop: 2,
                color: delayMinutes > 0 ? 'var(--v2-delay-heavy, #e8431b)' : 'var(--v2-delay-early, #2e9e5b)',
                letterSpacing: '0.01em',
              }}>
                {shiftLabel}
              </div>
            )}
            <div className="v2-arrival-wait">
              {isSoon ? (realtimeTime || scheduledTime) : waitText}
              {tripId && !canceled && (
                <span style={{ marginLeft: 4, fontSize: 11 }}>📍</span>
              )}
            </div>
          </div>

          {/* Pulsante reminder — stoppa il click sulla row */}
          {scheduledTime && !canceled && !nextDay && (
            <button
              onClick={e => { e.stopPropagation(); setReminderOpen(o => !o); }}
              title="Imposta reminder"
              aria-label="Imposta reminder"
              style={{
                background: reminderOpen ? 'var(--v2-brand-tint-2)' : 'var(--v2-surface-2)',
                border: '1px solid var(--v2-border)',
                borderRadius: 'var(--v2-r-sm)',
                cursor: 'pointer',
                padding: '5px 7px',
                fontSize: 15,
                color: reminderOpen ? 'var(--v2-brand)' : 'var(--v2-text-3)',
                lineHeight: 1,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              ⏰
            </button>
          )}
        </div>
      </div>

      {/* Panel reminder espandibile */}
      {reminderOpen && scheduledTime && (
        <ReminderPanel
          scheduledTime={scheduledTime}
          routeShortName={routeShortName}
          onClose={() => setReminderOpen(false)}
        />
      )}
    </div>
  );
}
