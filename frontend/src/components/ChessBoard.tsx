import { useCallback, useState } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useMutation } from '@tanstack/react-query';
import { useGameStore } from '@/store/gameStore';
import { gameService } from '@/services/game.service';

// Mirrors react-chessboard's internal type (not re-exported from package root)
type PromotionPieceOption = 'wQ' | 'wR' | 'wN' | 'wB' | 'bQ' | 'bR' | 'bB' | 'bN';

interface ChessBoardProps {
  gameId: string;
}

export default function ChessBoard({ gameId }: ChessBoardProps) {
  const {
    fen,
    chess,
    status,
    result,
    moves,
    applyMove,
    revertToFen,
    setStatus,
    setRatingDelta,
    selectedSquare,
    setSelectedSquare,
  } = useGameStore();

  const [boardOrientation] = useState<'white' | 'black'>('white');
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
          applyMove(
            { san: moveResult.san, uci: `${from}${to}${promotion ?? ''}`, color: moveResult.color },
            tempChess.fen(),
          );
          return true;
        }
      } catch { /* invalid move — board stays unchanged */ }
      return false;
    },
    [chess, applyMove],
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
        if (data.ratingDelta != null) setRatingDelta(data.ratingDelta);
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
  const onDrop = useCallback(
    (sourceSquare: string, targetSquare: string, piece: string): boolean => {
      if (status !== 'active') return false;
      if (makeMoveMutation.isPending) return false;

      const movingPiece = chess.get(sourceSquare as Square);
      const isPromotion =
        movingPiece?.type === 'p' &&
        ((movingPiece.color === 'w' && targetSquare[1] === '8') ||
          (movingPiece.color === 'b' && targetSquare[1] === '1'));

      // piece[1] is the promotion type selected in the dialog: Q/R/B/N → q/r/b/n
      const promotion = isPromotion ? piece[1].toLowerCase() : undefined;

      if (!applyMoveOptimistically(sourceSquare, targetSquare, promotion)) return false;
      makeMoveMutation.mutate({ from: sourceSquare, to: targetSquare, promotion });
      return true;
    },
    [status, makeMoveMutation, chess, applyMoveOptimistically],
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

      // Click-based: library doesn't know the from-square, use our stored state
      if (!fromSquare) {
        const from = pendingPromotion?.from;
        const to = (toSquare as string | undefined) ?? pendingPromotion?.to;
        setPendingPromotion(null);
        if (!from || !to || makeMoveMutation.isPending) return false;
        const promotion = piece[1].toLowerCase();
        if (applyMoveOptimistically(from, to, promotion)) {
          makeMoveMutation.mutate({ from, to, promotion });
        }
        // Return false: prevents library calling handleSetPosition(null, toSquare, …)
        return false;
      }

      // Drag-based: return true → library calls handleSetPosition → onPieceDrop fires
      return true;
    },
    [pendingPromotion, makeMoveMutation, applyMoveOptimistically],
  );

  const onSquareClick = useCallback(
    (square: Square) => {
      if (status !== 'active') return;
      if (makeMoveMutation.isPending) return;

      if (selectedSquare) {
        if (selectedSquare !== square) {
          const movingPiece = chess.get(selectedSquare);
          const isPromotion =
            movingPiece?.type === 'p' &&
            ((movingPiece.color === 'w' && square[1] === '8') ||
              (movingPiece.color === 'b' && square[1] === '1'));

          if (isPromotion) {
            // Show the promotion dialog via the controlled showPromotionDialog prop
            setPendingPromotion({ from: selectedSquare, to: square });
            setSelectedSquare(null);
            return;
          }

          if (applyMoveOptimistically(selectedSquare, square)) {
            makeMoveMutation.mutate({ from: selectedSquare, to: square });
          }
        }
        setSelectedSquare(null);
      } else {
        const piece = chess.get(square);
        if (piece) setSelectedSquare(square);
      }
    },
    [status, selectedSquare, chess, makeMoveMutation, applyMoveOptimistically, setSelectedSquare],
  );

  const getResultMessage = () => {
    if (!result) return '';
    if (result === 'DRAW') return "It's a Draw!";
    if (result === 'WHITE_WIN') return 'White wins!';
    if (result === 'BLACK_WIN') return 'Black wins!';
    return result;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Status Banner */}
      {status === 'finished' && (
        <div className="w-full bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
          <p className="text-yellow-400 font-bold text-lg">Game Over — {getResultMessage()}</p>
        </div>
      )}

      {chess.inCheck() && status === 'active' && (
        <div className="w-full bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
          <p className="text-red-400 font-semibold">Check!</p>
        </div>
      )}

      {/* Chess Board */}
      <div className="w-full max-w-[540px]">
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
          customSquareStyles={
            selectedSquare
              ? { [selectedSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' } }
              : {}
          }
          areArrowsAllowed={true}
          animationDuration={150}
        />
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
