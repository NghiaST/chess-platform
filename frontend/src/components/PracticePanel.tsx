interface PracticePanelProps {
  mode?: 'practice' | 'study';
  undoEnabled?: boolean;
  onUndo?: () => void;
}

export default function PracticePanel({ mode = 'practice', undoEnabled = false, onUndo }: PracticePanelProps) {
  const isStuidy = mode === 'study';
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            {isStuidy ? 'Study Mode' : 'Practice Mode'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {isStuidy 
              ? 'Play both sides to analyze positions and study variations.'
              : 'Practice against the bot. Hints and coach rules coming soon.'}
          </p>
        </div>
        <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-700/40 rounded px-2 py-0.5">
          BETA
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <button
          type="button"
          onClick={onUndo}
          disabled={!undoEnabled}
          className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStuidy ? 'Undo Move' : 'Undo Full Round'}
        </button>
        <p className="text-xs text-gray-500">
          {isStuidy 
            ? 'Undo 1 move to explore other variations.'
            : 'Undo your move + bot response to try a different approach.'}
        </p>
      </div>
    </div>
  );
}
