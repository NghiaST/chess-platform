interface PracticePanelProps {
  undoEnabled?: boolean;
  onUndo?: () => void;
}

export default function PracticePanel({ undoEnabled = false, onUndo }: PracticePanelProps) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Practice Mode
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Beta panel. Hint engine and coach rules will be added in the next steps.
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
          Undo Last Move (coming soon)
        </button>
        <p className="text-xs text-gray-500">
          Current step only adds mode-specific UI. Gameplay rules are unchanged.
        </p>
      </div>
    </div>
  );
}
