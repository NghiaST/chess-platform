import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { gameService } from '@/services/game.service';
import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/authStore';

type GameMode = 'standard' | 'practice' | 'study';

const BOT_LEVELS = [
  { label: 'Beginner',     level: 1,  icon: '🤖', color: 'text-green-400',  colorBg: 'group-hover:border-green-700',  description: 'Perfect for learning'   },
  { label: 'Intermediate', level: 5,  icon: '♜',  color: 'text-yellow-400', colorBg: 'group-hover:border-yellow-700', description: 'A solid challenge'      },
  { label: 'Advanced',     level: 10, icon: '♚',  color: 'text-orange-400', colorBg: 'group-hover:border-orange-700', description: 'Strong amateur play'    },
  { label: 'Expert',       level: 15, icon: '🏆', color: 'text-red-400',    colorBg: 'group-hover:border-red-700',    description: 'Master-level strength'  },
];

function SectionHeading({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-2xl">{icon}</span>
      <h2 className="text-xl font-bold text-white">{title}</h2>
      {badge && (
        <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-900/60 text-blue-300 border border-blue-700/60 rounded px-2 py-0.5">
          {badge}
        </span>
      )}
      <div className="flex-1 border-t border-gray-800 ml-2" />
    </div>
  );
}

function LevelGrid({
  onSelect,
  isPending,
}: {
  onSelect: (level: number) => void;
  isPending: boolean;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {BOT_LEVELS.map(({ label, level, icon, color, colorBg, description }) => (
        <button
          key={level}
          onClick={() => onSelect(level)}
          disabled={isPending}
          className={`group card p-5 text-left border border-gray-700/80 hover:border-gray-600
                      ${colorBg} transition-all duration-150 hover:scale-[1.03]
                      disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <div className={`text-2xl mb-2 ${color}`}>{icon}</div>
          <p className="font-semibold text-white text-sm">{label}</p>
          <p className="text-gray-500 text-xs mt-0.5">{description}</p>
        </button>
      ))}
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { initGame } = useGameStore();

  const createGame = useMutation({
    mutationFn: ({ botLevel, mode }: { botLevel: number; mode: GameMode }) =>
      gameService.createGame({ isBotGame: true, botLevel, mode }),
    onSuccess: (game, { mode }) => {
      initGame(game.id, game.fen, true, game.botLevel ?? 5, null, mode);
      navigate(`/game/${game.id}`);
    },
  });

  const guard = (cb: () => void) => {
    if (!isAuthenticated) { navigate('/login'); return; }
    cb();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-14 space-y-14">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="text-center">
        <div className="text-6xl mb-5">♟</div>
        <h1 className="text-4xl font-bold text-white mb-3">Play Chess Online</h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          Train against the bot, study positions freely, or challenge real players.
        </p>
      </div>

      {/* ── Standard ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading icon="♟" title="Standard" />
        <p className="text-gray-400 text-sm mb-5">
          Rated games — your ELO updates after every match. Pick a difficulty and play.
        </p>
        <LevelGrid
          isPending={createGame.isPending}
          onSelect={(level) => guard(() => createGame.mutate({ botLevel: level, mode: 'standard' }))}
        />
      </section>

      {/* ── Practice ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading icon="🎯" title="Practice" badge="BETA" />
        <p className="text-gray-400 text-sm mb-5">
          No rating pressure. Undo moves after a mistake and ask for a hint when stuck.
        </p>
        <LevelGrid
          isPending={createGame.isPending}
          onSelect={(level) => guard(() => createGame.mutate({ botLevel: level, mode: 'practice' }))}
        />
      </section>

      {/* ── Study ────────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading icon="🔬" title="Study" />
        <div className="card border border-gray-700/80 p-6 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <h3 className="text-white font-semibold mb-1">Free exploration board</h3>
            <p className="text-gray-400 text-sm">
              Play both colours freely — no turn restriction, no bot response. Use undo to backtrack
              and explore alternative lines. Ideal for opening prep and endgame drills.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {['Move both sides', 'Unlimited undo', 'No ELO changes', 'Get Stockfish hints'].map((f) => (
                <li key={f} className="text-xs bg-gray-800 text-gray-300 rounded-full px-3 py-1 border border-gray-700">
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => guard(() => createGame.mutate({ botLevel: 5, mode: 'study' }))}
            disabled={createGame.isPending}
            className="btn-primary shrink-0 px-8 py-3 disabled:opacity-50"
          >
            {createGame.isPending ? 'Starting…' : 'Start Studying'}
          </button>
        </div>
      </section>

      {/* ── Play Online ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeading icon="🌐" title="Play Online" />
        <div className="card border border-gray-700/80 p-6 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <h3 className="text-white font-semibold mb-1">Challenge a real player</h3>
            <p className="text-gray-400 text-sm">
              Join the matchmaking lobby and get paired with an opponent around your rating.
              Real-time moves via WebSocket. ELO updates after every game.
            </p>
          </div>
          <button
            onClick={() => guard(() => navigate('/lobby'))}
            className="btn-primary shrink-0 px-8 py-3"
          >
            Find Opponent
          </button>
        </div>
      </section>

      {createGame.isError && (
        <p className="text-red-400 text-center text-sm">
          Failed to create game. Please try again.
        </p>
      )}
    </div>
  );
}
