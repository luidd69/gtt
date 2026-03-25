/**
 * favoritesStore.js
 * Store Zustand per fermate e linee preferite.
 * Persiste automaticamente in localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useFavoritesStore = create(
  persist(
    (set, get) => ({
      // { stopId: { stopId, stopCode, stopName } }
      stops: {},
      // { routeId: { routeId, routeShortName, routeLongName, routeType } }
      lines: {},

      addStop: (stop) =>
        set((state) => ({
          stops: { ...state.stops, [stop.stopId || stop.stop_id]: {
            stopId: stop.stopId || stop.stop_id,
            stopCode: stop.stopCode || stop.stop_code,
            stopName: stop.stopName || stop.stop_name,
          }},
        })),

      removeStop: (stopId) =>
        set((state) => {
          const stops = { ...state.stops };
          delete stops[stopId];
          return { stops };
        }),

      isStopFavorite: (stopId) => !!get().stops[stopId],

      addLine: (route) =>
        set((state) => ({
          lines: { ...state.lines, [route.routeId || route.route_id]: {
            routeId: route.routeId || route.route_id,
            routeShortName: route.routeShortName || route.route_short_name,
            routeLongName: route.routeLongName || route.route_long_name,
            routeType: route.routeType || route.route_type,
            routeColor: route.routeColor || route.color,
          }},
        })),

      removeLine: (routeId) =>
        set((state) => {
          const lines = { ...state.lines };
          delete lines[routeId];
          return { lines };
        }),

      isLineFavorite: (routeId) => !!get().lines[routeId],
    }),
    {
      name: 'gtt-favorites',
      version: 1,
    }
  )
);

export default useFavoritesStore;
