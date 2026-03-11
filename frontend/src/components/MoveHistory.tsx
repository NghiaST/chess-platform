interface Move {
  san: string;
  uci: string;
  color: string;
}

interface MoveHistoryProps {
  moves: Move[];
}

export default function MoveHistory({ moves }: MoveHistoryProps) {
  // Group moves in pairs: [white, black]
  const movePairs: { white?: Move; black?: Move; pair: number }[] = [];

  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      pair: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <div className="card p-4 h-full">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Move History
      </h3>
      <div className="overflow-y-auto max-h-80 space-y-0.5">
        {movePairs.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No moves yet</p>
        ) : (
          movePairs.map(({ pair, white, black }) => (
            <div key={pair} className="flex items-center gap-2 text-sm hover:bg-gray-800 rounded px-2 py-1">
              <span className="text-gray-600 w-6 shrink-0">{pair}.</span>
              <span className="text-white font-mono w-16">{white?.san ?? ''}</span>
              <span className="text-gray-300 font-mono w-16">{black?.san ?? ''}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
