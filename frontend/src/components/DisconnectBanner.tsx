import { useEffect, useState } from 'react';

interface Props {
  deadline: number;        // Date.now() timestamp when grace period ends
  opponentName: string | null;
}

export default function DisconnectBanner({ deadline, opponentName }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      const s = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(s);
      if (s <= 0) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [deadline]);

  return (
    <div className="bg-yellow-900/80 border border-yellow-700/60 rounded-lg px-4 py-3 text-center">
      <p className="text-yellow-300 font-semibold text-sm">
        ⚠ {opponentName ?? 'Opponent'} disconnected
      </p>
      <p className="text-yellow-400/80 text-xs mt-1">
        {secondsLeft > 0
          ? `Waiting for them to return — ${secondsLeft}s remaining`
          : 'Grace period expired, waiting for result…'}
      </p>
    </div>
  );
}
