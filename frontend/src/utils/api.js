/**
 * api.js
 * Client API per comunicare col backend GTT.
 * Centralizza tutti gli endpoint per facile manutenzione.
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
  headers: {
    'Accept': 'application/json',
  },
});

// ─── Stops ────────────────────────────────────────────────────────────────────

export const searchStops = (query) =>
  client.get('/stops/search', { params: { q: query } }).then(r => r.data);

export const getNearbyStops = (lat, lon, radius = 0.5) =>
  client.get('/stops/nearby', { params: { lat, lon, radius } }).then(r => r.data);

export const getStop = (stopId) =>
  client.get(`/stops/${stopId}`).then(r => r.data);

// ─── Lines ────────────────────────────────────────────────────────────────────

export const getLines = (type) =>
  client.get('/lines', { params: type !== undefined ? { type } : {} }).then(r => r.data);

export const getLine = (routeId) =>
  client.get(`/lines/${routeId}`).then(r => r.data);

// ─── Arrivals ─────────────────────────────────────────────────────────────────

export const getArrivals = (stopId, limit = 10) =>
  client.get(`/arrivals/${stopId}`, { params: { limit } }).then(r => r.data);

// ─── Service ─────────────────────────────────────────────────────────────────

export const getServiceStatus = () =>
  client.get('/service/status').then(r => r.data);

export const getVehicles = () =>
  client.get('/service/vehicles').then(r => r.data);

export const getMetroInfo = () =>
  client.get('/service/metro').then(r => r.data);

export const getGtfsInfo = () =>
  client.get('/service/gtfs-info').then(r => r.data);

export const getHealth = () =>
  client.get('/health').then(r => r.data);

// ─── Journey ──────────────────────────────────────────────────────────────────

export const searchJourney = (fromStop, toStop, { lookahead = 120, arriveBy } = {}) => {
  const params = { from: fromStop, to: toStop, lookahead };
  if (arriveBy) params.arriveBy = arriveBy;
  return client.get('/journey/search', { params }).then(r => r.data);
};

export const getTripDetail = (tripId, fromStop, toStop) =>
  client.get(`/journey/trip/${tripId}`, { params: { fromStop, toStop } })
    .then(r => r.data);

export const getTripLive = (tripId) =>
  client.get(`/trips/${tripId}/live`).then(r => r.data);

export const searchMetroJourney = (fromStop, toStop, lookahead = 90) =>
  client.get('/journey/metro', { params: { from: fromStop, to: toStop, lookahead } })
    .then(r => r.data);

export const planJourney = (fromStopId, toStopId, { arriveBy } = {}) =>
  client.get('/journey/plan', {
    params: { from: fromStopId, to: toStopId, ...(arriveBy ? { arriveBy } : {}) },
  }).then(r => r.data);
