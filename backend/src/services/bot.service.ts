import { spawn } from 'child_process';
import path from 'path';
import { Chess } from 'chess.js';

// Map botLevel (1-20) → Stockfish Skill Level (0-20) and search depth
const SKILL_MAP: Record<number, { skill: number; depth: number }> = {
  1:  { skill: 0,  depth: 1  },
  2:  { skill: 2,  depth: 2  },
  3:  { skill: 4,  depth: 3  },
  4:  { skill: 5,  depth: 4  },
  5:  { skill: 7,  depth: 5  },
  6:  { skill: 8,  depth: 6  },
  7:  { skill: 9,  depth: 7  },
  8:  { skill: 10, depth: 8  },
  9:  { skill: 11, depth: 9  },
  10: { skill: 12, depth: 10 },
  11: { skill: 13, depth: 11 },
  12: { skill: 14, depth: 12 },
  13: { skill: 15, depth: 13 },
  14: { skill: 16, depth: 14 },
  15: { skill: 17, depth: 15 },
  16: { skill: 17, depth: 16 },
  17: { skill: 18, depth: 17 },
  18: { skill: 19, depth: 18 },
  19: { skill: 20, depth: 19 },
  20: { skill: 20, depth: 20 },
};

// stockfish-18-asm.js path: when run as `node stockfish-18-asm.js` (main module),
// it reads UCI commands from stdin and writes responses to stdout.
// We spawn it as a child process so it runs non-blocking in a separate OS process.
const STOCKFISH_SCRIPT = path.join(__dirname, '../../node_modules/stockfish/bin/stockfish-18-asm.js');

/**
 * Ask Stockfish for the best move given a FEN position and bot difficulty level.
 * Returns the best move in UCI notation (e.g. "e2e4", "e7e8q").
 *
 * Spawns stockfish-18-asm.js as a child process (stdin/stdout UCI),
 * so the main Node.js event loop stays free while the engine calculates.
 */
export function getBotMove(fen: string, botLevel: number): Promise<string> {
  const config = SKILL_MAP[botLevel] ?? SKILL_MAP[5];

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [STOCKFISH_SCRIPT], {
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    let buffer = '';
    let settled = false;

    const finish = (err: Error | null, move?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      if (err) reject(err);
      else resolve(move!);
    };

    const timeoutId = setTimeout(
      () => finish(new Error(`Stockfish timeout (botLevel ${botLevel})`)),
      15000,
    );

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('bestmove ')) {
          const move = line.split(' ')[1];
          if (move && move !== '(none)') {
            finish(null, move);
          } else {
            finish(new Error('Stockfish returned no valid move'));
          }
          return;
        }
      }
    });

    child.on('error', (err: Error) => finish(err));

    // Send UCI commands via stdin — buffered until engine's readline is ready
    child.stdin.write(`setoption name Skill Level value ${config.skill}\n`);
    child.stdin.write('uci\n');
    child.stdin.write('isready\n');
    child.stdin.write(`position fen ${fen}\n`);
    child.stdin.write(`go depth ${config.depth}\n`);
  });
}

// ─── Multi-PV Analysis ────────────────────────────────────────────────────────

export interface AnalysisLine {
  uci: string;
  san: string;
  /** Centipawns from White's perspective (positive = white advantage). */
  score: number;
  /** Non-null when Stockfish finds forced mate: +N = white mates in N, -N = black mates in N. */
  mate: number | null;
}

/**
 * Analyse a position with Stockfish MultiPV, returning up to `numLines` best
 * moves sorted by engine preference.
 *
 * @param fen       FEN string of the position to analyse.
 * @param numLines  How many lines to return (1–5).
 * @param moveTimeMs How long (ms) the engine is allowed to think.
 */
export function analyzePosition(
  fen: string,
  numLines = 3,
  moveTimeMs = 2500,
): Promise<AnalysisLine[]> {
  const lines = Math.min(Math.max(1, numLines), 5);

  // Determine whose turn it is from the FEN (2nd space-separated field: 'w' or 'b')
  const isBlackTurn = fen.split(' ')[1] === 'b';

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [STOCKFISH_SCRIPT], {
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    let buffer = '';
    let settled = false;

    // Track the latest result per multipv index (overwritten by deeper searches)
    const bestPerLine = new Map<number, { score: number; mate: number | null; uci: string }>();

    const finish = (err: Error | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      try { child.kill('SIGKILL'); } catch { /* ignore */ }

      if (err) { reject(err); return; }

      const output: AnalysisLine[] = [];

      for (let idx = 1; idx <= lines; idx++) {
        const r = bestPerLine.get(idx);
        if (!r || !r.uci) continue;

        const uci = r.uci;
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.length > 4 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined;

        // Convert UCI → SAN for display
        let san = uci;
        try {
          const tempChess = new Chess(fen);
          const moveResult = tempChess.move({ from, to, promotion });
          if (moveResult) san = moveResult.san;
        } catch { /* keep uci as fallback */ }

        output.push({ uci, san, score: r.score, mate: r.mate });
      }

      resolve(output);
    };

    const timeoutId = setTimeout(
      () => finish(new Error('Stockfish analysis timeout')),
      moveTimeMs + 5000,
    );

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const rawLines = buffer.split('\n');
      buffer = rawLines.pop() ?? '';

      for (const line of rawLines) {
        if (line.startsWith('bestmove ')) {
          finish(null);
          return;
        }

        if (line.startsWith('info ') && line.includes('multipv')) {
          const mpvMatch = line.match(/\bmultipv (\d+)/);
          if (!mpvMatch) continue;
          const mpvIdx = parseInt(mpvMatch[1]);

          let rawScore = 0;
          let mate: number | null = null;

          const mateMatch = line.match(/\bscore mate (-?\d+)/);
          const cpMatch = line.match(/\bscore cp (-?\d+)/);

          if (mateMatch) {
            mate = parseInt(mateMatch[1]);
            rawScore = mate > 0 ? 30000 : -30000;
          } else if (cpMatch) {
            rawScore = parseInt(cpMatch[1]);
          } else {
            continue;
          }

          // Flip to white-relative score
          const score = isBlackTurn ? -rawScore : rawScore;
          const whiteMate = mate !== null ? (isBlackTurn ? -mate : mate) : null;

          // Extract first move from the principal variation
          const pvMatch = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
          if (!pvMatch) continue;

          bestPerLine.set(mpvIdx, { score, mate: whiteMate, uci: pvMatch[1] });
        }
      }
    });

    child.on('error', (err: Error) => finish(err));

    child.stdin.write(`setoption name MultiPV value ${lines}\n`);
    child.stdin.write('uci\n');
    child.stdin.write('isready\n');
    child.stdin.write(`position fen ${fen}\n`);
    child.stdin.write(`go movetime ${moveTimeMs}\n`);
  });
}
