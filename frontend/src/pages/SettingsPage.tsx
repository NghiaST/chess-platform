import { useSettingsStore } from '@/store/settingsStore';

interface ToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ title, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>

      <input
        type="checkbox"
        role="switch"
        aria-label={title}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-blue-500"
      />
    </label>
  );
}

export default function SettingsPage() {
  const {
    showLegalMoves,
    premoveEnabled,
    analysisLines,
    setShowLegalMoves,
    setPremoveEnabled,
    setAnalysisLines,
    resetSettings,
  } = useSettingsStore();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Gameplay preferences for board interaction.</p>
      </header>

      <section className="card p-5 divide-y divide-gray-800">
        <ToggleRow
          title="Show legal moves"
          description="Highlight legal target squares when selecting a piece."
          checked={showLegalMoves}
          onChange={setShowLegalMoves}
        />

        <ToggleRow
          title="Enable premove"
          description="Queue your next move while waiting for opponent move."
          checked={premoveEnabled}
          onChange={setPremoveEnabled}
        />
      </section>

      {/* Study / Analysis settings */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Study Mode</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Engine analysis lines</p>
            <p className="text-xs text-gray-400">
              Number of best candidate moves shown in the Study panel (1–5).
            </p>
          </div>
          <div className="flex gap-1">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAnalysisLines(n)}
                className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                  analysisLines === n
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div>
        <button type="button" className="btn-secondary" onClick={resetSettings}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
