import { create } from 'zustand';

type LobbyStatus = 'idle' | 'searching' | 'matched';

interface LobbyState {
  status: LobbyStatus;
  matchedGameId: string | null;
  myColor: 'white' | 'black' | null;

  setSearching: () => void;
  setMatched: (gameId: string, color: 'white' | 'black') => void;
  reset: () => void;
}

export const useLobbyStore = create<LobbyState>((set) => ({
  status: 'idle',
  matchedGameId: null,
  myColor: null,

  setSearching: () => set({ status: 'searching', matchedGameId: null, myColor: null }),
  setMatched: (gameId, color) => set({ status: 'matched', matchedGameId: gameId, myColor: color }),
  reset: () => set({ status: 'idle', matchedGameId: null, myColor: null }),
}));
