import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import api from '@/services/api';

interface GameHistoryItem {
  id: string;
  date: string;
  opponent: string;
  color: 'white' | 'black';
  result: 'win' | 'loss' | 'draw' | null;
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingDelta: number | null;
  moveCount: number;
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api.get(`/users/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['userGames', id],
    queryFn: () => api.get(`/users/${id}/games?limit=15`).then((r) => r.data.data),
    enabled: !!id,
  });

  const games: GameHistoryItem[] = historyData?.games ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 animate-pulse">
        Loading profile...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center text-red-400 py-16">User not found.</div>
    );
  }

  const { stats } = user;
  const winRate = stats?.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;

  const resultLabel = (result: GameHistoryItem['result']) => {
    if (result === 'win') return <span className="text-green-400 font-semibold">Win</span>;
    if (result === 'loss') return <span className="text-red-400 font-semibold">Loss</span>;
    if (result === 'draw') return <span className="text-yellow-400 font-semibold">Draw</span>;
    return <span className="text-gray-500">—</span>;
  };

  const deltaLabel = (delta: number | null) => {
    if (delta === null) return <span className="text-gray-500">—</span>;
    if (delta >= 0) return <span className="text-green-400">+{delta}</span>;
    return <span className="text-red-400">{delta}</span>;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
      {/* Profile card */}
      <div className="card p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gray-700 border-2 border-gray-600 mx-auto flex items-center justify-center text-3xl mb-4">
          ♙
        </div>
        <h1 className="text-2xl font-bold text-white">{user.username}</h1>
        <p className="text-gray-400 text-sm mt-1">{user.email}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="card p-4 text-center sm:col-span-1">
          <p className="text-3xl font-bold text-blue-400">{user.rating}</p>
          <p className="text-gray-400 text-xs mt-1">ELO Rating</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{stats?.wins ?? 0}</p>
          <p className="text-gray-400 text-xs mt-1">Wins</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{stats?.losses ?? 0}</p>
          <p className="text-gray-400 text-xs mt-1">Losses</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{stats?.draws ?? 0}</p>
          <p className="text-gray-400 text-xs mt-1">Draws</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-300">{winRate}%</p>
          <p className="text-gray-400 text-xs mt-1">Win Rate</p>
        </div>
      </div>

      {/* Game history */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Game History</h2>
        </div>

        {isHistoryLoading ? (
          <div className="text-center text-gray-400 animate-pulse py-8">Loading history...</div>
        ) : games.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No finished games yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs uppercase text-gray-500 tracking-wide py-2 px-4">Date</th>
                  <th className="text-left text-xs uppercase text-gray-500 tracking-wide py-2 px-4">Opponent</th>
                  <th className="text-center text-xs uppercase text-gray-500 tracking-wide py-2 px-4">Color</th>
                  <th className="text-center text-xs uppercase text-gray-500 tracking-wide py-2 px-4">Result</th>
                  <th className="text-right text-xs uppercase text-gray-500 tracking-wide py-2 px-4">Rating</th>
                  <th className="text-right text-xs uppercase text-gray-500 tracking-wide py-2 px-4">Moves</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-4 text-gray-400">
                      {new Date(g.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-white">{g.opponent}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block w-4 h-4 rounded-full border ${
                        g.color === 'white' ? 'bg-white border-gray-400' : 'bg-gray-900 border-gray-500'
                      }`} />
                    </td>
                    <td className="py-3 px-4 text-center">{resultLabel(g.result)}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      {g.ratingAfter !== null ? (
                        <span className="text-gray-300">
                          {g.ratingAfter} <span className="text-xs">({deltaLabel(g.ratingDelta)})</span>
                        </span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-400">{g.moveCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
