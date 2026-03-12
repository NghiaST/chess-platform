import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import type { Arrow } from 'react-chessboard/dist/chessboard/types';
import { useMutation } from '@tanstack/react-query';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { gameService } from '@/services/game.service';
import { getLegalMoveSquares, isOwnPiece } from '@/utils/chessHelpers';

// Mirrors react-chessboard's internal type (not re-exported from package root)
type PromotionPieceOption = 'wQ' | 'wR' | 'wN' | 'wB' | 'bQ' | 'bR' | 'bB' | 'bN';

/** Maps a pointer position inside the board container rect to a chess square. */
function pixelToSquare(
  rect: DOMRect,
  x: number,
  y: number,
  orientation: 'white' | 'black',
): Square | null {
  const relX = (x - rect.left) / rect.width;
  const relY = (y - rect.top) / rect.height;
  if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;
  const fileIdx = orientation === 'white' ? Math.floor(relX * 8) : 7 - Math.floor(relX * 8);
  const rankIdx = orientation === 'white' ? 7 - Math.floor(relY * 8) : Math.floor(relY * 8);
  if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) return null;
  return `${'abcdefgh'[fileIdx]}${rankIdx + 1}` as Square;
}

/** Converts a square (e.g. e4) to board pixel center coordinates. */
function squareToCenter(
  square: Square,
  boardSize: number,
  orientation: 'white' | 'black',
): { x: number; y: number } {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]) - 1;
  const displayFile = orientation === 'white' ? file : 7 - file;
  const displayRankFromTop = orientation === 'white' ? 7 - rank : rank;
  const cell = boardSize / 8;
  return {
    x: (displayFile + 0.5) * cell,
    y: (displayRankFromTop + 0.5) * cell,
  };
}

interface ChessBoardProps {
  gameId: string;
  /**
   * For multiplayer: emit a socket move instead of calling the REST API.
   * When provided, optimistic updates are skipped (server is source of truth).
   */
  onMakeMove?: (from: string, to: string, promotion?: string) => void;
  /** Which side the current player controls. Defaults to 'white'. */
  boardOrientation?: 'white' | 'black';
  /** 'w' or 'b' — only allow interaction when it's this side's turn. */
  allowedColor?: 'w' | 'b';
}

