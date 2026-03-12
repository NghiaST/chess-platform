/**
 * Integration tests for the Socket.IO multiplayer layer.
 *
 * Strategy: spin up a real in-process HTTP + Socket.IO server on a random port,
 * connect real socket.io-client sockets (one per simulated player), and drive
 * the full event protocol.  Only the DB layer (Repositories) is mocked.
 */

jest.mock('../config/database', () => ({ __esModule: true, default: {} }));
jest.mock('../repositories/game.repository');
jest.mock('../repositories/user.repository');

import { createServer } from 'http';
import type { AddressInfo } from 'net';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { GameStatus, GameResult } from '@prisma/client';
import { GameRepository } from '../repositories/game.repository';
import { UserRepository } from '../repositories/user.repository';
import { initSocket, getIO, clearQueue, clearClocks } from '../config/socket';

// ── Mock repo references ───────────────────────────────────────────────────────

const MockGameRepo = GameRepository as jest.MockedClass<typeof GameRepository>;
const MockUserRepo = UserRepository as jest.MockedClass<typeof UserRepository>;
let gameRepoMock: jest.Mocked<GameRepository>;
let userRepoMock: jest.Mocked<UserRepository>;

// ── Test server ────────────────────────────────────────────────────────────────

let serverPort: number;
let httpServer: ReturnType<typeof createServer>;
// Track every client opened so afterEach can close them
let openClients: ClientSocket[] = [];

beforeAll(async () => {
  // Repos are instantiated at module load time (module-level singletons in socket.ts)
  gameRepoMock = MockGameRepo.mock.instances[0] as jest.Mocked<GameRepository>;
  userRepoMock = MockUserRepo.mock.instances[0] as jest.Mocked<UserRepository>;

  httpServer = createServer();
  initSocket(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  serverPort = (httpServer.address() as AddressInfo).port;
});

afterAll(async () => {
  try { getIO().close(); } catch { /* not yet initialized */ }
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

// Reset between tests: clearAllMocks() clears call counts but not implementations.
// We use resetAllMocks() so each test starts from a fully clean mock state, then
// beforeEach re-applies the always-needed default stubs.
beforeEach(() => {
  jest.resetAllMocks();
  // Default stubs: void-like helpers called inside applyMultiplayerElo
  gameRepoMock.createRatingHistory.mockResolvedValue({} as never);
  userRepoMock.updateRating.mockResolvedValue({} as never);
});

afterEach(async () => {
  // Close every client socket opened during the test
  for (const s of openClients) { s.removeAllListeners(); s.close(); }
  openClients = [];
  clearQueue();
  // Cancel any in-flight clock timeouts so they don't leak into other tests
  clearClocks();
});

// ── Helpers ────────────────────────────────────────────────────────────────────

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const GAME_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const ALICE = { id: 'alice-uuid-1', username: 'Alice', email: 'alice@test.com' };
const BOB   = { id: 'bob-uuid-2',   username: 'Bob',   email: 'bob@test.com'   };

function makeToken(user: { id: string; username: string; email: string }): string {
  return jwt.sign(user, process.env.JWT_SECRET!, { expiresIn: '1h' });
}

/**
 * Wait for a socket event with a timeout.  Returns the first argument emitted.
 */
function waitForEvent<T = unknown>(socket: ClientSocket, event: string, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout (${ms}ms) waiting for "${event}"`)),
      ms,
    );
    socket.once(event, (data: T) => { clearTimeout(timer); resolve(data); });
  });
}

/**
 * Open an authenticated socket connection and wait until it is connected.
 */
async function connectAs(user: typeof ALICE): Promise<ClientSocket> {
  const socket = ioClient(`http://localhost:${serverPort}`, {
    path: '/socket.io',
    auth: { token: makeToken(user) },
    forceNew: true,       // each call gets its own socket instance
    reconnection: false,
  });
  openClients.push(socket);
  await waitForEvent(socket, 'connect');
  return socket;
}

/** Minimal game fixture returned by mocked repo */
function makeMockGame(overrides: Record<string, unknown> = {}) {
  return {
    id: GAME_ID,
    whitePlayerId: ALICE.id,
    blackPlayerId: BOB.id,
    isBotGame: false,
    botLevel: null,
    status: GameStatus.ACTIVE as GameStatus,
    result: null as GameResult | null,
    fen: INITIAL_FEN,
    moves: [],
    whitePlayer: { id: ALICE.id, username: ALICE.username, rating: 1200 },
    blackPlayer: { id: BOB.id,   username: BOB.username,   rating: 1200 },
    ratingHistory: [],
    ...overrides,
  };
}

// ── Authentication ─────────────────────────────────────────────────────────────
describe('Socket authentication', () => {
  it('rejects connection without a token', async () => {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      path: '/socket.io',
      forceNew: true,
      reconnection: false,
    });
    openClients.push(socket);

    const err = await waitForEvent<Error>(socket, 'connect_error');
    expect(err.message).toMatch(/authentication/i);
  });

  it('rejects connection with an invalid token', async () => {
    const socket = ioClient(`http://localhost:${serverPort}`, {
      path: '/socket.io',
      auth: { token: 'not.a.valid.jwt' },
      forceNew: true,
      reconnection: false,
    });
    openClients.push(socket);

    const err = await waitForEvent<Error>(socket, 'connect_error');
    expect(err.message).toMatch(/invalid/i);
  });

  it('accepts a connection with a valid JWT', async () => {
    const socket = await connectAs(ALICE);
    expect(socket.connected).toBe(true);
  });
});

