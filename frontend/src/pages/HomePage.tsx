import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { gameService } from '@/services/game.service';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/authStore';

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { initGame } = useGameStore();

  const createGameMutation = useMutation({
    mutationFn: (botLevel: number) =>
      gameService.createGame({ isBotGame: true, botLevel }),
    onSuccess: (game) => {
      initGame(game.id, game.fen, true, game.botLevel ?? 5);
      navigate(`/game/${game.id}`);
    },
  });

  const handlePlayBot = (level: number) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    createGameMutation.mutate(level);
  };

  const BOT_LEVELS = [
    { label: 'Beginner', level: 1, description: 'Level 1 — Perfect for learning', color: 'text-green-400' },
    { label: 'Intermediate', level: 5, description: 'Level 5 — A good challenge', color: 'text-yellow-400' },
    { label: 'Advanced', level: 10, description: 'Level 10 — Play like a strong amateur', color: 'text-orange-400' },
    { label: 'Expert', level: 15, description: 'Level 15 — Master-level play', color: 'text-red-400' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="text-7xl mb-6">♟</div>
        <h1 className="text-5xl font-bold text-white mb-4">
          Play Chess Online
        </h1>
        <p className="text-gray-400 text-xl max-w-2xl mx-auto">
          Sharpen your skills against our bot or challenge real players (coming soon).
          Track your rating, climb the leaderboard, and replay your games.
        </p>
      </div>

      {/* Play vs Bot section */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-white text-center mb-8">
          Play vs Bot
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BOT_LEVELS.map(({ label, level, description, color }) => (
            <button
              key={level}
              onClick={() => handlePlayBot(level)}
              disabled={createGameMutation.isPending}
              className="card p-6 text-left hover:border-gray-600 transition-all duration-200
                         hover:scale-105 cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className={`text-3xl mb-3 ${color}`}>
                {level <= 3 ? '🤖' : level <= 7 ? '♜' : level <= 12 ? '♚' : '🏆'}
              </div>
              <h3 className="font-bold text-white text-lg mb-1">{label}</h3>
              <p className="text-gray-400 text-sm">{description}</p>
            </button>
          ))}
        </div>
        {createGameMutation.isError && (
          <p className="text-red-400 text-center mt-4 text-sm">
            Failed to create game. Please try again.
          </p>
        )}
      </div>

      {/* Play Online */}
      <div className="card p-8 text-center">
        <div className="text-4xl mb-4">🌐</div>
        <h2 className="text-2xl font-bold text-white mb-2">Play Online</h2>
        <p className="text-gray-400 mb-4">
          Challenge a real player in real-time. Ratings update after every game.
        </p>
        <button
          onClick={() => {
            if (!isAuthenticated) { navigate('/login'); return; }
            navigate('/lobby');
          }}
          className="btn-primary mt-2"
        >
          Find Opponent
        </button>
      </div>
    </div>
  );
}
