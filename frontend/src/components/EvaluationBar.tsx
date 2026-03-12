interface EvaluationBarProps {
  /** Centipawns from White's perspective (positive = white better, negative = black better). */
  score: number | null;
  /** Non-null when there is a forced mate: +N white mates in N, -N black mates in N. */
  mate: number | null;
  /** Controls which side appears at the bottom (matches board orientation). */
  orientation?: 'white' | 'black';
}

/** Convert a centipawn score to a 0–100 white-percentage for the bar. */
function toWhitePct(score: number, mate: number | null): number {
  if (mate !== null) return mate > 0 ? 97 : 3;
  // sigmoid-like: ±500 cp ≈ ±45 %, capped at [5, 95]
  return Math.min(95, Math.max(5, 50 + (score / 100) * 9));
}

function formatScore(score: number, mate: number | null): string {
  if (mate !== null) return `M${Math.abs(mate)}`;
  const abs = Math.abs(score) / 100;
  if (abs === 0) return '0.0';
  return abs.toFixed(1);
}

export default function EvaluationBar({
  score,
  mate,
  orientation = 'white',
}: EvaluationBarProps) {
  const whitePct = score !== null ? toWhitePct(score, mate) : 50;
  const blackPct = 100 - whitePct;

  // Label: show on the side that is ahead
  const whiteAhead = !!mate ? mate > 0 : (score ?? 0) >= 0;
  const label = score !== null ? formatScore(score, mate) : '';

  // Flip sections when board is flipped (black at bottom)
  const topPct = orientation === 'white' ? blackPct : whitePct;
  const bottomPct = orientation === 'white' ? whitePct : blackPct;
  const topColor = orientation === 'white' ? 'bg-gray-800' : 'bg-gray-100';
  const bottomColor = orientation === 'white' ? 'bg-gray-100' : 'bg-gray-800';

  return (
    <div
      className="flex flex-col w-5 rounded overflow-hidden self-stretch select-none shrink-0"
      title={score !== null ? (mate ? `Mate in ${Math.abs(mate!)}` : `${score > 0 ? '+' : ''}${(score / 100).toFixed(2)} pawns`) : 'Calculating…'}
    >
      {/* Top section */}
      <div
        className={`w-full ${topColor} transition-all duration-500 ease-out flex items-start justify-center pt-0.5`}
        style={{ height: `${topPct}%` }}
      >
        {/* Label on the top section when that side is ahead */}
        {label && ((orientation === 'white' && !whiteAhead) || (orientation === 'black' && whiteAhead)) && (
          <span className={`text-[9px] font-mono leading-none ${orientation === 'white' ? 'text-gray-300' : 'text-gray-800'}`}>
            {label}
          </span>
        )}
      </div>

      {/* Bottom section */}
      <div
        className={`w-full ${bottomColor} transition-all duration-500 ease-out flex items-end justify-center pb-0.5`}
        style={{ height: `${bottomPct}%` }}
      >
        {/* Label on the bottom section when that side is ahead */}
        {label && ((orientation === 'white' && whiteAhead) || (orientation === 'black' && !whiteAhead)) && (
          <span className={`text-[9px] font-mono leading-none ${orientation === 'white' ? 'text-gray-800' : 'text-gray-300'}`}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
