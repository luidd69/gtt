/**
 * themeStore.js
 * Store Zustand per la selezione tema v1/v2.
 * Persiste in localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'v1', // 'v1' | 'v2'
      setTheme: (t) => set({ theme: t }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'v1' ? 'v2' : 'v1' })),
    }),
    { name: 'gtt-theme' }
  )
);

export default useThemeStore;
