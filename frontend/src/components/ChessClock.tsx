import { useEffect, useRef, useState } from 'react';

interface ChessClockProps {
  /** Remaining time in milliseconds (server snapshot). */
  initialMs: number;
  /** Whether this side's clock is currently running. */
  isActive: boolean;
  /** Server timestamp (Date.now()) when the snapshot was taken — used to
   *  compensate for network latency on the initial render. */
  serverTs: number;
  color: 'white' | 'black';
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * ChessClock — displays a countdown timer for one side.
 * Receives a server snapshot and runs a local smooth countdown from there.
 */
export default function ChessClock({ initialMs, isActive, serverTs, color }: ChessClockProps) {
  // Adjust for network latency: subtract the time already elapsed since the
  // server emitted the snapshot.
  const latencyAdjusted = initialMs - Math.max(0, Date.now() - serverTs);
  const [displayMs, setDisplayMs] = useState(Math.max(0, latencyAdjusted));

  // Reset when a new server snapshot arrives (initialMs or isActive changes)
  const startRef = useRef<number>(Date.now());
  const baseRef = useRef<number>(Math.max(0, latencyAdjusted));

  useEffect(() => {
    const adjusted = initialMs - Math.max(0, Date.now() - serverTs);
    baseRef.current = Math.max(0, adjusted);
    startRef.current = Date.now();
    setDisplayMs(baseRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMs, isActive, serverTs]);

  // Local countdown while clock is active
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setDisplayMs(Math.max(0, baseRef.current - elapsed));
    }, 100);
    return () => clearInterval(interval);
  }, [isActive]);

  const isLow = displayMs < 30_000;
  const isVeryLow = displayMs < 10_000;

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 rounded-lg font-mono text-xl font-bold tabular-nums transition-colors ${
        isActive
          ? isVeryLow
            ? 'bg-red-700 text-white animate-pulse'
            : isLow
            ? 'bg-red-900/80 text-red-100'
            : 'bg-gray-700 text-white'
          : 'bg-gray-800 text-gray-400'
      }`}
    >
      <span className="text-sm font-sans font-normal capitalize text-inherit opacity-70">{color}</span>
      <span>{formatTime(displayMs)}</span>
    </div>
  );
}
