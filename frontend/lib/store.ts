'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ParlayLeg } from './types';

interface ParlayStore {
  legs: ParlayLeg[];
  addLeg: (leg: ParlayLeg) => void;
  removeLeg: (marketId: string) => void;
  clearLegs: () => void;
  hasMarket: (marketId: string) => boolean;
}

export const useParlayStore = create<ParlayStore>()(
  persist(
    (set, get) => ({
      legs: [],
      addLeg: (leg) => {
        const { legs } = get();
        if (legs.length >= 5) return;
        if (legs.some(l => l.marketId === leg.marketId)) return;
        set({ legs: [...legs, leg] });
      },
      removeLeg: (marketId) =>
        set(s => ({ legs: s.legs.filter(l => l.marketId !== marketId) })),
      clearLegs: () => set({ legs: [] }),
      hasMarket: (marketId) => get().legs.some(l => l.marketId === marketId),
    }),
    { name: 'parlay-legs' }
  )
);
