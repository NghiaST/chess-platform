import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Chess } from 'chess.js';
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
  const activeRef = useRef<HTMLButtonElement | null>(null);

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

  const goFirst = () => { setIsPlaying(false); setCursor(0); };
  const goPrev  = () => { setIsPlaying(false); setCursor((c) => Math.max(0, c - 1)); };
  const goNext  = () => setCursor((c) => Math.min(maxCursor, c + 1));
  const goLast  = () => { setIsPlaying(false); setCursor(maxCursor); };
  const togglePlay = () => setIsPlaying((p) => !p);

  // Autoplay: advance cursor every 700 ms while playing
  useEffect(() => {
    if (!isPlaying) return;
    if (safeCursor >= maxCursor) { setIsPlaying(false); return; }
    const timer = setTimeout(() => setCursor((c) => c + 1), 700);
    return () => clearTimeout(timer);
  }, [isPlaying, safeCursor, maxCursor]);

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
          <div className="text-xs text-gray-500 hidden sm:block">← → Space</div>
        </div>
      </section>

      <aside className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Moves</h2>
          <span className="text-xs text-gray-500">{game.status}</span>
        </div>

        <div className="max-h-[520px] overflow-y-auto">
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
      </aside>
    </div>
  );
}
