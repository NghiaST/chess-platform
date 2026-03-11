import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import ChessBoard from '@/components/ChessBoard';
import MoveHistory from '@/components/MoveHistory';
import PracticePanel from '@/components/PracticePanel';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/authStore';
import { useLobbyStore } from '@/store/lobbyStore';
import { useMultiplayerGame } from '@/hooks/useMultiplayerGame';
import { gameService } from '@/services/game.service';

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user, updateRating } = useAuthStore();
  const { gameId, status, result, moves, isBotGame, botLevel, gameMode, myColor, ratingDelta, initGame, setStatus, setRatingDelta, resetGame } =
    useGameStore();
  const { myColor: lobbyColor, reset: resetLobby } = useLobbyStore();

  // Resolve the player's color: from lobby store (just matched) or from loaded game data
  const resolvedColor = myColor ?? lobbyColor;

  // Multiplayer socket hook — only active for non-bot games
  const { opponentConnected, opponentUsername, emitMove, emitResign } = useMultiplayerGame(
    !isBotGame && gameId ? gameId : null,
    resolvedColor,
  );

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  // Load game data
  const { data: game, isLoading, isError, refetch: refetchGame } = useQuery({
    queryKey: ['game', id],
    queryFn: () => gameService.getGame(id!),
    enabled: !!id && isAuthenticated,
  });

  // Initialize game store from API data (only when not already initialised via lobby)
  useEffect(() => {
    if (game && gameId !== game.id) {
      // Determine color from game data (for direct URL visits / reconnects)
      let color: 'white' | 'black' | null = null;
      if (!game.isBotGame && user) {
        color = game.whitePlayerId === user.id ? 'white' : 'black';
      }
      const apiMode = (game as { mode?: 'standard' | 'practice' | 'study' }).mode;
      initGame(game.id, game.fen, game.isBotGame, game.botLevel ?? 5, color, apiMode ?? gameMode);
      
      // Load moves from API response into Zustand store
      if (game.moves && game.moves.length > 0) {
        const reconstructedMoves = [...game.moves]
          .sort((a: any, b: any) => (a.moveNumber ?? Number.MAX_SAFE_INTEGER) - (b.moveNumber ?? Number.MAX_SAFE_INTEGER))
          .map((move: any) => ({
          san: move.san,
          uci: move.uci,
          color: move.color,
          moveNumber: move.moveNumber,
        }));
        const { revertToFen } = useGameStore.getState();
        revertToFen(game.fen, reconstructedMoves);
      }
      
      if (game.status !== 'ACTIVE') {
        setStatus('finished', game.result ?? undefined);
      }
    }
    // After first init from lobby, clear the lobby state
    if (game && lobbyColor) resetLobby();
  }, [game, gameId, user, lobbyColor, initGame, setStatus, resetLobby, gameMode]);

  // Bot resign via REST; multiplayer resign via socket
  const resignMutation = useMutation({
    mutationFn: () => gameService.resign(id!),
    onSuccess: (data) => {
      setStatus('finished');
      if (data?.ratingDelta != null) {
        setRatingDelta(data.ratingDelta);
        updateRating((user?.rating ?? 0) + data.ratingDelta);
      }
    },
  });

  // Undo move (practice/study mode only)
  const undoMutation = useMutation({
    mutationFn: () => gameService.undoMove(id!),
    onSuccess: (data: any) => {
      // Reconstruct moves array from API response
      const moves = [...(data.moves || [])]
        .sort((a: any, b: any) => (a.moveNumber ?? Number.MAX_SAFE_INTEGER) - (b.moveNumber ?? Number.MAX_SAFE_INTEGER))
        .map((move: any) => ({
          san: move.san,
          uci: move.uci,
          color: move.color,
          moveNumber: move.moveNumber,
        }));
      
      // Use revertToFen to restore game state with moves
      const { revertToFen } = useGameStore.getState();
      revertToFen(data.fen, moves);
      
      // Refetch the game to ensure MoveHistory component gets updated moves
      refetchGame();
    },
  });

  const handleResign = () => {
    if (!window.confirm('Are you sure you want to resign?')) return;
    if (isBotGame) {
      resignMutation.mutate();
    } else {
      emitResign();
    }
  };

  const handleNewGame = () => {
    resetGame();
    navigate('/');
  };

  const handleUndo = () => {
    undoMutation.mutate();
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

  const boardOrientation = resolvedColor ?? 'white';
  const allowedColor = resolvedColor === 'black' ? 'b' : 'w';

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
          {gameMode !== 'standard' && (
            <p className="text-xs mt-1 text-blue-300">
              Mode: {gameMode === 'practice' ? 'Practice (beta)' : 'Study (beta)'}
            </p>
          )}
          {!isBotGame && status === 'active' && (
            <p className={`text-xs mt-1 ${opponentConnected ? 'text-green-400' : 'text-yellow-400 animate-pulse'}`}>
              {opponentConnected
                ? `${opponentUsername ?? 'Opponent'} is connected`
                : 'Waiting for opponent to connect...'}
            </p>
          )}
          {status === 'finished' && ratingDelta !== null && (
            <p className={`text-sm font-bold mt-1 ${ratingDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              Rating: {ratingDelta >= 0 ? '+' : ''}{ratingDelta}
            </p>
          )}
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
          {id && (
            <ChessBoard
              gameId={id}
              boardOrientation={boardOrientation}
              onMakeMove={!isBotGame ? emitMove : undefined}
              allowedColor={!isBotGame ? allowedColor : undefined}
            />
          )}
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
                <span className="text-gray-400 text-sm">{game.whitePlayer?.rating ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-900 border border-gray-500" />
                  <span className="text-white font-medium">
                    {isBotGame
                      ? `Bot (Lv.${botLevel})`
                      : game.blackPlayer?.username ?? opponentUsername ?? 'Opponent'}
                  </span>
                </div>
                <span className="text-gray-400 text-sm">
                  {isBotGame ? '—' : game.blackPlayer?.rating ?? '-'}
                </span>
              </div>
            </div>
          </div>

          {(gameMode === 'practice' || gameMode === 'study') && (
            <PracticePanel
              mode={gameMode as 'practice' | 'study'}
              undoEnabled={status === 'active' && moves.length > 0}
              onUndo={handleUndo}
            />
          )}

          {/* Move History */}
          <MoveHistory moves={moves} />
        </div>
      </div>
    </div>
  );
}
