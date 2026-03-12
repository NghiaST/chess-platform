import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { useQuery } from '@tanstack/react-query';
import { useGameStore, type AnalysisArrow } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { gameService } from '@/services/game.service';

/** Arrow colours per analysis line rank (best → worst). */
const LINE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

function formatScore(score: number, mate: number | null): string {
  if (mate !== null) {
    return mate > 0 ? `+M${mate}` : `-M${Math.abs(mate)}`;
  }
  const pawns = score / 100;
  if (pawns === 0) return '0.00';
  return (pawns > 0 ? '+' : '') + pawns.toFixed(2);
}

/** Simple debounce hook — returns the value only after `delay` ms of no changes. */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function StudyPanel() {
  const {
    fen,
    fenStack,
    futureMoves,
    moves,
    localUndo,
    localRedo,
    loadStudyFen,
    setEvaluation,
    setAnalysisArrows,
    hintArrow,
    setHintArrow,
  } = useGameStore();

  const { analysisLines, setAnalysisLines } = useSettingsStore();

  const [fenInput, setFenInput] = useState('');
  const [fenError, setFenError] = useState<string | null>(null);
  const [pgn, setPgn] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canUndo = fenStack.length > 0;
  const canRedo = futureMoves.length > 0;

  // Debounce FEN so rapid moves don't fire analysis on every intermediate position
  const debouncedFen = useDebounce(fen, 350);

  const analysisQuery = useQuery({
    queryKey: ['analysis', debouncedFen, analysisLines],
    queryFn: () => gameService.analyze(debouncedFen, analysisLines, false),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Keep evaluation store + board arrows in sync with analysis results
  useEffect(() => {
    if (!analysisQuery.data) return;
    setEvaluation(analysisQuery.data.evaluation, analysisQuery.data.mate);

    const arrows: AnalysisArrow[] = analysisQuery.data.lines.map((line, i) => ({
      from: line.uci.slice(0, 2),
      to: line.uci.slice(2, 4),
      color: LINE_COLORS[i] ?? LINE_COLORS[LINE_COLORS.length - 1],
    }));
    setAnalysisArrows(arrows);
  }, [analysisQuery.data, setEvaluation, setAnalysisArrows]);

  const handleFenLoad = () => {
    const trimmed = fenInput.trim();
    if (!trimmed) return;
    try {
      new Chess(trimmed); // throws if invalid
      loadStudyFen(trimmed);
      setFenInput('');
      setFenError(null);
      if (hintArrow) setHintArrow(null);
    } catch {
      setFenError('Invalid FEN string');
    }
  };

  const handleFenKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFenLoad();
  };

  const handleExportPgn = () => {
    if (moves.length === 0) return;
    const tokens: string[] = [];
    moves.forEach((m, i) => {
      if (i % 2 === 0) tokens.push(`${Math.floor(i / 2) + 1}.`);
      tokens.push(m.san);
    });
    const text = tokens.join(' ');
    setPgn(text);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {/* clipboard denied — text still shown below */});
  };

  return (
    <div className="card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Study Mode
        </h3>
        <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-700/40 rounded px-2 py-0.5">
          FREE BOARD
        </span>
      </div>

      {/* FEN loader */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Load position from FEN</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={fenInput}
            onChange={(e) => { setFenInput(e.target.value); setFenError(null); }}
            onKeyDown={handleFenKeyDown}
            placeholder="Paste FEN…"
            className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded px-2 py-1.5
                       text-xs text-white placeholder:text-gray-600
                       focus:outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={handleFenLoad}
            disabled={!fenInput.trim()}
            className="btn-secondary text-xs py-1.5 px-3 shrink-0 disabled:opacity-40"
          >
            Load
          </button>
        </div>
        {fenError && <p className="text-[11px] text-red-400 mt-1">{fenError}</p>}
      </div>

      {/* Undo / Redo */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={localUndo}
          disabled={!canUndo}
          className="btn-secondary flex-1 text-xs py-1.5 disabled:opacity-40"
          title="Undo last move"
        >
          ← Undo
        </button>
        <button
          type="button"
          onClick={localRedo}
          disabled={!canRedo}
          className="btn-secondary flex-1 text-xs py-1.5 disabled:opacity-40"
          title="Redo next move"
        >
          Redo →
        </button>
      </div>

      {/* Export PGN */}
      <div>
        <button
          type="button"
          onClick={handleExportPgn}
          disabled={moves.length === 0}
          className="btn-secondary w-full text-xs py-1.5 disabled:opacity-40"
          title="Copy move list as PGN"
        >
          {copied ? '✓ Copied!' : 'Export PGN'}
        </button>
        {pgn && !copied && (
          <textarea
            readOnly
            value={pgn}
            rows={2}
            className="mt-1.5 w-full bg-gray-900 border border-gray-700 rounded px-2 py-1
                       text-xs text-gray-300 font-mono resize-none focus:outline-none"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        )}
      </div>

      {/* Analysis panel */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Engine Analysis
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Lines:</span>
            <div className="flex gap-0.5">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAnalysisLines(n)}
                  className={`w-5 h-5 text-[10px] rounded transition-colors ${
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
        </div>

        {/* Lines list */}
        <div className="space-y-1.5">
          {analysisQuery.isFetching && (
            <p className="text-xs text-gray-500 animate-pulse">Analysing…</p>
          )}
          {!analysisQuery.isFetching && analysisQuery.isError && (
            <p className="text-xs text-red-400">Analysis failed</p>
          )}
          {analysisQuery.data?.lines.map((line, i) => (
            <div
              key={i}
              className="flex items-center gap-2 py-1 px-2 rounded bg-gray-800/60 hover:bg-gray-800 transition-colors"
            >
              {/* Color indicator matching the board arrow */}
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: LINE_COLORS[i] }}
              />
              <span className="font-mono text-sm text-white flex-1">{line.san}</span>
              <span
                className={`text-xs font-mono shrink-0 ${
                  line.mate !== null
                    ? 'text-yellow-400'
                    : line.score > 50
                    ? 'text-green-400'
                    : line.score < -50
                    ? 'text-red-400'
                    : 'text-gray-400'
                }`}
              >
                {formatScore(line.score, line.mate)}
              </span>
            </div>
          ))}
          {!analysisQuery.isFetching && !analysisQuery.data?.lines.length && (
            <p className="text-xs text-gray-600 italic">No analysis yet</p>
          )}
        </div>
      </div>

      {/* Legend */}
      {(analysisQuery.data?.lines.length ?? 0) > 0 && (
        <p className="text-[10px] text-gray-600">
          Coloured arrows on the board show the top {analysisQuery.data!.lines.length} candidate move{analysisQuery.data!.lines.length > 1 ? 's' : ''}.
        </p>
      )}
    </div>
  );
}