// ── Matchmaking ────────────────────────────────────────────────────────────────
describe('Matchmaking', () => {
  it('emits queue:waiting when only one player is in the queue', async () => {
    const alice = await connectAs(ALICE);

    // Set up listener BEFORE emitting to avoid racing
    const waitingPromise = waitForEvent(alice, 'queue:waiting');
    alice.emit('queue:join');

    await waitingPromise; // resolving without timeout means the event arrived
    expect(gameRepoMock.create).not.toHaveBeenCalled();
  });

  it('matches two players, creates a game, and sends opposite colors', async () => {
    gameRepoMock.create.mockResolvedValue(makeMockGame() as never);

    const [alice, bob] = await Promise.all([connectAs(ALICE), connectAs(BOB)]);

    // Register listeners BEFORE emitting
    const aliceMatched = waitForEvent<{ gameId: string; color: string }>(alice, 'queue:matched');
    const bobMatched   = waitForEvent<{ gameId: string; color: string }>(bob,   'queue:matched');

    alice.emit('queue:join');
    bob.emit('queue:join');

    const [ar, br] = await Promise.all([aliceMatched, bobMatched]);

    expect(ar.gameId).toBe(GAME_ID);
    expect(br.gameId).toBe(GAME_ID);
    // Colors must be opposite
    expect(new Set([ar.color, br.color])).toEqual(new Set(['white', 'black']));
    // Only one game created
    expect(gameRepoMock.create).toHaveBeenCalledTimes(1);
    expect(gameRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ isBotGame: false, status: GameStatus.ACTIVE }),
    );
  });

  it('does not match after queue:leave', async () => {
    const [alice, bob] = await Promise.all([connectAs(ALICE), connectAs(BOB)]);

    // Alice joins and immediately leaves
    const aliceWaiting = waitForEvent(alice, 'queue:waiting');
    alice.emit('queue:join');
    await aliceWaiting;
    alice.emit('queue:leave');

    // Give server a tick to process the leave
    await new Promise((r) => setTimeout(r, 50));

    // Bob joins — queue is empty again, so only 1 player
    const bobWaiting = waitForEvent(bob, 'queue:waiting');
    bob.emit('queue:join');
    await bobWaiting;

    expect(gameRepoMock.create).not.toHaveBeenCalled();
  });

  it('removes a player from the queue on disconnect', async () => {
    const [alice, bob] = await Promise.all([connectAs(ALICE), connectAs(BOB)]);

    const aliceWaiting = waitForEvent(alice, 'queue:waiting');
    alice.emit('queue:join');
    await aliceWaiting;

    // Alice disconnects unexpectedly
    alice.close();
    await new Promise((r) => setTimeout(r, 100));

    // Bob joins — should see waiting (queue was cleared by Alice's disconnect)
    const bobWaiting = waitForEvent(bob, 'queue:waiting');
    bob.emit('queue:join');
    await bobWaiting;

    expect(gameRepoMock.create).not.toHaveBeenCalled();
  });

  it('does not double-match when the same user reconnects and re-joins', async () => {
    gameRepoMock.create.mockResolvedValue(makeMockGame() as never);

    const [alice, bob] = await Promise.all([connectAs(ALICE), connectAs(BOB)]);

    const aliceMatched = waitForEvent<{ gameId: string }>(alice, 'queue:matched');
    const bobMatched   = waitForEvent<{ gameId: string }>(bob,   'queue:matched');

    alice.emit('queue:join');
    // Alice "re-joins" (simulates StrictMode double-emit) — idempotent since Map
    alice.emit('queue:join');
    bob.emit('queue:join');

    await Promise.all([aliceMatched, bobMatched]);
    // Even with the double join, the game is only created once
    expect(gameRepoMock.create).toHaveBeenCalledTimes(1);
  });
});

