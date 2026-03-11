import { useCallback, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Square } from 'chess.js';
import { useMutation } from '@tanstack/react-query';
import { useGameStore } from '@/store/gameStore';
import { gameService } from '@/services/game.service';

interface ChessBoardProps {
  gameId: string;
}

export default function ChessBoard({ gameId }: ChessBoardProps) {
  const {
    fen,
    chess,
    status,
    result,
    applyMove,
    setStatus,
    selectedSquare,
    setSelectedSquare,
  } = useGameStore();

  const [boardOrientation] = useState<'white' | 'black'>('white');

  const makeMoveMutation = useMutation({
    mutationFn: (moveData: { from: string; to: string; promotion?: string }) =>
      gameService.makeMove(gameId, moveData),
    onSuccess: (data) => {
      // Apply the player's move
      applyMove(
        { san: data.move.san, uci: data.move.uci, color: chess.turn() === 'w' ? 'b' : 'w' },
        data.move.fen
      );
      // Apply the bot's response move if present
      if (data.botMove) {
        applyMove(
          { san: data.botMove.san, uci: data.botMove.uci, color: 'b' },
          data.botMove.fen
        );
      }
      if (data.isGameOver) {
        setStatus('finished', data.result ?? undefined);
      }
    },
  });

  const onDrop = useCallback(
    (sourceSquare: string, targetSquare: string, piece: string): boolean => {
      if (status !== 'active') return false;
      if (makeMoveMutation.isPending) return false;

      // Determine promotion
      const isPromotion =
        piece.toLowerCase().includes('p') &&
        ((piece.includes('w') && targetSquare[1] === '8') ||
          (piece.includes('b') && targetSquare[1] === '1'));

      makeMoveMutation.mutate({
        from: sourceSquare,
        to: targetSquare,
        promotion: isPromotion ? 'q' : undefined,
      });

      return true;
    },
    [status, makeMoveMutation]
  );

  const onSquareClick = useCallback(
    (square: Square) => {
      if (selectedSquare) {
        if (selectedSquare !== square) {
          makeMoveMutation.mutate({ from: selectedSquare, to: square });
        }
        setSelectedSquare(null);
      } else {
        const piece = chess.get(square);
        if (piece) {
          setSelectedSquare(square);
        }
      }
    },
    [selectedSquare, chess, makeMoveMutation, setSelectedSquare]
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
            <span className="text-blue-400 animate-pulse">Processing...</span>
          )}
        </div>
      )}

      {makeMoveMutation.isError && (
        <p className="text-red-400 text-sm">Invalid move. Try again.</p>
      )}
    </div>
  );
}
