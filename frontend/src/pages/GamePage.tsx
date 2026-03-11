import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import ChessBoard from '@/components/ChessBoard';
import MoveHistory from '@/components/MoveHistory';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/authStore';
import { gameService } from '@/services/game.service';

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { gameId, status, result, moves, isBotGame, botLevel, initGame, setStatus, resetGame } =
    useGameStore();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  // Load game data
  const { data: game, isLoading, isError } = useQuery({
    queryKey: ['game', id],
    queryFn: () => gameService.getGame(id!),
    enabled: !!id && isAuthenticated,
  });

  // Initialize game store from API data
  useEffect(() => {
    if (game && gameId !== game.id) {
      initGame(game.id, game.fen, game.isBotGame, game.botLevel ?? 5);
      if (game.status !== 'ACTIVE') {
        setStatus('finished', game.result ?? undefined);
      }
    }
  }, [game, gameId, initGame, setStatus]);

  const resignMutation = useMutation({
    mutationFn: () => gameService.resign(id!),
    onSuccess: () => {
      setStatus('finished');
    },
  });

  const handleResign = () => {
    if (window.confirm('Are you sure you want to resign?')) {
      resignMutation.mutate();
    }
  };

  const handleNewGame = () => {
    resetGame();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg animate-pulse">Loading game...</div>
      </div>
    );
  }

  if (isError || !game) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-400">Game not found or failed to load.</p>
        <button onClick={() => navigate('/')} className="btn-primary">
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isBotGame ? `vs Bot (Level ${botLevel})` : 'Online Game'}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {status === 'active' ? 'Game in progress' : `Game over — ${result ?? 'Unknown result'}`}
          </p>
        </div>
        <div className="flex gap-3">
          {status === 'active' && (
            <button
              onClick={handleResign}
              disabled={resignMutation.isPending}
              className="btn-danger"
            >
              Resign
            </button>
          )}
          <button onClick={handleNewGame} className="btn-secondary">
            New Game
          </button>
        </div>
      </div>

      {/* Game Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chess Board */}
        <div className="lg:col-span-2">
          {id && <ChessBoard gameId={id} />}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Players */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Players
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-white border border-gray-600" />
                  <span className="text-white font-medium">
                    {game.whitePlayer?.username ?? 'Unknown'}
                  </span>
                </div>
                <span className="text-gray-400 text-sm">
                  {game.whitePlayer?.rating ?? '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-900 border border-gray-500" />
                  <span className="text-white font-medium">
                    {isBotGame ? `Bot (Lv.${botLevel})` : game.blackPlayer?.username ?? 'Opponent'}
                  </span>
                </div>
                <span className="text-gray-400 text-sm">
                  {isBotGame ? '—' : game.blackPlayer?.rating ?? '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Move History */}
          <MoveHistory moves={moves} />

          {/* PGN Export — Phase 3 */}
          <div className="card p-4 opacity-50">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
              PGN Export
            </h3>
            <p className="text-gray-500 text-xs">Available after game ends (Phase 3)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
