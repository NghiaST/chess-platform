import { create } from 'zustand';
import { Chess, Square } from 'chess.js';

interface Move {
  san: string;
  uci: string;
  color: string;
}

interface GameState {
  gameId: string | null;
  fen: string;
  chess: Chess;
  moves: Move[];
  status: 'idle' | 'active' | 'finished';
  result: string | null;
  isBotGame: boolean;
  botLevel: number;
  selectedSquare: Square | null;

  // Actions
  initGame: (gameId: string, fen: string, isBotGame: boolean, botLevel: number) => void;
  applyMove: (move: Move, newFen: string) => void;
  setStatus: (status: 'idle' | 'active' | 'finished', result?: string | null) => void;
  setSelectedSquare: (square: Square | null) => void;
  resetGame: () => void;
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const useGameStore = create<GameState>((set) => ({
  gameId: null,
  fen: INITIAL_FEN,
  chess: new Chess(),
  moves: [],
  status: 'idle',
  result: null,
  isBotGame: true,
  botLevel: 5,
  selectedSquare: null,

  initGame: (gameId, fen, isBotGame, botLevel) =>
    set({
      gameId,
      fen,
      chess: new Chess(fen),
      moves: [],
      status: 'active',
      result: null,
      isBotGame,
      botLevel,
      selectedSquare: null,
    }),

  applyMove: (move, newFen) =>
    set((state) => ({
      fen: newFen,
      chess: new Chess(newFen),
      moves: [...state.moves, move],
      selectedSquare: null,
    })),

  setStatus: (status, result = undefined) =>
    set({ status, result: result ?? null }),

  setSelectedSquare: (square) =>
    set({ selectedSquare: square }),

  resetGame: () =>
    set({
      gameId: null,
      fen: INITIAL_FEN,
      chess: new Chess(),
      moves: [],
      status: 'idle',
      result: null,
      selectedSquare: null,
    }),
}));
