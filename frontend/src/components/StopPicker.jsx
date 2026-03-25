/**
 * StopPicker.jsx
 * Input controllato per la selezione di una fermata.
 * Mostra un dropdown di ricerca con debounce.
 * Riusa le classi CSS esistenti: .search-bar, .list-item, .stop-picker-dropdown
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchStops } from '../utils/api';
import { formatStopName, extractStopCode } from '../utils/formatters';

function useDebounce(value, delay = 280) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Icona cerca
function IconSearch() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L21 21" />
    </svg>
  );
}

// Icona X (clear)
function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * @param {Object}   props
 * @param {Object}   props.value       - Fermata selezionata { stop_id, stop_name, ... } o null
 * @param {Function} props.onChange    - Callback con la fermata selezionata o null
 * @param {string}   props.placeholder - Testo placeholder dell'input
 */
export default function StopPicker({ value, onChange, placeholder = 'Cerca fermata...' }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounce(query);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['stops-search-picker', debouncedQuery],
    queryFn: () => searchStops(debouncedQuery),
    enabled: debouncedQuery.length >= 2 && isOpen,
    staleTime: 30_000,
  });

  // Chiude il dropdown cliccando fuori
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        if (!value) setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  // Focus input quando si apre
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = useCallback((stop) => {
    onChange(stop);
    setQuery('');
    setIsOpen(false);
  }, [onChange]);

  const handleClear = useCallback((e) => {
    e.stopPropagation();
    onChange(null);
    setQuery('');
    setIsOpen(true);
  }, [onChange]);

  const stops = data?.stops || [];
  const stopName = value ? (formatStopName(value.stop_name) || value.stop_name) : null;
  const stopCode = value ? (extractStopCode(value.stop_name) || value.stop_code) : null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Valore selezionato — mostra nome fermata */}
      {value && !isOpen ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsOpen(true)}
          onKeyDown={(e) => e.key === 'Enter' && setIsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            background: 'var(--color-bg-input)',
            borderRadius: 'var(--radius-pill)',
            padding: '10px var(--space-md)',
            cursor: 'pointer',
            border: '2px solid var(--color-brand)',
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>🚏</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="fw-600 truncate" style={{ fontSize: 15 }}>{stopName}</div>
            {stopCode && (
              <div className="text-xs text-2">#{stopCode}</div>
            )}
          </div>
          <button
            onClick={handleClear}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-2)', padding: 4, flexShrink: 0,
            }}
            aria-label="Rimuovi selezione"
          >
            <IconX />
          </button>
        </div>
      ) : (
        /* Input di ricerca */
        <div className="search-bar" style={{ border: isOpen ? '2px solid var(--color-brand)' : '2px solid transparent' }}>
          <IconSearch />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-label={placeholder}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-2)', padding: 2 }}
              aria-label="Cancella ricerca"
            >
              <IconX />
            </button>
          )}
        </div>
      )}

      {/* Dropdown risultati */}
      {isOpen && (
        <div className="stop-picker-dropdown">
          {debouncedQuery.length < 2 ? (
            <div style={{ padding: 'var(--space-md)', color: 'var(--color-text-3)', fontSize: 14 }}>
              Digita almeno 2 caratteri…
            </div>
          ) : isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-md)' }}>
              <div className="spinner" style={{ width: 20, height: 20 }} />
            </div>
          ) : stops.length === 0 ? (
            <div style={{ padding: 'var(--space-md)', color: 'var(--color-text-2)', fontSize: 14 }}>
              Nessuna fermata trovata
            </div>
          ) : (
            stops.map(stop => {
              const name = formatStopName(stop.stop_name) || stop.stop_name;
              const code = extractStopCode(stop.stop_name) || stop.stop_code;
              return (
                <button
                  key={stop.stop_id}
                  className="list-item"
                  onClick={() => handleSelect(stop)}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>🚏</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fw-600 truncate">{name}</div>
                    <div className="text-xs text-2">#{code}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