// ── Game room ──────────────────────────────────────────────────────────────────
describe('Game: joining a room', () => {
  it('sends game:state to the joining socket', async () => {
    gameRepoMock.findById.mockResolvedValue(makeMockGame() as never);

    const alice = await connectAs(ALICE);
    const statePromise = waitForEvent<{ game: ReturnType<typeof makeMockGame> }>(alice, 'game:state');
    alice.emit('game:join', { gameId: GAME_ID });

    const { game } = await statePromise;
    expect(game.id).toBe(GAME_ID);
    expect(game.fen).toBe(INITIAL_FEN);
  });

  it('broadcasts opponent:connected to the first player when the second joins', async () => {
    gameRepoMock.findById.mockResolvedValue(makeMockGame() as never);

    const [alice, bob] = await Promise.all([connectAs(ALICE), connectAs(BOB)]);

    // Alice joins first
    const aliceState = waitForEvent(alice, 'game:state');
    alice.emit('game:join', { gameId: GAME_ID });
    await aliceState;

    // Bob joins — Alice should see opponent:connected
    const aliceOpponent = waitForEvent<{ username: string }>(alice, 'opponent:connected');
    const bobState      = waitForEvent(bob, 'game:state');
    bob.emit('game:join', { gameId: GAME_ID });

    const [{ username }] = await Promise.all([aliceOpponent, bobState]);
    expect(username).toBe(BOB.username);
  });

  it('returns error when the game does not exist', async () => {
    gameRepoMock.findById.mockResolvedValue(null);

    const alice = await connectAs(ALICE);
    const errorPromise = waitForEvent<{ message: string }>(alice, 'error');
    alice.emit('game:join', { gameId: GAME_ID });

    const err = await errorPromise;
    expect(err.message).toMatch(/not found/i);
  });

  it('returns error when the user is not a player in the game', async () => {
    const stranger = { id: 'stranger-uuid', username: 'Eve', email: 'eve@test.com' };
    gameRepoMock.findById.mockResolvedValue(makeMockGame() as never);

    const eve = await connectAs(stranger);
    const errorPromise = waitForEvent<{ message: string }>(eve, 'error');
    eve.emit('game:join', { gameId: GAME_ID });

    const err = await errorPromise;
    expect(err.message).toMatch(/not a player/i);
  });
});

