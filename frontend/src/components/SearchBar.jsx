/**
 * SearchBar.jsx
 * Barra di ricerca mobile-first con autoclear.
 */

import { useRef } from 'react';

export default function SearchBar({ value, onChange, placeholder = 'Cerca fermata o linea...', autoFocus }) {
  const inputRef = useRef(null);

  return (
    <div className="search-bar" onClick={() => inputRef.current?.focus()}>
      {/* Icona search */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7"/>
        <path d="M16.5 16.5L21 21"/>
      </svg>

      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
        aria-label={placeholder}
      />

      {/* Clear button */}
      {value && (
        <button
          onClick={(e) => { e.stopPropagation(); onChange(''); inputRef.current?.focus(); }}
          style={{
            background: 'var(--color-text-3)',
            border: 'none',
            borderRadius: '50%',
            width: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
          }}
          aria-label="Cancella ricerca"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
            <path d="M1 1l8 8M9 1L1 9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}