export default function ChessBoard({
  gameId,
  onMakeMove,
  boardOrientation = 'white',
  allowedColor,
}: ChessBoardProps) {
  const {
    fen,
    chess,
    status,
    result,
    moves,
    gameMode,
    applyMove,
    applyLocalMove,
    revertToFen,
    setStatus,
    setRatingDelta,
    selectedSquare,
    setSelectedSquare,
    hintArrow,
    analysisArrows,
  } = useGameStore();
  const { user, updateRating } = useAuthStore();
  const { showLegalMoves, annotationColor } = useSettingsStore();

  // Annotation state: circles (right-click single square) + arrows (right-click drag)
  const [circleSquares, setCircleSquares] = useState<Set<Square>>(new Set());
  const [managedArrows, setManagedArrows] = useState<Arrow[]>([]);
  const rightDragStart = useRef<Square | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardPx, setBoardPx] = useState(0);
  const annotationColorRef = useRef(annotationColor);
  useEffect(() => { annotationColorRef.current = annotationColor; }, [annotationColor]);

  useEffect(() => {
    const updateBoardSize = () => {
      setBoardPx(boardContainerRef.current?.clientWidth ?? 0);
    };

    updateBoardSize();
    window.addEventListener('resize', updateBoardSize);

    const observer = new ResizeObserver(updateBoardSize);
    if (boardContainerRef.current) observer.observe(boardContainerRef.current);

    return () => {
      window.removeEventListener('resize', updateBoardSize);
      observer.disconnect();
    };
  }, []);

  const clearAnnotations = useCallback(() => {
    setCircleSquares(new Set());
    setManagedArrows([]);
  }, []);

  // Right-click mouse-down: record starting square for potential arrow drag
  const handleBoardMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 2) return;
    const rect = boardContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    rightDragStart.current = pixelToSquare(rect, e.clientX, e.clientY, boardOrientation);
  }, [boardOrientation]);

  // Right-click mouse-up: single click = toggle circle, drag = toggle arrow
  const handleBoardMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 2) return;
    const start = rightDragStart.current;
    rightDragStart.current = null;
    if (!start) return;
    const rect = boardContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const end = pixelToSquare(rect, e.clientX, e.clientY, boardOrientation);
    if (!end) return;

    if (start === end) {
      setCircleSquares((prev) => {
        const next = new Set(prev);
        if (next.has(start)) next.delete(start);
        else next.add(start);
        return next;
      });
    } else {
      setManagedArrows((prev) => {
        const exists = prev.some((a) => a[0] === start && a[1] === end);
        if (exists) return prev.filter((a) => !(a[0] === start && a[1] === end));
        // Allow multiple arrows to share the same destination square.
        return [...prev, [start, end, annotationColorRef.current]];
      });
    }
  }, [boardOrientation]);

  // Hotkey C — clear all annotations
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) {
        clearAnnotations();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clearAnnotations]);

  // Pending promotion square info for click-based pawn promotion
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);

  /**
   * Optimistically apply the player's move to local state before the API returns.
   * Uses chess.js to validate and compute the resulting FEN.
   */
  const applyMoveOptimistically = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      const tempChess = new Chess(chess.fen());
      try {
        const moveResult = tempChess.move({
          from,
          to,
          promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
        });
        if (moveResult) {
          const moveData = { san: moveResult.san, uci: `${from}${to}${promotion ?? ''}`, color: moveResult.color };
          if (gameMode === 'study') {
            applyLocalMove(moveData, tempChess.fen());
          } else {
            applyMove(moveData, tempChess.fen());
          }
          return true;
        }
      } catch { /* invalid move — board stays unchanged */ }
      return false;
    },
    [chess, applyMove, applyLocalMove, gameMode],
  );

  const makeMoveMutation = useMutation({
    mutationFn: (moveData: { from: string; to: string; promotion?: string }) =>
      gameService.makeMove(gameId, moveData),

    // Capture pre-update state for rollback. Runs synchronously before the fetch starts;
    // Zustand has already updated its store but React hasn't re-rendered, so `fen`/`moves`
    // in this closure still hold the pre-optimistic-update values.
    onMutate: () => ({ prevFen: fen, prevMoves: [...moves] }),

    onSuccess: (data) => {
      // Player's move was already applied optimistically — only apply the bot's response.
      if (data.botMove) {
        applyMove(
          { san: data.botMove.san, uci: data.botMove.uci, color: 'b' },
          data.botMove.fen,
        );
      }
      if (data.isGameOver) {
        setStatus('finished', data.result ?? undefined);
        if (data.ratingDelta != null) {
          setRatingDelta(data.ratingDelta);
          updateRating((user?.rating ?? 0) + data.ratingDelta);
        }
      }
    },

    onError: (_err, _variables, context) => {
      // Roll back the optimistic board update
      if (context) revertToFen(context.prevFen, context.prevMoves);
    },
  });

  /**
   * react-chessboard calls this when a piece is dropped.
   *
   * For promotion moves: the library shows a promotion dialog first; onPieceDrop is called
   * AFTER the user picks a piece, with `piece` set to the selected piece (e.g. 'wQ'), not 'wP'.
   * We detect promotion by inspecting the source square via chess.js, and extract the chosen
   * promotion type from the `piece` parameter.
   */
  const dispatchMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      // Study mode: fully local, no API call, no bot
      if (gameMode === 'study') {
        applyMoveOptimistically(from, to, promotion);
        return;
      }
      if (onMakeMove) {
        // Multiplayer path: apply locally then let socket confirm
        applyMoveOptimistically(from, to, promotion);
        onMakeMove(from, to, promotion);
      } else {
        // Bot / solo path: optimistic update + REST call
        if (applyMoveOptimistically(from, to, promotion)) {
          makeMoveMutation.mutate({ from, to, promotion });
        }
      }
    },
    [gameMode, onMakeMove, applyMoveOptimistically, makeMoveMutation],
  );

  const onDrop = useCallback(
    (sourceSquare: string, targetSquare: string, piece: string): boolean => {
      if (status !== 'active') return false;
      if (!onMakeMove && makeMoveMutation.isPending && gameMode !== 'study') return false;
      if (allowedColor && chess.turn() !== allowedColor) return false;

      const movingPiece = chess.get(sourceSquare as Square);
      const isPromotion =
        movingPiece?.type === 'p' &&
        ((movingPiece.color === 'w' && targetSquare[1] === '8') ||
          (movingPiece.color === 'b' && targetSquare[1] === '1'));

      const promotion = isPromotion ? piece[1].toLowerCase() : undefined;

      if (!onMakeMove && !applyMoveOptimistically(sourceSquare, targetSquare, promotion)) return false;
      if (onMakeMove) {
        applyMoveOptimistically(sourceSquare, targetSquare, promotion);
        onMakeMove(sourceSquare, targetSquare, promotion);
        return true;
      }
      if (gameMode === 'study') return true; // already applied locally above
      makeMoveMutation.mutate({ from: sourceSquare, to: targetSquare, promotion });
      return true;
    },
    [status, onMakeMove, makeMoveMutation, chess, allowedColor, applyMoveOptimistically],
  );

  /**
   * Called when the user selects a piece in the promotion dialog.
   *
   * - Drag-based promotion: `fromSquare` is provided by the library → return true so the
   *   library calls handleSetPosition, which then triggers onPieceDrop with the selected piece.
   * - Click-based promotion (manually shown dialog): `fromSquare` is undefined → we apply the
   *   move ourselves using `pendingPromotion` and return false to prevent the library from
   *   calling handleSetPosition with a null source.
   */
  const onPromotionPieceSelect = useCallback(
    (piece?: PromotionPieceOption, fromSquare?: Square, toSquare?: Square): boolean => {
      if (!piece) {
        setPendingPromotion(null);
        return false;
      }

      if (!fromSquare) {
        const from = pendingPromotion?.from;
        const to = (toSquare as string | undefined) ?? pendingPromotion?.to;
        setPendingPromotion(null);
        if (!from || !to || (!onMakeMove && makeMoveMutation.isPending)) return false;
        const promotion = piece[1].toLowerCase();
        dispatchMove(from, to, promotion);
        return false;
      }

      return true;
    },
    [pendingPromotion, onMakeMove, makeMoveMutation, dispatchMove],
  );

  const onSquareClick = useCallback(
    (square: Square) => {
      // Left-click always clears annotations (circles + arrows)
      clearAnnotations();

      if (status !== 'active') return;
      if (!onMakeMove && makeMoveMutation.isPending) return;
      if (allowedColor && chess.turn() !== allowedColor) return;

      if (selectedSquare) {
        if (selectedSquare === square) {
          // Clicking the same square deselects
          setSelectedSquare(null);
          return;
        }

        // If the clicked square has one of the current player's own pieces, switch selection
        if (isOwnPiece(chess, square)) {
          setSelectedSquare(square);
          return;
        }

        const movingPiece = chess.get(selectedSquare);
        const isPromotion =
          movingPiece?.type === 'p' &&
          ((movingPiece.color === 'w' && square[1] === '8') ||
            (movingPiece.color === 'b' && square[1] === '1'));

        if (isPromotion) {
          setPendingPromotion({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          return;
        }

        dispatchMove(selectedSquare, square);
        setSelectedSquare(null);
      } else {
        const piece = chess.get(square);
        if (piece) setSelectedSquare(square);
      }
    },
    [status, onMakeMove, selectedSquare, chess, makeMoveMutation, allowedColor, dispatchMove, setSelectedSquare, clearAnnotations],
  );

  const getResultMessage = () => {
    if (!result) return '';
    if (result === 'DRAW') return "It's a Draw!";
    if (result === 'WHITE_WIN') return 'White wins!';
    if (result === 'BLACK_WIN') return 'Black wins!';
    return result;
  };

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: 'rgba(255, 255, 0, 0.4)' };
    }

    if (showLegalMoves && selectedSquare) {
      for (const sq of getLegalMoveSquares(chess, selectedSquare)) {
        const hasOccupant = !!chess.get(sq);
        styles[sq] = hasOccupant
          ? { background: 'radial-gradient(circle, transparent 60%, rgba(0,0,0,0.25) 60%)' }
          : { background: 'radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 25%)' };
      }
    }

    // Circle annotations — donut ring, fully contained within the square (no edge bleed)
    for (const sq of circleSquares) {
      styles[sq] = {
        ...styles[sq],
        background: `radial-gradient(circle, transparent 60%, ${annotationColor}cc 60%, ${annotationColor}cc 78%, transparent 78%)`,
      };
    }

    return styles;
  }, [selectedSquare, showLegalMoves, chess, circleSquares, annotationColor]);

  const renderedArrows = useMemo(() => {
    if (!boardPx) return [];

    return managedArrows
      .map((a, idx) => {
        const from = squareToCenter(a[0] as Square, boardPx, boardOrientation);
        const to = squareToCenter(a[1] as Square, boardPx, boardOrientation);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const r = Math.hypot(dx, dy);
        if (!r) return null;

        const reducer = boardPx / 32;
        const end = {
          x: from.x + (dx * (r - reducer)) / r,
          y: from.y + (dy * (r - reducer)) / r,
        };

        return {
          id: `managed-arrow-${idx}`,
          color: a[2] ?? annotationColor,
          from,
          end,
        };
      })
      .filter((v): v is { id: string; color: string; from: { x: number; y: number }; end: { x: number; y: number } } => !!v);
  }, [managedArrows, boardPx, boardOrientation, annotationColor]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Status Banner - Fixed height container to prevent layout shift */}
      <div className="w-full min-h-[60px] flex items-center justify-center">
        {status === 'finished' && (
          <div className="w-full bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
            <p className="text-yellow-400 font-bold text-lg">Game Over — {getResultMessage()}</p>
          </div>
        )}

        {allowedColor && chess.turn() !== allowedColor && status === 'active' && (
          <div className="w-full bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-center">
            <p className="text-blue-400 font-semibold">Opponent's turn</p>
          </div>
        )}

        {chess.inCheck() && status === 'active' && (
          <div className="w-full bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
            <p className="text-red-400 font-semibold">Check!</p>
          </div>
        )}
      </div>

      {/* Chess Board */}
      <div
        ref={boardContainerRef}
        className="w-full max-w-[540px] relative"
        onMouseDown={handleBoardMouseDown}
        onMouseUp={handleBoardMouseUp}
        onMouseLeave={() => { rightDragStart.current = null; }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Chessboard
          id="main-board"
          position={fen}
          onPieceDrop={onDrop}
          onSquareClick={onSquareClick}
          onPromotionPieceSelect={onPromotionPieceSelect}
          promotionToSquare={pendingPromotion?.to as Square | null ?? null}
          showPromotionDialog={!!pendingPromotion}
          boardOrientation={boardOrientation}
          customBoardStyle={{
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
          customDarkSquareStyle={{ backgroundColor: '#B58863' }}
          customLightSquareStyle={{ backgroundColor: '#F0D9B5' }}
          customSquareStyles={customSquareStyles}
          areArrowsAllowed={false}
          animationDuration={150}
        />

        {/* Custom arrow layer with fixed length behavior (no shortening on shared destination) */}
        <svg
          width={boardPx}
          height={boardPx}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 10 }}
        >
          {/* Hint arrow (green) from practice mode */}
          {hintArrow && boardPx > 0 && (() => {
            const from = squareToCenter(hintArrow.from as Square, boardPx, boardOrientation);
            const to = squareToCenter(hintArrow.to as Square, boardPx, boardOrientation);
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const r = Math.hypot(dx, dy);
            if (!r) return null;
            const reducer = boardPx / 32;
            const end = { x: from.x + (dx * (r - reducer)) / r, y: from.y + (dy * (r - reducer)) / r };
            return (
              <g key="hint-arrow">
                <marker id="hint-arrow-head" markerWidth="2" markerHeight="2.5" refX="1.25" refY="1.25" orient="auto">
                  <polygon points="0.3 0, 2 1.25, 0.3 2.5" fill="#22c55e" />
                </marker>
                <line
                  x1={from.x} y1={from.y} x2={end.x} y2={end.y}
                  opacity="0.80"
                  stroke="#22c55e"
                  strokeWidth={boardPx / 36}
                  markerEnd="url(#hint-arrow-head)"
                />
              </g>
            );
          })()}

          {/* Analysis arrows (study mode) — one per engine line, coloured by rank */}
          {boardPx > 0 && analysisArrows.map((arrow, idx) => {
            const from = squareToCenter(arrow.from as Square, boardPx, boardOrientation);
            const to = squareToCenter(arrow.to as Square, boardPx, boardOrientation);
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const r = Math.hypot(dx, dy);
            if (!r) return null;
            const reducer = boardPx / 32;
            const end = { x: from.x + (dx * (r - reducer)) / r, y: from.y + (dy * (r - reducer)) / r };
            const markerId = `analysis-arrow-head-${idx}`;
            return (
              <g key={`analysis-arrow-${idx}`}>
                <marker id={markerId} markerWidth="2" markerHeight="2.5" refX="1.25" refY="1.25" orient="auto">
                  <polygon points="0.3 0, 2 1.25, 0.3 2.5" fill={arrow.color} />
                </marker>
                <line
                  x1={from.x} y1={from.y} x2={end.x} y2={end.y}
                  opacity="0.72"
                  stroke={arrow.color}
                  strokeWidth={boardPx / 38}
                  markerEnd={`url(#${markerId})`}
                />
              </g>
            );
          })}
          {renderedArrows.map((arrow) => (
            <g key={arrow.id}>
              <marker
                id={`${arrow.id}-head`}
                markerWidth="2"
                markerHeight="2.5"
                refX="1.25"
                refY="1.25"
                orient="auto"
              >
                <polygon points="0.3 0, 2 1.25, 0.3 2.5" fill={arrow.color} />
              </marker>
              <line
                x1={arrow.from.x}
                y1={arrow.from.y}
                x2={arrow.end.x}
                y2={arrow.end.y}
                opacity="0.65"
                stroke={arrow.color}
                strokeWidth={boardPx / 40}
                markerEnd={`url(#${arrow.id}-head)`}
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Turn indicator */}
      {status === 'active' && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div
            className={`w-3 h-3 rounded-full border border-gray-600 ${
              chess.turn() === 'w' ? 'bg-white' : 'bg-gray-900'
            }`}
          />
          <span>{chess.turn() === 'w' ? 'White' : 'Black'} to move</span>
          {makeMoveMutation.isPending && (
            <span className="text-blue-400 animate-pulse">Waiting for bot...</span>
          )}
        </div>
      )}

      {makeMoveMutation.isError && (
        <p className="text-red-400 text-sm">Invalid move. Try again.</p>
      )}
    </div>
  );
}