// ── Move ───────────────────────────────────────────────────────────────────────
describe('Game: move', () => {
  beforeEach(() => {
    gameRepoMock.addMove.mockResolvedValue({} as never);
    gameRepoMock.updateFenAndStatus.mockResolvedValue(makeMockGame() as never);
  });

  /** Helper: both players join the room and wait for game:state */
  async function bothJoin() {
    const [alice, bob] = await Promise.all([connectAs(ALICE), connectAs(BOB)]);
    const aliceState = waitForEvent(alice, 'game:state');
    const bobState   = waitForEvent(bob,   'game:state');
    alice.emit('game:join', { gameId: GAME_ID });
    bob.emit('game:join',   { gameId: GAME_ID });
    await Promise.all([aliceState, bobState]);
    return { alice, bob };
  }

  it('broadcasts game:move to both players', async () => {
    gameRepoMock.findById.mockResolvedValue(makeMockGame() as never);
    const { alice, bob } = await bothJoin();

    const aliceMove = waitForEvent<{ move: { san: string }; fen: string }>(alice, 'game:move');
    const bobMove   = waitForEvent<{ move: { san: string }; fen: string }>(bob,   'game:move');
    alice.emit('game:move', { gameId: GAME_ID, from: 'e2', to: 'e4' });

    const [am, bm] = await Promise.all([aliceMove, bobMove]);
    expect(am.move.san).toBe('e4');
    expect(bm.move.san).toBe('e4');
    expect(am.fen).not.toBe(INITIAL_FEN);
    expect(gameRepoMock.addMove).toHaveBeenCalledWith(
      expect.objectContaining({ san: 'e4', color: 'w' }),
    );
  });

  it('returns error when moving out of turn', async () => {
    // White's turn at start; Bob is black → not his turn
    gameRepoMock.findById.mockResolvedValue(makeMockGame() as never);
    const bob = await connectAs(BOB);

    const errorPromise = waitForEvent<{ message: string }>(bob, 'error');
    bob.emit('game:move', { gameId: GAME_ID, from: 'e7', to: 'e5' });

    const err = await errorPromise;
    expect(err.message).toMatch(/not your turn/i);
    expect(gameRepoMock.addMove).not.toHaveBeenCalled();
  });

  it('returns error for an illegal chess move', async () => {
    gameRepoMock.findById.mockResolvedValue(makeMockGame() as never);
    const alice = await connectAs(ALICE);

    const errorPromise = waitForEvent<{ message: string }>(alice, 'error');
    // Pawn can't jump 3 squares
    alice.emit('game:move', { gameId: GAME_ID, from: 'e2', to: 'e6' });

    const err = await errorPromise;
    expect(err.message).toMatch(/invalid/i);
    expect(gameRepoMock.addMove).not.toHaveBeenCalled();
  });

  it('returns error when the game is already finished', async () => {
    gameRepoMock.findById.mockResolvedValue(
      makeMockGame({ status: GameStatus.FINISHED }) as never,
    );
    const alice = await connectAs(ALICE);

    const errorPromise = waitForEvent<{ message: string }>(alice, 'error');
    alice.emit('game:move', { gameId: GAME_ID, from: 'e2', to: 'e4' });

    const err = await errorPromise;
    expect(err.message).toMatch(/not active/i);
  });

  it('emits game:ended with ELO deltas after a checkmating move', async () => {
    // Position after 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 — white can play Qxf7# (Scholar's mate)
    const premateFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    const mateGame = makeMockGame({ fen: premateFen });
    const finishedGame = makeMockGame({
      fen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4',
      status: GameStatus.FINISHED,
      result: GameResult.WHITE_WIN,
    });

    gameRepoMock.findById.mockResolvedValue(mateGame as never);
    gameRepoMock.updateFenAndStatus.mockResolvedValue(finishedGame as never);
    userRepoMock.findById
      .mockResolvedValueOnce({ id: ALICE.id, rating: 1200 } as never)
      .mockResolvedValueOnce({ id: BOB.id,   rating: 1200 } as never);

    const { alice, bob } = await bothJoin();

    const aliceEnded = waitForEvent<{ result: string; whiteRatingDelta: number; blackRatingDelta: number }>(alice, 'game:ended');
    const bobEnded   = waitForEvent<{ result: string; whiteRatingDelta: number; blackRatingDelta: number }>(bob,   'game:ended');

    // White (Alice) delivers Scholar's mate: Qh5xf7#
    alice.emit('game:move', { gameId: GAME_ID, from: 'h5', to: 'f7' });

    const [ar, br] = await Promise.all([aliceEnded, bobEnded]);
    expect(ar.result).toBe(GameResult.WHITE_WIN);
    expect(br.result).toBe(GameResult.WHITE_WIN);
    expect(typeof ar.whiteRatingDelta).toBe('number');
    expect(typeof ar.blackRatingDelta).toBe('number');
    expect(userRepoMock.updateRating).toHaveBeenCalledTimes(2);
  });
});

