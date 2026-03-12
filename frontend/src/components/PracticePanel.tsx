import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { gameService } from '@/services/game.service';
import { useGameStore } from '@/store/gameStore';

interface PracticePanelProps {
  gameId: string;
  mode?: 'practice' | 'study';
  undoEnabled?: boolean;
  onUndo?: () => void;
}

export default function PracticePanel({ gameId, mode = 'practice', undoEnabled = false, onUndo }: PracticePanelProps) {
  const isStudy = mode === 'study';
  const { setHintArrow, status } = useGameStore();
  const [hintSan, setHintSan] = useState<string | null>(null);

  const hintMutation = useMutation({
    mutationFn: () => gameService.getHint(gameId),
    onSuccess: (data) => {
      setHintArrow({ from: data.from, to: data.to, san: data.san });
      setHintSan(data.san);
    },
  });

  const handleUndo = () => {
    setHintSan(null);
    setHintArrow(null);
    onUndo?.();
  };

  const handleHint = () => {
    setHintSan(null);
    setHintArrow(null);
    hintMutation.mutate();
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            {isStudy ? 'Study Mode' : 'Practice Mode'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {isStudy
              ? 'Play both sides to analyze positions and study variations.'
              : 'Practice against the bot. Use hints to improve your play.'}
          </p>
        </div>
        <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-700/40 rounded px-2 py-0.5">
          BETA
        </span>
      </div>

      <div className="space-y-2 text-sm">
        {/* Hint button — practice only */}
        {!isStudy && (
          <div>
            <button
              type="button"
              onClick={handleHint}
              disabled={hintMutation.isPending || status !== 'active'}
              className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hintMutation.isPending ? 'Thinking…' : 'Get Hint'}
            </button>
            {hintSan && (
              <p className="text-xs text-green-400 mt-1 text-center">
                Best move: <span className="font-mono font-bold">{hintSan}</span>
                <span className="text-gray-500 ml-1">(arrow shown on board)</span>
              </p>
            )}
            {hintMutation.isError && (
              <p className="text-xs text-red-400 mt-1 text-center">Failed to get hint</p>
            )}
          </div>
        )}

        {/* Undo button */}
        <button
          type="button"
          onClick={handleUndo}
          disabled={!undoEnabled}
          className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStudy ? 'Undo Move' : 'Undo Full Round'}
        </button>
        <p className="text-xs text-gray-500">
          {isStudy
            ? 'Undo 1 move to explore other variations.'
            : 'Undo your move + bot response to try a different approach.'}
        </p>
      </div>
    </div>
  );
}
