import { useSettingsStore, type BoardTheme, type BackgroundTheme } from '@/store/settingsStore';

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

const BOARD_THEMES: { value: BoardTheme; label: string; dark: string; light: string }[] = [
  { value: 'classic', label: 'Classic',  dark: '#B58863', light: '#F0D9B5' },
  { value: 'green',   label: 'Green',    dark: '#769656', light: '#EEEED2' },
  { value: 'blue',    label: 'Blue',     dark: '#4B7399', light: '#DEE3E6' },
];

const BG_THEMES: { value: BackgroundTheme; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'linen',   label: 'Linen' },
  { value: 'slate',   label: 'Slate' },
];

const ANNOTATION_PRESETS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#a855f7'];

export default function SettingsPage() {
  const {
    showLegalMoves,
    premoveEnabled,
    analysisLines,
    boardTheme,
    backgroundTheme,
    annotationColor,
    setShowLegalMoves,
    setPremoveEnabled,
    setAnalysisLines,
    setBoardTheme,
    setBackgroundTheme,
    setAnnotationColor,
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

      {/* Board theme */}
      <section className="card p-5 space-y-5">
        <h2 className="text-sm font-semibold text-white">Board &amp; Appearance</h2>

        {/* Board colour scheme */}
        <div>
          <p className="text-sm font-semibold text-white mb-1">Board theme</p>
          <p className="text-xs text-gray-400 mb-3">Colour scheme for the chess board squares.</p>
          <div className="flex gap-3">
            {BOARD_THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setBoardTheme(t.value)}
                title={t.label}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors ${
                  boardTheme === t.value ? 'border-blue-500' : 'border-transparent hover:border-gray-600'
                }`}
              >
                {/* 2×2 swatch */}
                <div className="grid grid-cols-2 w-10 h-10 rounded overflow-hidden">
                  <div style={{ background: t.light }} />
                  <div style={{ background: t.dark }} />
                  <div style={{ background: t.dark }} />
                  <div style={{ background: t.light }} />
                </div>
                <span className="text-xs text-gray-400">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Background theme */}
        <div>
          <p className="text-sm font-semibold text-white mb-1">Background theme</p>
          <p className="text-xs text-gray-400 mb-3">Page background colour behind the board.</p>
          <div className="flex gap-2">
            {BG_THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setBackgroundTheme(t.value)}
                className={`px-4 py-2 rounded text-sm transition-colors ${
                  backgroundTheme === t.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Annotation colour */}
        <div>
          <p className="text-sm font-semibold text-white mb-1">Annotation colour</p>
          <p className="text-xs text-gray-400 mb-3">Colour used for right-click circles and arrows.</p>
          <div className="flex items-center gap-3">
            {ANNOTATION_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAnnotationColor(c)}
                title={c}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  annotationColor === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ background: c }}
              />
            ))}
            {/* Custom colour picker */}
            <label className="cursor-pointer" title="Custom colour">
              <span className="text-xs text-gray-400 mr-1">Custom:</span>
              <input
                type="color"
                value={annotationColor}
                onChange={(e) => setAnnotationColor(e.target.value)}
                className="w-8 h-8 cursor-pointer rounded border-0 bg-transparent"
              />
            </label>
          </div>
        </div>
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