// ── Resign ─────────────────────────────────────────────────────────────────────
describe('Game: resign', () => {
  it('emits game:ended to both players and applies ELO', async () => {
    gameRepoMock.findById.mockResolvedValue(makeMockGame() as never);
    gameRepoMock.updateFenAndStatus.mockResolvedValue(
      makeMockGame({ status: GameStatus.FINISHED, result: GameResult.BLACK_WIN }) as never,
    );
    userRepoMock.findById
      .mockResolvedValueOnce({ id: ALICE.id, rating: 1200 } as never)
      .mockResolvedValueOnce({ id: BOB.id,   rating: 1200 } as never);

    const [alice, bob] = await Promise.all([connectAs(ALICE), connectAs(BOB)]);

    const aliceState = waitForEvent(alice, 'game:state');
    const bobState   = waitForEvent(bob, 'game:state');
    alice.emit('game:join', { gameId: GAME_ID });
    bob.emit('game:join',   { gameId: GAME_ID });
    await Promise.all([aliceState, bobState]);

    const aliceEnded = waitForEvent<{ result: string; blackRatingDelta: number }>(alice, 'game:ended');
    const bobEnded   = waitForEvent<{ result: string; blackRatingDelta: number }>(bob,   'game:ended');

    // White (Alice) resigns → Black wins
    alice.emit('game:resign', { gameId: GAME_ID });

    const [ar, br] = await Promise.all([aliceEnded, bobEnded]);
    expect(ar.result).toBe(GameResult.BLACK_WIN);
    expect(br.result).toBe(GameResult.BLACK_WIN);
    expect(typeof ar.blackRatingDelta).toBe('number');
    expect(userRepoMock.updateRating).toHaveBeenCalledTimes(2);
  });

  it('returns error when the game is not active', async () => {
    gameRepoMock.findById.mockResolvedValue(
      makeMockGame({ status: GameStatus.FINISHED }) as never,
    );

    const alice = await connectAs(ALICE);
    const errorPromise = waitForEvent<{ message: string }>(alice, 'error');
    alice.emit('game:resign', { gameId: GAME_ID });

    const err = await errorPromise;
    expect(err.message).toMatch(/not active/i);
  });

  it('returns error when the resigning user is not a player', async () => {
    gameRepoMock.findById.mockResolvedValue(makeMockGame() as never);

    const eve = await connectAs({ id: 'stranger', username: 'Eve', email: 'e@e.com' });
    const errorPromise = waitForEvent<{ message: string }>(eve, 'error');
    eve.emit('game:resign', { gameId: GAME_ID });

    const err = await errorPromise;
    expect(err.message).toMatch(/not a player/i);
  });
});

