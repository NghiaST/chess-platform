import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

interface LeaderboardPlayer {
  id: string;
  username: string;
  rating: number;
  createdAt: string;
  _count: { gamesAsWhite: number; gamesAsBlack: number };
}

export default function LeaderboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/leaderboard?limit=20').then((r) => r.data.data),
  });

  const players: LeaderboardPlayer[] = data?.players ?? [];

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">Leaderboard</h1>
        <p className="text-gray-400">Top players ranked by ELO rating</p>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 animate-pulse py-16">Loading...</div>
      ) : players.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          No players yet. Be the first to register and play!
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs uppercase text-gray-500 tracking-wide py-3 px-4">Rank</th>
                <th className="text-left text-xs uppercase text-gray-500 tracking-wide py-3 px-4">Player</th>
                <th className="text-right text-xs uppercase text-gray-500 tracking-wide py-3 px-4">Rating</th>
                <th className="text-right text-xs uppercase text-gray-500 tracking-wide py-3 px-4">Games</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr
                  key={player.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="py-4 px-4 text-lg">{getRankBadge(index + 1)}</td>
                  <td className="py-4 px-4">
                    <span className="font-medium text-white">{player.username}</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="font-bold text-blue-400">{player.rating}</span>
                  </td>
                  <td className="py-4 px-4 text-right text-gray-400 text-sm">
                    {player._count.gamesAsWhite + player._count.gamesAsBlack}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
