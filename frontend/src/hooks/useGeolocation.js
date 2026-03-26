/**
 * useGeolocation.js
 * Hook per la geolocalizzazione con gestione stato ed errori.
 * Fallback automatico a geolocalizzazione IP quando il GPS non è disponibile.
 */

import { useState, useCallback } from 'react';

const TORINO_CENTER = { lat: 45.0703, lon: 7.6869 };

async function getIpPosition() {
  try {
    const res  = await fetch('https://ipapi.co/json/');
    if (!res.ok) throw new Error('IP API error');
    const data = await res.json();
    if (!data.latitude || !data.longitude) throw new Error('No coordinates');
    return {
      position:      { lat: data.latitude, lon: data.longitude, accuracy: 5000 },
      estimatedCity: data.city || 'posizione stimata',
    };
  } catch {
    return {
      position:      { ...TORINO_CENTER, accuracy: 5000 },
      estimatedCity: 'Torino (posizione di default)',
    };
  }
}

export function useGeolocation() {
  const [state, setState] = useState({
    position:      null,
    error:         null,
    loading:       false,
    isEstimated:   false,
    estimatedCity: null,
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

    setState(s => ({ ...s, loading: true, error: null, isEstimated: false, estimatedCity: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          position: {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
          error:         null,
          loading:       false,
          isEstimated:   false,
          estimatedCity: null,
        });
      },
      async (err) => {
        // GPS non disponibile — prova fallback IP
        const { position, estimatedCity } = await getIpPosition();
        setState({
          position,
          error:         null,
          loading:       false,
          isEstimated:   true,
          estimatedCity,
        });
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