// ── PvP Chess Clock ────────────────────────────────────────────────────────────
describe('PvP chess clock', () => {
  interface ClockEvent {
    whiteMs: number;
    blackMs: number;
    activeColor: 'w' | 'b' | null;
    serverTs: number;
  }

  /**
   * Run full matchmaking flow + both players join the room.
   * Returns the clock:state snapshots received on join plus the sockets.
   */
  async function matchAndJoin() {
    gameRepoMock.create.mockResolvedValue(makeMockGame() as never);
    gameRepoMock.findById.mockResolvedValue(makeMockGame() as never);

    const [alice, bob] = await Promise.all([connectAs(ALICE), connectAs(BOB)]);

    const aliceMatched = waitForEvent<{ gameId: string }>(alice, 'queue:matched');
    const bobMatched   = waitForEvent<{ gameId: string }>(bob,   'queue:matched');
    alice.emit('queue:join');
    bob.emit('queue:join');
    await Promise.all([aliceMatched, bobMatched]);

    // Register clock listeners BEFORE emitting game:join
    const aliceClock = waitForEvent<ClockEvent>(alice, 'clock:state');
    const bobClock   = waitForEvent<ClockEvent>(bob,   'clock:state');
    alice.emit('game:join', { gameId: GAME_ID });
    bob.emit('game:join',   { gameId: GAME_ID });
    const [ac, bc] = await Promise.all([aliceClock, bobClock]);
    return { alice, bob, aliceClock: ac, bobClock: bc };
  }

  it('emits clock:state to each player when they join — both clocks at 10 min, white active', async () => {
    const { aliceClock, bobClock } = await matchAndJoin();

    // White clock has been ticking since match creation; allow up to 2s elapsed
    expect(aliceClock.whiteMs).toBeLessThanOrEqual(10 * 60 * 1000);
    expect(aliceClock.whiteMs).toBeGreaterThan(10 * 60 * 1000 - 2_000);
    // Black clock hasn't started yet — still full
    expect(aliceClock.blackMs).toBe(10 * 60 * 1000);
    expect(aliceClock.activeColor).toBe('w');
    expect(typeof aliceClock.serverTs).toBe('number');

    expect(bobClock.activeColor).toBe('w');
  });

  it('switches the active clock to black after white makes a move', async () => {
    gameRepoMock.addMove.mockResolvedValue({} as never);
    gameRepoMock.updateFenAndStatus.mockResolvedValue(makeMockGame() as never);

    const { alice, bob } = await matchAndJoin();

    const aliceClockAfterMove = waitForEvent<ClockEvent>(alice, 'clock:state');
    const bobClockAfterMove   = waitForEvent<ClockEvent>(bob,   'clock:state');

    // Alice is white; plays e4
    alice.emit('game:move', { gameId: GAME_ID, from: 'e2', to: 'e4' });

    const [ac, bc] = await Promise.all([aliceClockAfterMove, bobClockAfterMove]);
    expect(ac.activeColor).toBe('b');
    expect(bc.activeColor).toBe('b');
    // White's remaining time should be ≤ initial (some ms elapsed)
    expect(ac.whiteMs).toBeLessThanOrEqual(10 * 60 * 1000);
    // Black's time is untouched
    expect(ac.blackMs).toBe(10 * 60 * 1000);
  });

  it('does not emit clock:timeout when the game ends by resign (clock is cancelled)', async () => {
    const { alice } = await matchAndJoin();

    // Mock the resign path
    gameRepoMock.updateFenAndStatus.mockResolvedValue(
      makeMockGame({ status: GameStatus.FINISHED, result: GameResult.BLACK_WIN }) as never,
    );
    userRepoMock.findById
      .mockResolvedValueOnce({ id: ALICE.id, rating: 1200 } as never)
      .mockResolvedValueOnce({ id: BOB.id,   rating: 1200 } as never);

    let timeoutFired = false;
    alice.on('clock:timeout', () => { timeoutFired = true; });

    const ended = waitForEvent(alice, 'game:ended');
    alice.emit('game:resign', { gameId: GAME_ID });
    await ended;

    // Wait a tick to ensure no spurious events arrive
    await new Promise((r) => setTimeout(r, 50));
    expect(timeoutFired).toBe(false);
  });

  it('sends clock:state snapshot to a reconnecting player (game:join on existing game)', async () => {
    // Set up an existing active game whose clock is already running (via matchmaking)
    const { alice } = await matchAndJoin();

    // Alice "reconnects" by re-joining the game room
    const clockOnReconnect = waitForEvent<ClockEvent>(alice, 'clock:state');
    alice.emit('game:join', { gameId: GAME_ID });

    const snapshot = await clockOnReconnect;
    expect(snapshot.whiteMs).toBeLessThanOrEqual(10 * 60 * 1000);
    expect(snapshot.activeColor).toBe('w');
  });
});
