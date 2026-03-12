import { useNavigate } from 'react-router-dom';
import { useActiveGameStore } from '@/store/activeGameStore';

export default function RejoinBanner() {
  const { gameId, color, clearActive } = useActiveGameStore();
  const navigate = useNavigate();

  if (!gameId) return null;

  return (
    <div className="bg-blue-900/80 border-b border-blue-700/60">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-blue-300 text-lg shrink-0">♟</span>
          <p className="text-blue-200 text-sm font-medium truncate">
            You have an active game in progress
            {color && <span className="text-blue-400 ml-1">({color})</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate(`/game/${gameId}`)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold
                       px-3 py-1.5 rounded transition-colors"
          >
            Rejoin Game
          </button>
          <button
            onClick={clearActive}
            className="text-blue-400 hover:text-blue-200 text-xs px-2 py-1.5 transition-colors"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
