/**
 * BottomNavV2.jsx (V2)
 * Bottom navigation con indicatore tema attivo e badge reminder.
 */

import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getUiReminders } from '../../utils/notifications';

const TABS = [
  {
    to: '/v2',
    label: 'Home',
    end: true,
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12L12 4l9 8" />
        <path d="M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9"
          fill={active ? 'currentColor' : 'none'} stroke={active ? 'none' : 'currentColor'} strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    to: '/v2/search',
    label: 'Cerca',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M16.5 16.5L21 21" />
      </svg>
    ),
  },
  {
    to: '/v2/journey',
    label: 'Tragitto',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="6" r="2" fill={active ? 'currentColor' : 'none'} />
        <circle cx="19" cy="18" r="2" fill={active ? 'currentColor' : 'none'} />
        <path d="M5 8v3a4 4 0 004 4h6a4 4 0 014 4" />
      </svg>
    ),
  },
  {
    to: '/v2/reminders',
    label: 'Reminder',
    badge: true,
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" fill={active ? 'currentColor' : 'none'} />
        <path d="M13.73 21a2 2 0 01-3.46 0" stroke={active ? 'white' : 'currentColor'} />
      </svg>
    ),
  },
  {
    to: '/v2/info',
    label: 'Info',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" fill={active ? 'currentColor' : 'none'} />
        <line x1="12" y1="16" x2="12" y2="12" stroke={active ? 'white' : 'currentColor'} strokeWidth={active ? 2.2 : 1.8} />
        <line x1="12" y1="8" x2="12.01" y2="8" stroke={active ? 'white' : 'currentColor'} strokeWidth={active ? 2.5 : 2} strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function BottomNavV2() {
  const [reminderCount, setReminderCount] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      setReminderCount(getUiReminders().filter(r => r.fireAt > now).length);
    };
    update();
    // Ricontrolla ogni minuto
    const id = setInterval(update, 60_000);
    // Aggiorna anche quando si torna sulla tab
    window.addEventListener('focus', update);
    return () => { clearInterval(id); window.removeEventListener('focus', update); };
  }, []);

  return (
    <nav className="v2-bottom-nav" role="navigation" aria-label="Navigazione principale">
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `v2-nav-item${isActive ? ' active' : ''}`}
          aria-label={tab.badge && reminderCount > 0 ? `${tab.label} (${reminderCount})` : tab.label}
        >
          {({ isActive }) => (
            <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
              {tab.icon(isActive)}
              {tab.badge && reminderCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4, right: -6,
                  minWidth: 16, height: 16,
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px',
                  lineHeight: 1,
                  border: '1.5px solid var(--v2-bg)',
                }}>
                  {reminderCount}
                </span>
              )}
              <span className="v2-nav-label">{tab.label}</span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
