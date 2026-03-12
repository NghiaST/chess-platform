/**
 * Persisted store for the player's currently active PvP game.
 *
 * Set when a match is found; cleared when the game ends (checkmate,
 * resign, clock timeout, or disconnect forfeit).  Survives page refreshes
 * so the rejoin banner appears even after navigating away.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ActiveGameState {
  gameId: string | null;
  color: 'white' | 'black' | null;
  setActive: (gameId: string, color: 'white' | 'black') => void;
  clearActive: () => void;
}

export const useActiveGameStore = create<ActiveGameState>()(
  persist(
    (set) => ({
      gameId: null,
      color: null,
      setActive: (gameId, color) => set({ gameId, color }),
      clearActive: () => set({ gameId: null, color: null }),
    }),
    { name: 'chess-active-game-v1' },
  ),
);
