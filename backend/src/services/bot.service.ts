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

// Resolved at runtime relative to compiled dist/services/ → project root/node_modules
const STOCKFISH_PATH = path.join(__dirname, '../../node_modules/stockfish/bin/stockfish-18-asm.js');

/**
 * Ask Stockfish for the best move given a FEN position and bot difficulty level.
 * Returns the best move in UCI notation (e.g. "e2e4", "e7e8q").
 */
export function getBotMove(fen: string, botLevel: number): Promise<string> {
  const config = SKILL_MAP[botLevel] ?? SKILL_MAP[5];

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stockfish = require(STOCKFISH_PATH) as (opts?: unknown) => ((cmd: string) => void) & { listener?: (msg: string) => void };
    const sf = Stockfish();

    const timeoutId = setTimeout(() => {
      try { sf('quit'); } catch { /* ignore */ }
      reject(new Error(`Stockfish timeout for bot level ${botLevel}`));
    }, 15000);

    sf.listener = (msg: string) => {
      if (msg === 'readyok') {
        sf(`position fen ${fen}`);
        sf(`go depth ${config.depth}`);
      } else {
        const match = msg.match(/^bestmove (\S+)/);
        if (match) {
          clearTimeout(timeoutId);
          const move = match[1];
          if (move === '(none)') {
            reject(new Error('Stockfish returned no legal move'));
          } else {
            resolve(move);
          }
        }
      }
    };

    sf(`setoption name Skill Level value ${config.skill}`);
    sf('uci');
    sf('isready');
  });
}
