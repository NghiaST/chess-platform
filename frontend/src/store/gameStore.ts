import { create } from 'zustand';
import { Chess, Square } from 'chess.js';

interface Move {
  san: string;
  uci: string;
  color: string;
  moveNumber?: number;
}

interface HintArrow {
  from: string;
  to: string;
  san: string;
}

export interface AnalysisArrow {
  from: string;
  to: string;
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
  hintArrow: HintArrow | null;

  // Study mode — local undo/redo stack (no API calls)
  fenStack: string[];       // FEN before each applyLocalMove
  futureMoves: Move[];      // moves available for redo
  futureFens: string[];     // FEN after each undone move

  // Engine evaluation (white-relative centipawns)
  evaluation: number | null;
  evalMate: number | null;

  // Analysis arrows shown on board (study mode)
  analysisArrows: AnalysisArrow[];

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
  /** Apply a move locally (study mode only) — pushes to undo stack. */
  applyLocalMove: (move: Move, newFen: string) => void;
  /** Undo last local move (study mode). */
  localUndo: () => void;
  /** Redo previously undone local move (study mode). */
  localRedo: () => void;
  /** Reset the board to a new FEN (study mode — load position). */
  loadStudyFen: (fen: string) => void;
  /** Load a full PGN into study mode — sets final FEN + full move list. */
  loadStudyPgn: (pgn: string) => void;
  /** Jump to after move k (0 = before any move, moves.length+futureMoves.length = last). */
  jumpToMove: (k: number) => void;
  revertToFen: (previousFen: string, previousMoves: Move[]) => void;
  setStatus: (status: 'idle' | 'active' | 'finished', result?: string | null) => void;
  setSelectedSquare: (square: Square | null) => void;
  setRatingDelta: (delta: number | null) => void;
  setHintArrow: (hint: HintArrow | null) => void;
  setEvaluation: (score: number | null, mate?: number | null) => void;
  setAnalysisArrows: (arrows: AnalysisArrow[]) => void;
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
  hintArrow: null,
  fenStack: [],
  futureMoves: [],
  futureFens: [],
  evaluation: null,
  evalMate: null,
  analysisArrows: [],

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
      hintArrow: null,
      fenStack: [],
      futureMoves: [],
      futureFens: [],
      evaluation: null,
      evalMate: null,
      analysisArrows: [],
    }),

  applyMove: (move, newFen) =>
    set((state) => ({
      fen: newFen,
      chess: new Chess(newFen),
      moves: [
        ...state.moves,
        {
          ...move,
          moveNumber: move.moveNumber ?? state.moves.length + 1,
        },
      ],
      selectedSquare: null,
      hintArrow: null,
    })),

  applyLocalMove: (move, newFen) =>
    set((state) => ({
      fen: newFen,
      chess: new Chess(newFen),
      moves: [
        ...state.moves,
        { ...move, moveNumber: state.moves.length + 1 },
      ],
      fenStack: [...state.fenStack, state.fen],
      futureMoves: [],   // new move clears redo history
      futureFens: [],
      selectedSquare: null,
      hintArrow: null,
      analysisArrows: [], // stale — StudyPanel will refetch
    })),

  localUndo: () =>
    set((state) => {
      if (state.fenStack.length === 0) return {};
      const prevFen = state.fenStack[state.fenStack.length - 1];
      const undoneMove = state.moves[state.moves.length - 1];
      return {
        fen: prevFen,
        chess: new Chess(prevFen),
        moves: state.moves.slice(0, -1),
        fenStack: state.fenStack.slice(0, -1),
        futureMoves: undoneMove ? [undoneMove, ...state.futureMoves] : state.futureMoves,
        futureFens: [state.fen, ...state.futureFens],
        selectedSquare: null,
        hintArrow: null,
        analysisArrows: [],
      };
    }),

  localRedo: () =>
    set((state) => {
      if (state.futureMoves.length === 0) return {};
      const [nextMove, ...restMoves] = state.futureMoves;
      const [nextFen, ...restFens] = state.futureFens;
      return {
        fen: nextFen,
        chess: new Chess(nextFen),
        moves: [...state.moves, nextMove],
        fenStack: [...state.fenStack, state.fen],
        futureMoves: restMoves,
        futureFens: restFens,
        selectedSquare: null,
        hintArrow: null,
        analysisArrows: [],
      };
    }),

  loadStudyFen: (fen) =>
    set({
      fen,
      chess: new Chess(fen),
      moves: [],
      fenStack: [],
      futureMoves: [],
      futureFens: [],
      selectedSquare: null,
      hintArrow: null,
      analysisArrows: [],
      evaluation: null,
      evalMate: null,
    }),

  loadStudyPgn: (pgn) => {
    const chess = new Chess();
    chess.loadPgn(pgn); // throws if invalid
    const history = chess.history({ verbose: true });

    // Replay from scratch to collect every intermediate FEN for the undo stack.
    // fenStack[i] = FEN *before* move i, matching the contract used by applyLocalMove/localUndo.
    const replay = new Chess();
    const fenStack: string[] = [];
    const moves: Move[] = [];
    for (let i = 0; i < history.length; i++) {
      fenStack.push(replay.fen()); // FEN before this move
      const m = history[i];
      replay.move({ from: m.from, to: m.to, promotion: m.promotion });
      moves.push({
        san: m.san,
        uci: `${m.from}${m.to}${m.promotion ?? ''}`,
        color: m.color,
        moveNumber: i + 1,
      });
    }

    set({
      fen: replay.fen(),
      chess: replay,
      moves,
      fenStack,      // populated — undo works move-by-move
      futureMoves: [],
      futureFens: [],
      selectedSquare: null,
      hintArrow: null,
      analysisArrows: [],
      evaluation: null,
      evalMate: null,
    });
  },

  revertToFen: (previousFen, previousMoves) =>
    set({ fen: previousFen, chess: new Chess(previousFen), moves: previousMoves, selectedSquare: null, hintArrow: null }),

  jumpToMove: (k) =>
    set((state) => {
      const allFens  = [...state.fenStack, state.fen, ...state.futureFens];
      const allMoves = [...state.moves, ...state.futureMoves];
      const total    = allMoves.length;
      const target   = Math.max(0, Math.min(k, total));
      return {
        fen:          allFens[target],
        chess:        new Chess(allFens[target]),
        moves:        allMoves.slice(0, target),
        fenStack:     allFens.slice(0, target),
        futureMoves:  allMoves.slice(target),
        futureFens:   allFens.slice(target + 1),
        selectedSquare: null,
        hintArrow:    null,
        analysisArrows: [],
        evaluation:   null,
        evalMate:     null,
      };
    }),

  setStatus: (status, result = undefined) =>
    set({ status, result: result ?? null }),

  setSelectedSquare: (square) =>
    set({ selectedSquare: square }),

  setRatingDelta: (delta) =>
    set({ ratingDelta: delta }),

  setHintArrow: (hint) =>
    set({ hintArrow: hint }),

  setEvaluation: (score, mate = null) =>
    set({ evaluation: score, evalMate: mate }),

  setAnalysisArrows: (arrows) =>
    set({ analysisArrows: arrows }),

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
      hintArrow: null,
      fenStack: [],
      futureMoves: [],
      futureFens: [],
      evaluation: null,
      evalMate: null,
      analysisArrows: [],
    }),
}));
