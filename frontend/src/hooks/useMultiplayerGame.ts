/**
 * useMultiplayerGame — socket event handler for live multiplayer games.
 *
 * Attaches all game:* listeners on mount and cleans them up on unmount.
 * Exposes `emitMove` and `emitResign` so the board / resign button can
 * send events without knowing about the socket directly.
 */
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/authStore';
import { connectSocket, getSocket } from '@/services/socket.service';

interface GameMovePayload {
  move: { san: string; uci: string; color: string };
  fen: string;
  status: string;
  result: string | null;
}

interface GameEndedPayload {
  result: string;
  whiteRatingDelta: number;
  blackRatingDelta: number;
}

export function useMultiplayerGame(gameId: string | null, myColor: 'white' | 'black' | null) {
  const { applyMove, setStatus, setRatingDelta } = useGameStore();
  const { token } = useAuthStore();
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [opponentUsername, setOpponentUsername] = useState<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!gameId || !myColor || !token) return;

    // Ensure socket is connected (handles direct URL visits / reconnects)
    const socket = connectSocket(token);

    const handleMove = (payload: GameMovePayload) => {
      applyMove(payload.move, payload.fen);
      if (payload.status === 'FINISHED') {
        setStatus('finished', payload.result ?? undefined);
      }
    };

    const handleEnded = (payload: GameEndedPayload) => {
      setStatus('finished', payload.result);
      const delta = myColor === 'white' ? payload.whiteRatingDelta : payload.blackRatingDelta;
      setRatingDelta(delta);
    };

    const handleOpponentConnected = ({ username }: { username: string }) => {
      setOpponentConnected(true);
      setOpponentUsername(username);
    };

    const handleOpponentDisconnected = () => {
      setOpponentConnected(false);
    };

    socket.on('game:move', handleMove);
    socket.on('game:ended', handleEnded);
    socket.on('opponent:connected', handleOpponentConnected);
    socket.on('opponent:disconnected', handleOpponentDisconnected);

    // Join game room once
    if (!joinedRef.current) {
      joinedRef.current = true;
      socket.emit('game:join', { gameId });
    }

    return () => {
      socket.off('game:move', handleMove);
      socket.off('game:ended', handleEnded);
      socket.off('opponent:connected', handleOpponentConnected);
      socket.off('opponent:disconnected', handleOpponentDisconnected);
    };
  }, [gameId, myColor, token, applyMove, setStatus, setRatingDelta]);

  const emitMove = (from: string, to: string, promotion?: string) => {
    if (!gameId) return;
    getSocket().emit('game:move', { gameId, from, to, promotion });
  };

  const emitResign = () => {
    if (!gameId) return;
    getSocket().emit('game:resign', { gameId });
  };

  return { opponentConnected, opponentUsername, emitMove, emitResign };
}
