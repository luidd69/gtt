/**
 * useGeolocation.js
 * Hook per la geolocalizzazione con gestione stato ed errori.
 */

import { useState, useCallback } from 'react';

export function useGeolocation() {
  const [state, setState] = useState({
    position: null,
    error: null,
    loading: false,
  });

  const requestLocation = useCallback(() => {
    // I browser moderni bloccano la geolocalizzazione su HTTP (non-localhost).
    // window.isSecureContext è false su http:// con IP/dominio esterno.
    if (!window.isSecureContext) {
      setState(s => ({
        ...s,
        error: 'HTTPS_REQUIRED',
      }));
      return;
    }

    if (!navigator.geolocation) {
      setState(s => ({
        ...s,
        error: 'La geolocalizzazione non è supportata dal tuo browser.',
      }));
      return;
    }

    setState(s => ({ ...s, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          position: {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
          error: null,
          loading: false,
        });
      },
      (err) => {
        let msg;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = 'Permesso di geolocalizzazione negato. Abilitalo nelle impostazioni del browser.';
            break;
          case err.POSITION_UNAVAILABLE:
            msg = 'Posizione non disponibile. Prova in un luogo con copertura GPS.';
            break;
          case err.TIMEOUT:
            msg = 'Timeout nella rilevazione della posizione. Riprova.';
            break;
          default:
            msg = 'Errore nel rilevare la posizione.';
        }
        setState({ position: null, error: msg, loading: false });
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 30_000, // accetta posizione vecchia max 30s
      }
    );
  }, []);

  return { ...state, requestLocation };
}
