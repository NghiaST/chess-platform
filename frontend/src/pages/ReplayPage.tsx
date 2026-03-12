import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { gameService } from '@/services/game.service';

interface MoveItem {
  id?: string;
  moveNumber: number;
  san: string;
  uci: string;
  color: string;
}

interface ReplayGame {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string | null;
  status: string;
  result: string | null;
  createdAt: string;
  moves: MoveItem[];
  whitePlayer?: { username: string };
  blackPlayer?: { username: string } | null;
}

function toMoveInput(uci: string) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;
  return { from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined };
}

export default function ReplayPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Sidebar tab: 'moves' | 'analysis'
  const [sidebarTab, setSidebarTab] = useState<'moves' | 'analysis'>('moves');

  // Export feedback
  const [pgnCopied, setPgnCopied] = useState(false);
  const [fenCopied, setFenCopied] = useState(false);

  const { data: game, isLoading, isError } = useQuery({
    queryKey: ['replay-game', id],
    queryFn: () => gameService.getGame(id!) as Promise<ReplayGame>,
    enabled: !!id,
  });

  const positions = useMemo(() => {
    if (!game) return ['start'];

    const chess = new Chess();
    const out = [chess.fen()];

    for (const m of game.moves) {
      try {
        const move = chess.move(toMoveInput(m.uci));
        if (move) {
          out.push(chess.fen());
        } else {
          out.push(out[out.length - 1]);
        }
      } catch {
        out.push(out[out.length - 1]);
      }
    }

    return out;
  }, [game]);

  const maxCursor = Math.max(0, positions.length - 1);
  const safeCursor = Math.min(cursor, maxCursor);
  const currentFen = positions[safeCursor] === 'start' ? new Chess().fen() : positions[safeCursor];

  // Analysis for the current position (only when analysis tab is open)
  const analysisQuery = useQuery({
    queryKey: ['replay-analysis', currentFen],
    queryFn: () => gameService.analyze(currentFen, 3, false),
    enabled: sidebarTab === 'analysis',
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const LINE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b'] as const;

  function formatScore(score: number, mate: number | null): string {
    if (mate !== null) return mate > 0 ? `+M${mate}` : `-M${Math.abs(mate)}`;
    const pawns = score / 100;
    if (pawns === 0) return '0.00';
    return (pawns > 0 ? '+' : '') + pawns.toFixed(2);
  }

  // Arrows to render on board: analysis suggestions when analysis tab is open
  const analysisArrows = useMemo(() => {
    if (sidebarTab !== 'analysis' || !analysisQuery.data) return [];
    return analysisQuery.data.lines.map((line, i) => [
      line.uci.slice(0, 2) as Square,
      line.uci.slice(2, 4) as Square,
      LINE_COLORS[i] ?? LINE_COLORS[LINE_COLORS.length - 1],
    ] as [Square, Square, string]);
  }, [sidebarTab, analysisQuery.data]);

  // Export helpers
  function buildPgn(): string {
    if (!game) return '';
    const tokens: string[] = [];
    game.moves.forEach((m, i) => {
      if (i % 2 === 0) tokens.push(`${Math.floor(i / 2) + 1}.`);
      tokens.push(m.san);
    });
    return tokens.join(' ');
  }

  const handleCopyPgn = () => {
    const text = buildPgn();
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
    setPgnCopied(true);
    setTimeout(() => setPgnCopied(false), 2000);
  };

  const handleCopyFen = () => {
    navigator.clipboard.writeText(currentFen).catch(() => {});
    setFenCopied(true);
    setTimeout(() => setFenCopied(false), 2000);
  };

  const goFirst = () => { setIsPlaying(false); setCursor(0); };
  const goPrev  = () => { setIsPlaying(false); setCursor((c) => Math.max(0, c - 1)); };
  const goNext  = () => setCursor((c) => Math.min(maxCursor, c + 1));
  const goLast  = () => { setIsPlaying(false); setCursor(maxCursor); };
  const togglePlay = () => setIsPlaying((p) => !p);

  // Autoplay: advance cursor every (700 / speed) ms while playing
  useEffect(() => {
    if (!isPlaying) return;
    if (safeCursor >= maxCursor) { setIsPlaying(false); return; }
    const timer = setTimeout(() => setCursor((c) => c + 1), Math.round(700 / speed));
    return () => clearTimeout(timer);
  }, [isPlaying, safeCursor, maxCursor, speed]);

  // Keyboard navigation: ← / → / Space
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  { setCursor((c) => Math.max(0, c - 1)); setIsPlaying(false); }
      else if (e.key === 'ArrowRight') setCursor((c) => Math.min(maxCursor, c + 1));
      else if (e.key === ' ')     { e.preventDefault(); setIsPlaying((p) => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [maxCursor]);

  // Auto-scroll the active move into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [safeCursor]);

  // Group moves into pairs: [{ moveNumber, white, black? }]
  const movePairs = useMemo(() => {
    if (!game) return [];
    type HalfMove = { san: string; idx: number };
    const pairs: { moveNumber: number; white: HalfMove; black?: HalfMove }[] = [];
    for (let i = 0; i < game.moves.length; i += 2) {
      const w = game.moves[i];
      const b = game.moves[i + 1];
      pairs.push({
        moveNumber: w.moveNumber,
        white: { san: w.san, idx: i + 1 },
        black: b ? { san: b.san, idx: i + 2 } : undefined,
      });
    }
    return pairs;
  }, [game]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 animate-pulse">
        Loading replay...
      </div>
    );
  }

  if (isError || !game) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 mb-4">Unable to load this game replay.</p>
        <button className="btn-secondary" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2 card p-4 sm:p-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-white">Game Replay</h1>
          <p className="text-sm text-gray-400 mt-1">
            {game.whitePlayer?.username ?? 'White'} vs {game.blackPlayer?.username ?? 'Black'}
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Chessboard
            id="replay-board"
            position={currentFen}
            arePiecesDraggable={false}
            boardWidth={Math.min(640, window.innerWidth - 40)}
            customArrows={analysisArrows}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs text-gray-400">
            Move {safeCursor}/{game.moves.length}
          </div>
          <div className="flex items-center gap-1">
            <button className="btn-secondary text-base px-3 py-1.5" onClick={goFirst}   disabled={safeCursor === 0}        title="First"    >⏮</button>
            <button className="btn-secondary text-base px-3 py-1.5" onClick={goPrev}    disabled={safeCursor === 0}        title="Previous" >◁</button>
            <button className="btn-secondary text-base px-3 py-1.5" onClick={togglePlay} disabled={safeCursor === maxCursor && !isPlaying} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button className="btn-secondary text-base px-3 py-1.5" onClick={goNext}    disabled={safeCursor === maxCursor} title="Next"     >▷</button>
            <button className="btn-secondary text-base px-3 py-1.5" onClick={goLast}    disabled={safeCursor === maxCursor} title="Last"     >⏭</button>
          </div>
          <div className="flex items-center gap-1">
            {([0.5, 1, 2] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  speed === s
                    ? 'bg-blue-600 text-white'
                    : 'btn-secondary'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-500 hidden sm:block">← → Space</div>
        </div>
      </section>

      <aside className="card overflow-hidden flex flex-col">
        {/* Tab header */}
        <div className="flex border-b border-gray-800">
          <button
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              sidebarTab === 'moves'
                ? 'text-blue-300 border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setSidebarTab('moves')}
          >
            Moves
          </button>
          <button
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              sidebarTab === 'analysis'
                ? 'text-blue-300 border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setSidebarTab('analysis')}
          >
            Analysis
          </button>
        </div>

        {/* Moves tab */}
        {sidebarTab === 'moves' && (
          <div className="flex-1 overflow-y-auto max-h-[480px]">
            {movePairs.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No moves recorded.</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {movePairs.map(({ moveNumber, white, black }) => (
                    <tr key={moveNumber} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      <td className="pl-4 pr-1 py-1.5 text-xs text-gray-500 font-mono w-8 select-none">
                        {moveNumber}.
                      </td>
                      <td className="pr-1 py-1 w-1/2">
                        <button
                          ref={safeCursor === white.idx ? activeRef : undefined}
                          type="button"
                          className={`w-full text-left px-2 py-1 rounded transition-colors ${
                            safeCursor === white.idx
                              ? 'bg-blue-900/40 text-blue-300 font-semibold'
                              : 'text-gray-300 hover:bg-gray-700/40'
                          }`}
                          onClick={() => setCursor(white.idx)}
                        >
                          {white.san}
                        </button>
                      </td>
                      <td className="pr-2 py-1 w-1/2">
                        {black && (
                          <button
                            ref={safeCursor === black.idx ? activeRef : undefined}
                            type="button"
                            className={`w-full text-left px-2 py-1 rounded transition-colors ${
                              safeCursor === black.idx
                                ? 'bg-blue-900/40 text-blue-300 font-semibold'
                                : 'text-gray-300 hover:bg-gray-700/40'
                            }`}
                            onClick={() => setCursor(black.idx)}
                          >
                            {black.san}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Analysis tab */}
        {sidebarTab === 'analysis' && (
          <div className="flex-1 overflow-y-auto max-h-[480px] p-3 space-y-3">
            {analysisQuery.isFetching && (
              <div className="py-8 text-center text-gray-400 text-sm animate-pulse">Analyzing position…</div>
            )}
            {!analysisQuery.isFetching && analysisQuery.isError && (
              <div className="text-center space-y-2 py-6">
                <p className="text-red-400 text-sm">Analysis failed</p>
                <button
                  className="btn-secondary text-xs"
                  onClick={() => analysisQuery.refetch()}
                >
                  Retry
                </button>
              </div>
            )}
            {!analysisQuery.isFetching && analysisQuery.data && (() => {
              const { evaluation, mate, lines } = analysisQuery.data;
              const score = formatScore(evaluation, mate);
              const positive = mate !== null ? mate > 0 : evaluation >= 0;
              return (
                <>
                  {/* Eval score */}
                  <div className="text-center py-2">
                    <span className={`text-3xl font-bold ${
                      positive ? 'text-white' : 'text-gray-400'
                    }`}>
                      {score}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {mate !== null ? 'Forced mate' : 'centipawns'}
                    </p>
                  </div>

                  {/* Best moves */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Best moves</p>
                    {lines.map((line, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-800/40">
                        <span
                          className="w-2 h-4 rounded-sm shrink-0"
                          style={{ backgroundColor: LINE_COLORS[i] ?? LINE_COLORS[LINE_COLORS.length - 1] }}
                        />
                        <span className="text-gray-200 font-medium text-sm">{line.san}</span>
                        <span className="ml-auto text-gray-400 text-xs font-mono">
                          {formatScore(line.score, line.mate)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 text-center mt-2">Arrows visible on board</p>
                </>
              );
            })()}
          </div>
        )}

        {/* Export section — always visible */}
        <div className="border-t border-gray-800 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Export</p>
          <div className="flex gap-2">
            <button
              onClick={handleCopyPgn}
              disabled={!game || game.moves.length === 0}
              className="btn-secondary text-xs flex-1 disabled:opacity-40"
            >
              {pgnCopied ? '✓ Copied!' : 'Copy PGN'}
            </button>
            <button
              onClick={handleCopyFen}
              className="btn-secondary text-xs flex-1"
            >
              {fenCopied ? '✓ Copied!' : 'Copy FEN'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
