import { NavLink } from 'react-router-dom';

const TABS = [
  {
    to: '/',
    label: 'Home',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        <path d="M3 12L12 4l9 8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9"
          strokeLinecap="round" strokeLinejoin="round"
          fill={active ? 'currentColor' : 'none'}/>
      </svg>
    ),
  },
  {
    to: '/search',
    label: 'Cerca',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <circle cx="11" cy="11" r="7" strokeLinecap="round"/>
        <path d="M16.5 16.5L21 21" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    to: '/map',
    label: 'Mappa',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3,6 9,3 15,6 21,3 21,18 15,21 9,18 3,21"
          fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}/>
        <line x1="9" y1="3" x2="9" y2="18" stroke={active ? 'white' : 'currentColor'} strokeWidth="1.5"/>
        <line x1="15" y1="6" x2="15" y2="21" stroke={active ? 'white' : 'currentColor'} strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    to: '/nearby',
    label: 'Vicine',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth={active ? 0 : 1.8}/>
        <circle cx="12" cy="9" r="2.5" fill={active ? 'white' : 'currentColor'} stroke="none"/>
      </svg>
    ),
  },
  {
    to: '/metro',
    label: 'Metro',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        <rect x="3" y="3" width="18" height="14" rx="3"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth={active ? 0 : 1.8}/>
        <circle cx="8" cy="10" r="1.5" fill={active ? 'white' : 'currentColor'}/>
        <circle cx="16" cy="10" r="1.5" fill={active ? 'white' : 'currentColor'}/>
        <path d="M8 17l-2 4M16 17l2 4M10 17h4" strokeLinecap="round"
          stroke="currentColor" strokeWidth="1.8" fill="none"/>
      </svg>
    ),
  },
  {
    to: '/favorites',
    label: 'Preferiti',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"
          strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navigazione principale">
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          aria-label={tab.label}
        >
          {({ isActive }) => (
            <>
              {tab.icon(isActive)}
              <span className="nav-label">{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
