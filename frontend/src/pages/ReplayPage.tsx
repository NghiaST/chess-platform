import { useMemo, useState } from 'react';
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

  const goFirst = () => setCursor(0);
  const goPrev = () => setCursor((c) => Math.max(0, c - 1));
  const goNext = () => setCursor((c) => Math.min(maxCursor, c + 1));
  const goLast = () => setCursor(maxCursor);

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
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-xs px-3 py-1.5" onClick={goFirst} disabled={safeCursor === 0}>|&lt;</button>
            <button className="btn-secondary text-xs px-3 py-1.5" onClick={goPrev} disabled={safeCursor === 0}>&lt;</button>
            <button className="btn-secondary text-xs px-3 py-1.5" onClick={goNext} disabled={safeCursor === maxCursor}>&gt;</button>
            <button className="btn-secondary text-xs px-3 py-1.5" onClick={goLast} disabled={safeCursor === maxCursor}>&gt;|</button>
          </div>
        </div>
      </section>

      <aside className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Moves</h2>
          <span className="text-xs text-gray-500">{game.status}</span>
        </div>

        <div className="max-h-[520px] overflow-y-auto">
          {game.moves.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No moves recorded.</div>
          ) : (
            <ol className="divide-y divide-gray-800/50">
              {game.moves.map((m, idx) => {
                const moveIndex = idx + 1;
                const active = safeCursor === moveIndex;
                return (
                  <li key={`${m.moveNumber}-${m.uci}-${idx}`}>
                    <button
                      type="button"
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${active ? 'bg-blue-900/30 text-blue-300' : 'text-gray-300 hover:bg-gray-800/40'}`}
                      onClick={() => setCursor(moveIndex)}
                    >
                      <span className="font-mono text-xs text-gray-500 mr-2">{m.moveNumber}.</span>
                      <span>{m.san}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
