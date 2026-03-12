import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Chess } from 'chess.js';
import { GameStatus, GameResult } from '@prisma/client';
import { GameRepository } from '../repositories/game.repository';
import { UserRepository } from '../repositories/user.repository';
import { computeEloChange } from '../services/elo.service';
import { logger } from '../utils/logger';

// ── Types ──────────────────────────────────────────────────────────────────────

interface JwtPayload {
  id: string;
  username: string;
  email: string;
}

interface AuthSocket extends Socket {
  data: { user: JwtPayload };
}

// ── Singletons ─────────────────────────────────────────────────────────────────

let io: SocketIOServer;
const gameRepo = new GameRepository();
const userRepo = new UserRepository();

// In-memory matchmaking queue: userId → socketId
const queue = new Map<string, string>();

// ── PvP Chess Clock ────────────────────────────────────────────────────────────

const INITIAL_TIME_MS = 10 * 60 * 1000; // 10+0

interface ClockEntry {
  whiteMs: number;
  blackMs: number;
  /** Whose clock is currently running ('w'|'b'), or null when game ended. */
  activeColor: 'w' | 'b' | null;
  /** Date.now() when the running side's clock was last (re)started. */
  lastStartedAt: number;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
}

const clocks = new Map<string, ClockEntry>();

/** Compute a client-friendly snapshot that accounts for elapsed time. */
function clockSnapshot(entry: ClockEntry) {
  const elapsed = entry.activeColor ? Math.max(0, Date.now() - entry.lastStartedAt) : 0;
  const whiteMs = entry.activeColor === 'w'
    ? Math.max(0, entry.whiteMs - elapsed)
    : entry.whiteMs;
  const blackMs = entry.activeColor === 'b'
    ? Math.max(0, entry.blackMs - elapsed)
    : entry.blackMs;
  return { whiteMs, blackMs, activeColor: entry.activeColor, serverTs: Date.now() };
}

/** Stop and clear any running timeout for a game's clock. */
function clearClock(gameId: string) {
  const entry = clocks.get(gameId);
  if (entry?.timeoutHandle) clearTimeout(entry.timeoutHandle);
  clocks.delete(gameId);
}

/** Called when a side's flag falls. Finalises the game in DB + emits events. */
async function handleClockTimeout(gameId: string, loserColor: 'w' | 'b') {
  try {
    const game = await gameRepo.findById(gameId);
    if (!game || game.status !== 'ACTIVE') return;

    const result = loserColor === 'w' ? GameResult.BLACK_WIN : GameResult.WHITE_WIN;
    await gameRepo.updateFenAndStatus({ gameId, fen: game.fen, status: GameStatus.FINISHED, result });

    const entry = clocks.get(gameId);
    if (entry) {
      if (loserColor === 'w') entry.whiteMs = 0; else entry.blackMs = 0;
      entry.activeColor = null;
      entry.timeoutHandle = null;
    }

    let whiteDelta = 0, blackDelta = 0;
    if (game.blackPlayerId) {
      ({ whiteDelta, blackDelta } = await applyMultiplayerElo(
        gameId, game.whitePlayerId, game.blackPlayerId, result,
      ));
    }

    io.to(`game:${gameId}`).emit('clock:timeout', { loser: loserColor });
    io.to(`game:${gameId}`).emit('game:ended', {
      result,
      whiteRatingDelta: whiteDelta,
      blackRatingDelta: blackDelta,
    });

    clocks.delete(gameId);
  } catch (err) {
    logger.error('clock timeout error', err);
  }
}

// ── ELO helper for multiplayer ─────────────────────────────────────────────────

async function applyMultiplayerElo(
  gameId: string,
  whiteId: string,
  blackId: string,
  result: GameResult,
): Promise<{ whiteDelta: number; blackDelta: number }> {
  const [white, black] = await Promise.all([
    userRepo.findById(whiteId),
    userRepo.findById(blackId),
  ]);
  if (!white || !black) return { whiteDelta: 0, blackDelta: 0 };

  const whiteScore = result === GameResult.WHITE_WIN ? 1 : result === GameResult.DRAW ? 0.5 : 0;
  const blackScore = 1 - whiteScore;

  const { newRating: newWhiteRating, delta: whiteDelta } = computeEloChange(
    white.rating, black.rating, whiteScore,
  );
  const { newRating: newBlackRating, delta: blackDelta } = computeEloChange(
    black.rating, white.rating, blackScore,
  );

  await Promise.all([
    userRepo.updateRating(whiteId, newWhiteRating),
    userRepo.updateRating(blackId, newBlackRating),
    gameRepo.createRatingHistory({ userId: whiteId, gameId, ratingBefore: white.rating, ratingAfter: newWhiteRating }),
    gameRepo.createRatingHistory({ userId: blackId, gameId, ratingBefore: black.rating, ratingAfter: newBlackRating }),
  ]);

  return { whiteDelta, blackDelta };
}

