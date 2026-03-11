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
  gameMode: 'standard' | 'practice' | 'study';
  myColor: 'white' | 'black' | null;
  selectedSquare: Square | null;
  ratingDelta: number | null;

  // Actions
  initGame: (
    gameId: string,
    fen: string,
    isBotGame: boolean,
    botLevel: number,
    myColor?: 'white' | 'black' | null,
    gameMode?: 'standard' | 'practice' | 'study',
  ) => void;
  applyMove: (move: Move, newFen: string) => void;
  revertToFen: (previousFen: string, previousMoves: Move[]) => void;
  setStatus: (status: 'idle' | 'active' | 'finished', result?: string | null) => void;
  setSelectedSquare: (square: Square | null) => void;
  setRatingDelta: (delta: number | null) => void;
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
  gameMode: 'standard',
  myColor: null,
  selectedSquare: null,
  ratingDelta: null,

  initGame: (gameId, fen, isBotGame, botLevel, myColor = null, gameMode = 'standard') =>
    set({
      gameId,
      fen,
      chess: new Chess(fen),
      moves: [],
      status: 'active',
      result: null,
      isBotGame,
      botLevel,
      gameMode,
      myColor,
      selectedSquare: null,
    }),

  applyMove: (move, newFen) =>
    set((state) => ({
      fen: newFen,
      chess: new Chess(newFen),
      moves: [...state.moves, move],
      selectedSquare: null,
    })),

  revertToFen: (previousFen, previousMoves) =>
    set({ fen: previousFen, chess: new Chess(previousFen), moves: previousMoves, selectedSquare: null }),

  setStatus: (status, result = undefined) =>
    set({ status, result: result ?? null }),

  setSelectedSquare: (square) =>
    set({ selectedSquare: square }),

  setRatingDelta: (delta) =>
    set({ ratingDelta: delta }),

  resetGame: () =>
    set({
      gameId: null,
      fen: INITIAL_FEN,
      chess: new Chess(),
      moves: [],
      status: 'idle',
      result: null,
      gameMode: 'standard',
      myColor: null,
      ratingDelta: null,
      selectedSquare: null,
    }),
}));
