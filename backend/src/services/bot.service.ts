import { spawn } from 'child_process';
import path from 'path';

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
