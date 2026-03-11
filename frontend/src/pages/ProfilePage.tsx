import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import api from '@/services/api';

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api.get(`/users/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

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

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="card p-8 text-center">
        {/* Avatar placeholder */}
        <div className="w-20 h-20 rounded-full bg-gray-700 border-2 border-gray-600 mx-auto flex items-center justify-center text-3xl mb-4">
          ♙
        </div>
        <h1 className="text-2xl font-bold text-white">{user.username}</h1>
        <p className="text-gray-400 text-sm mt-1">{user.email}</p>

        <div className="grid grid-cols-2 gap-6 mt-8">
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-blue-400">{user.rating}</p>
            <p className="text-gray-400 text-sm mt-1">ELO Rating</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-gray-300">
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
            <p className="text-gray-400 text-sm mt-1">Member since</p>
          </div>
        </div>

        {/* Game history — Phase 3 */}
        <div className="mt-8 card p-6 opacity-60">
          <h2 className="text-lg font-semibold text-gray-300 mb-2">Game History</h2>
          <p className="text-gray-500 text-sm">Coming in Phase 3</p>
        </div>
      </div>
    </div>
  );
}