// ── Main init ──────────────────────────────────────────────────────────────────

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (process.env.FRONTEND_URL ?? 'http://localhost:5173')
        .split(',').map((o) => o.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
  });

  // ── JWT auth middleware ──────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Authentication required'));
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) return next(new Error('Server misconfigured'));
      const decoded = jwt.verify(token, secret) as JwtPayload;
      (socket as AuthSocket).data.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ───────────────────────────────────────────────────────
  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as AuthSocket;
    const { id: userId, username } = socket.data.user;
    logger.info(`Socket connected: ${socket.id} (${username})`);

    // ── Matchmaking ────────────────────────────────────────────────────────────

    socket.on('queue:join', async () => {
      try {
        // Update socketId if user was already in queue (reconnect)
        queue.set(userId, socket.id);
        logger.info(`${username} joined queue (${queue.size} in queue)`);

        if (queue.size < 2) {
          socket.emit('queue:waiting');
          return;
        }

        // Find the first other player in the queue
        let opponentId: string | null = null;
        let opponentSocketId: string | null = null;
        for (const [uid, sid] of queue.entries()) {
          if (uid !== userId) {
            opponentId = uid;
            opponentSocketId = sid;
            break;
          }
        }

        if (!opponentId || !opponentSocketId) {
          socket.emit('queue:waiting');
          return;
        }

        // Remove both players from queue
        queue.delete(userId);
        queue.delete(opponentId);

        // Create the game — first in queue is white, new joiner is black
        const chess = new Chess();
        const game = await gameRepo.create({
          whitePlayerId: opponentId,
          blackPlayerId: userId,
          isBotGame: false,
          botLevel: null,
          status: GameStatus.ACTIVE,
          fen: chess.fen(),
        });

        const gameId = game.id;
        logger.info(`Match created: ${gameId} (white:${opponentId} vs black:${userId})`);

        // Notify both players
        io.to(opponentSocketId).emit('queue:matched', { gameId, color: 'white' });
        socket.emit('queue:matched', { gameId, color: 'black' });

        // Start clock: white moves first, so white's clock ticks immediately
        const clockEntry: ClockEntry = {
          whiteMs: INITIAL_TIME_MS,
          blackMs: INITIAL_TIME_MS,
          activeColor: 'w',
          lastStartedAt: Date.now(),
          timeoutHandle: null,
        };
        clockEntry.timeoutHandle = setTimeout(
          () => handleClockTimeout(gameId, 'w'),
          INITIAL_TIME_MS,
        );
        clocks.set(gameId, clockEntry);
      } catch (err) {
        logger.error('queue:join error', err);
        socket.emit('error', { message: 'Matchmaking failed. Please try again.' });
      }
    });

    socket.on('queue:leave', () => {
      queue.delete(userId);
      logger.info(`${username} left queue`);
    });

    // ── Game room ──────────────────────────────────────────────────────────────

    socket.on('game:join', async ({ gameId }: { gameId: string }) => {
      try {
        const game = await gameRepo.findById(gameId);
        if (!game) return socket.emit('error', { message: 'Game not found.' });

        const isPlayer = game.whitePlayerId === userId || game.blackPlayerId === userId;
        if (!isPlayer) return socket.emit('error', { message: 'Not a player in this game.' });

        await socket.join(`game:${gameId}`);

        // Tell everyone else in the room that an opponent connected
        socket.to(`game:${gameId}`).emit('opponent:connected', { username });

        // Send current game state to the joining socket
        socket.emit('game:state', { game });

        // Send current clock state (handles reconnect)
        const clockEntry = clocks.get(gameId);
        if (clockEntry) {
          socket.emit('clock:state', clockSnapshot(clockEntry));
        }
      } catch (err) {
        logger.error('game:join error', err);
        socket.emit('error', { message: 'Failed to join game.' });
      }
    });

    // ── Move ───────────────────────────────────────────────────────────────────

    socket.on(
      'game:move',
      async ({ gameId, from, to, promotion }: { gameId: string; from: string; to: string; promotion?: string }) => {
        try {
          const game = await gameRepo.findById(gameId);
          if (!game) return socket.emit('error', { message: 'Game not found.' });
          if (game.status !== GameStatus.ACTIVE)
            return socket.emit('error', { message: 'Game is not active.' });

          const chess = new Chess(game.fen);
          const turn = chess.turn(); // 'w' or 'b'
          const isWhite = game.whitePlayerId === userId;
          const isBlack = game.blackPlayerId === userId;

          if ((turn === 'w' && !isWhite) || (turn === 'b' && !isBlack))
            return socket.emit('error', { message: 'Not your turn.' });

          let moveResult;
          try {
            moveResult = chess.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined });
          } catch {
            return socket.emit('error', { message: 'Invalid move.' });
          }
          if (!moveResult) return socket.emit('error', { message: 'Invalid move.' });

          const moveNumber = chess.history().length;
          const newFen = chess.fen();

          let newStatus: GameStatus = GameStatus.ACTIVE;
          let result: GameResult | null = null;
          if (chess.isCheckmate()) {
            newStatus = GameStatus.FINISHED;
            result = turn === 'w' ? GameResult.WHITE_WIN : GameResult.BLACK_WIN;
          } else if (chess.isDraw() || chess.isStalemate()) {
            newStatus = GameStatus.FINISHED;
            result = GameResult.DRAW;
          }

          await gameRepo.addMove({ gameId, moveNumber, san: moveResult.san, uci: `${from}${to}${promotion ?? ''}`, color: turn });
          await gameRepo.updateFenAndStatus({ gameId, fen: newFen, status: newStatus, result });

          const movePayload = {
            move: { san: moveResult.san, uci: `${from}${to}${promotion ?? ''}`, color: turn },
            fen: newFen,
            status: newStatus,
            result,
          };

          // Broadcast move to everyone in the room (including sender)
          io.to(`game:${gameId}`).emit('game:move', movePayload);

          // ── Update clock ────────────────────────────────────────────────────
          const clockEntry = clocks.get(gameId);
          if (clockEntry && clockEntry.activeColor) {
            const elapsed = Math.max(0, Date.now() - clockEntry.lastStartedAt);
            if (clockEntry.activeColor === 'w') clockEntry.whiteMs = Math.max(0, clockEntry.whiteMs - elapsed);
            else                                clockEntry.blackMs = Math.max(0, clockEntry.blackMs - elapsed);

            // Clear old timeout
            if (clockEntry.timeoutHandle) clearTimeout(clockEntry.timeoutHandle);

            if (newStatus === GameStatus.FINISHED) {
              // Game already over — stop clock
              clockEntry.activeColor = null;
              clockEntry.timeoutHandle = null;
              clocks.delete(gameId);
            } else {
              // Switch to the other side
              const nextColor: 'w' | 'b' = turn === 'w' ? 'b' : 'w';
              clockEntry.activeColor = nextColor;
              clockEntry.lastStartedAt = Date.now();
              const nextMs = nextColor === 'w' ? clockEntry.whiteMs : clockEntry.blackMs;
              clockEntry.timeoutHandle = setTimeout(
                () => handleClockTimeout(gameId, nextColor),
                nextMs,
              );
              io.to(`game:${gameId}`).emit('clock:state', clockSnapshot(clockEntry));
            }
          }

          if (newStatus === GameStatus.FINISHED && result && game.blackPlayerId) {
            const { whiteDelta, blackDelta } = await applyMultiplayerElo(
              gameId, game.whitePlayerId, game.blackPlayerId, result,
            );
            io.to(`game:${gameId}`).emit('game:ended', {
              result,
              whiteRatingDelta: whiteDelta,
              blackRatingDelta: blackDelta,
            });
          }
        } catch (err) {
          logger.error('game:move error', err);
          socket.emit('error', { message: 'Move processing failed.' });
        }
      },
    );

    // ── Resign ─────────────────────────────────────────────────────────────────

    socket.on('game:resign', async ({ gameId }: { gameId: string }) => {
      try {
        const game = await gameRepo.findById(gameId);
        if (!game) return socket.emit('error', { message: 'Game not found.' });
        if (game.status !== GameStatus.ACTIVE)
          return socket.emit('error', { message: 'Game is not active.' });

        const isPlayer = game.whitePlayerId === userId || game.blackPlayerId === userId;
        if (!isPlayer) return socket.emit('error', { message: 'Not a player in this game.' });

        const result = game.whitePlayerId === userId ? GameResult.BLACK_WIN : GameResult.WHITE_WIN;
        await gameRepo.updateFenAndStatus({ gameId, fen: game.fen, status: GameStatus.FINISHED, result });

        // Stop the clock
        clearClock(gameId);

        let whiteDelta = 0, blackDelta = 0;
        if (game.blackPlayerId) {
          ({ whiteDelta, blackDelta } = await applyMultiplayerElo(
            gameId, game.whitePlayerId, game.blackPlayerId, result,
          ));
        }

        io.to(`game:${gameId}`).emit('game:ended', {
          result,
          whiteRatingDelta: whiteDelta,
          blackRatingDelta: blackDelta,
        });
      } catch (err) {
        logger.error('game:resign error', err);
        socket.emit('error', { message: 'Resign failed.' });
      }
    });

    // ── Disconnect ─────────────────────────────────────────────────────────────

    socket.on('disconnect', (reason) => {
      queue.delete(userId);
      logger.info(`Socket disconnected: ${socket.id} (${username}) — ${reason}`);
      // Notify any game rooms this socket was in
      for (const room of socket.rooms) {
        if (room.startsWith('game:')) {
          socket.to(room).emit('opponent:disconnected');
        }
      }
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO instance (singleton).
 */
export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized. Call initSocket() first.');
  return io;
}

/**
 * Clear the matchmaking queue.
 * For use in tests only — do NOT call in production code.
 */
export function clearQueue(): void {
  queue.clear();
}

/**
 * Clear all in-memory clock entries and cancel their pending timeouts.
 * For use in tests only — prevents setTimeout leaks across test cases.
 */
export function clearClocks(): void {
  clocks.forEach((entry) => {
    if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
  });
  clocks.clear();
}
