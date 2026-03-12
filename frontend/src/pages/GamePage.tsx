import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import ChessBoard from '@/components/ChessBoard';
import MoveHistory from '@/components/MoveHistory';
import PracticePanel from '@/components/PracticePanel';
import StudyPanel from '@/components/StudyPanel';
import EvaluationBar from '@/components/EvaluationBar';
import ChessClock from '@/components/ChessClock';
import DisconnectBanner from '@/components/DisconnectBanner';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/authStore';
import { useLobbyStore } from '@/store/lobbyStore';
import { useMultiplayerGame } from '@/hooks/useMultiplayerGame';
import { gameService } from '@/services/game.service';

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user, updateRating } = useAuthStore();
  const { gameId, status, result, moves, isBotGame, botLevel, gameMode, myColor, ratingDelta, fen,
          evaluation, evalMate, initGame, setStatus, setRatingDelta, setEvaluation, resetGame } =
    useGameStore();
  const { myColor: lobbyColor, reset: resetLobby } = useLobbyStore();

  // Resolve the player's color: from lobby store (just matched) or from loaded game data
  const resolvedColor = myColor ?? lobbyColor;

  // Multiplayer socket hook — only active for non-bot games
  const { opponentConnected, opponentUsername, clockState, opponentDisconnectDeadline, emitMove, emitResign } = useMultiplayerGame(
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

  // Quick centipawn evaluation for EvaluationBar in standard/practice modes
  // (study mode gets its eval from StudyPanel's full analysis)
  // Gate: skip the starting position (moves.length === 0) to avoid a needless
  // Stockfish call before either player has moved.
  const { data: evalData } = useQuery({
    queryKey: ['eval', fen],
    queryFn: () => gameService.analyze(fen, 1, true),
    enabled: gameMode !== 'study' && status === 'active' && moves.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (gameMode !== 'study' && evalData) {
      setEvaluation(evalData.evaluation, evalData.mate);
    }
  }, [evalData, gameMode, setEvaluation]);

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
                : opponentDisconnectDeadline
                  ? `${opponentUsername ?? 'Opponent'} disconnected`
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

      {/* Disconnect banner — shown when opponent is mid-grace-period */}
      {!isBotGame && opponentDisconnectDeadline !== null && status === 'active' && (
        <div className="mb-4">
          <DisconnectBanner
            deadline={opponentDisconnectDeadline}
            opponentName={opponentUsername}
          />
        </div>
      )}

      {/* Game Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chess Board + Evaluation Bar */}
        <div className="lg:col-span-2">
          {id && (() => {
            // Which colour is physically at the top vs bottom of the board?
            const topColor:    'white' | 'black' = boardOrientation === 'white' ? 'black' : 'white';
            const bottomColor: 'white' | 'black' = boardOrientation;
            const showClocks = !isBotGame && !!clockState;
            const clockTs = clockState?.serverTs ?? Date.now();

            return (
              <div className="flex gap-2 items-stretch">
                <EvaluationBar score={evaluation} mate={evalMate} orientation={boardOrientation} />
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  {/* Opponent clock (top) */}
                  {showClocks && (
                    <ChessClock
                      color={topColor}
                      initialMs={topColor === 'white' ? clockState!.whiteMs : clockState!.blackMs}
                      isActive={clockState!.activeColor === (topColor === 'white' ? 'w' : 'b')}
                      serverTs={clockTs}
                    />
                  )}
                  <ChessBoard
                    gameId={id}
                    boardOrientation={boardOrientation}
                    onMakeMove={!isBotGame ? emitMove : undefined}
                    allowedColor={!isBotGame ? allowedColor : undefined}
                  />
                  {/* My clock (bottom) */}
                  {showClocks && (
                    <ChessClock
                      color={bottomColor}
                      initialMs={bottomColor === 'white' ? clockState!.whiteMs : clockState!.blackMs}
                      isActive={clockState!.activeColor === (bottomColor === 'white' ? 'w' : 'b')}
                      serverTs={clockTs}
                    />
                  )}
                </div>
              </div>
            );
          })()}
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

          {gameMode === 'study' && <StudyPanel />}

          {gameMode === 'practice' && (
            <PracticePanel
              gameId={id!}
              mode="practice"
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
