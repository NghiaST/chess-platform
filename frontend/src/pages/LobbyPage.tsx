import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useLobbyStore } from '@/store/lobbyStore';
import { useGameStore } from '@/store/gameStore';
import { connectSocket, getSocket } from '@/services/socket.service';

export default function LobbyPage() {
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuthStore();
  const { initGame } = useGameStore();
  const { status, setSearching, setMatched, reset } = useLobbyStore();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);

    const handleWaiting = () => setSearching();

    const handleMatched = ({ gameId, color }: { gameId: string; color: 'white' | 'black' }) => {
      setMatched(gameId, color);
      const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      initGame(gameId, initialFen, false, 0, color);
      navigate(`/game/${gameId}`);
    };

    const handleError = ({ message }: { message: string }) => {
      console.error('Socket error:', message);
    };

    socket.on('queue:waiting', handleWaiting);
    socket.on('queue:matched', handleMatched);
    socket.on('error', handleError);

    socket.emit('queue:join');
    setSearching();

    return () => {
      // Tell server to remove us from queue (handles StrictMode double-invoke
      // and real navigation-away cleanups correctly)
      socket.emit('queue:leave');
      socket.off('queue:waiting', handleWaiting);
      socket.off('queue:matched', handleMatched);
      socket.off('error', handleError);
    };
  }, [token, setSearching, setMatched, initGame, navigate]);

  const handleCancel = () => {
    getSocket().emit('queue:leave');
    reset();
    navigate('/');
  };

  if (status === 'matched') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="text-5xl">✅</div>
        <p className="text-white text-2xl font-bold">Match found! Joining game...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      {/* Animated spinner */}
      <div className="relative flex items-center justify-center w-32 h-32">
        <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full" />
        <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-5xl">♟</span>
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Finding an Opponent</h1>
        <p className="text-gray-400">Waiting for another player to join...</p>
      </div>

      <button onClick={handleCancel} className="btn-secondary">
        Cancel
      </button>
    </div>
  );
}
