/**
 * Unit tests for GameService.
 *
 * Strategy: mock all I/O (Prisma via GameRepository/UserRepository, getBotMove)
 * so tests never need a real DB or Stockfish process. chess.js runs for real to
 * keep move-validation logic honest.
 */

// ── Mocks must be declared before imports ─────────────────────────────────────

// Mock the entire database module so PrismaClient is never instantiated
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {},
}));

// Mock bot so it never spawns a subprocess
jest.mock('../services/bot.service', () => ({
  getBotMove: jest.fn(),
}));

import { Chess } from 'chess.js';
import { GameStatus, GameResult } from '@prisma/client';
import { GameService } from '../services/game.service';
import { GameRepository } from '../repositories/game.repository';
import { UserRepository } from '../repositories/user.repository';
import { getBotMove } from '../services/bot.service';

// ── Typed mock helpers ─────────────────────────────────────────────────────────
jest.mock('../repositories/game.repository');
jest.mock('../repositories/user.repository');

const MockGameRepo = GameRepository as jest.MockedClass<typeof GameRepository>;
const MockUserRepo = UserRepository as jest.MockedClass<typeof UserRepository>;
const mockGetBotMove = getBotMove as jest.MockedFunction<typeof getBotMove>;

// ── Shared test fixtures ───────────────────────────────────────────────────────
const INITIAL_FEN = new Chess().fen();
const USER_ID = 'user-uuid-1';
const GAME_ID = 'game-uuid-1';

const mockUser = {
  id: USER_ID,
  username: 'testplayer',
  email: 'test@example.com',
  passwordHash: 'hash',
  rating: 1200,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeMockGame(overrides: Partial<ReturnType<typeof defaultGame>> = {}) {
  return { ...defaultGame(), ...overrides };
}

function defaultGame() {
  return {
    id: GAME_ID,
    whitePlayerId: USER_ID,
    blackPlayerId: null as string | null,
    isBotGame: true,
    botLevel: 5,
    status: GameStatus.ACTIVE as GameStatus,
    result: null as GameResult | null,
    fen: INITIAL_FEN,
    createdAt: new Date(),
    updatedAt: new Date(),
    moves: [],
    whitePlayer: { id: USER_ID, username: 'testplayer', rating: 1200 },
    blackPlayer: null,
    ratingHistory: [],
  };
}

// ── Setup ──────────────────────────────────────────────────────────────────────
let service: GameService;
let gameRepoMock: jest.Mocked<GameRepository>;
let userRepoMock: jest.Mocked<UserRepository>;

beforeAll(() => {
  // game.service.ts creates repos at module load time (not per-constructor call),
  // so we must capture the instances before clearAllMocks() wipes the array.
  gameRepoMock = MockGameRepo.mock.instances[0] as jest.Mocked<GameRepository>;
  userRepoMock = MockUserRepo.mock.instances[0] as jest.Mocked<UserRepository>;
});

beforeEach(() => {
  jest.clearAllMocks();
  service = new GameService();

  // Default stub: ELO-related side effects
  gameRepoMock.createRatingHistory.mockResolvedValue({} as never);
  userRepoMock.updateRating.mockResolvedValue({} as never);
});

// ── createGame ─────────────────────────────────────────────────────────────────
describe('GameService.createGame', () => {
  it('creates a bot game for an existing user', async () => {
    userRepoMock.findById.mockResolvedValue(mockUser);
    const created = makeMockGame();
    gameRepoMock.create.mockResolvedValue(created);

    const result = await service.createGame({ userId: USER_ID, isBotGame: true, botLevel: 5 });

    expect(gameRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        whitePlayerId: USER_ID,
        isBotGame: true,
        botLevel: 5,
        status: GameStatus.ACTIVE,
      }),
    );
    expect(result.id).toBe(GAME_ID);
  });

  it('throws 404 when user does not exist', async () => {
    userRepoMock.findById.mockResolvedValue(null);
    await expect(
      service.createGame({ userId: 'unknown', isBotGame: true, botLevel: 5 }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── getGameById ────────────────────────────────────────────────────────────────
describe('GameService.getGameById', () => {
  it('returns game when found', async () => {
    const game = makeMockGame();
    gameRepoMock.findById.mockResolvedValue(game);
    const result = await service.getGameById(GAME_ID);
    expect(result.id).toBe(GAME_ID);
  });

  it('throws 404 when game does not exist', async () => {
    gameRepoMock.findById.mockResolvedValue(null);
    await expect(service.getGameById('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── makeMove — validation ──────────────────────────────────────────────────────
describe('GameService.makeMove — validation', () => {
  it('throws 404 when game not found', async () => {
    gameRepoMock.findById.mockResolvedValue(null);
    await expect(
      service.makeMove({ gameId: GAME_ID, userId: USER_ID, from: 'e2', to: 'e4' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 when game is not active', async () => {
    gameRepoMock.findById.mockResolvedValue(
      makeMockGame({ status: GameStatus.FINISHED }),
    );
    await expect(
      service.makeMove({ gameId: GAME_ID, userId: USER_ID, from: 'e2', to: 'e4' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 for an illegal move', async () => {
    gameRepoMock.findById.mockResolvedValue(makeMockGame());
    await expect(
      service.makeMove({ gameId: GAME_ID, userId: USER_ID, from: 'e2', to: 'e6' }), // illegal
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when it is not the player\'s turn', async () => {
    // White is USER_ID; try to move as black (different userId)
    gameRepoMock.findById.mockResolvedValue(makeMockGame());
    await expect(
      service.makeMove({ gameId: GAME_ID, userId: 'black-player-id', from: 'e7', to: 'e5' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── makeMove — normal bot game ─────────────────────────────────────────────────
describe('GameService.makeMove — normal bot game flow', () => {
  beforeEach(() => {
    gameRepoMock.findById.mockResolvedValue(makeMockGame());
    gameRepoMock.addMove.mockResolvedValue({} as never);
    gameRepoMock.updateFenAndStatus.mockResolvedValue({
      ...makeMockGame(),
      fen: 'some-updated-fen',
      moves: [],
    });
    // Bot responds with d7d5
    mockGetBotMove.mockResolvedValue('d7d5');
  });

  it('returns player move + botMove in response', async () => {
    const result = await service.makeMove({
      gameId: GAME_ID,
      userId: USER_ID,
      from: 'e2',
      to: 'e4',
    });

    expect(result.move.uci).toBe('e2e4');
    expect(result.botMove).not.toBeNull();
    expect(result.botMove!.uci).toBe('d7d5');
    expect(result.isGameOver).toBe(false);
    expect(result.ratingDelta).toBeNull();
  });

  it('calls addMove twice (player + bot)', async () => {
    await service.makeMove({ gameId: GAME_ID, userId: USER_ID, from: 'e2', to: 'e4' });
    expect(gameRepoMock.addMove).toHaveBeenCalledTimes(2);
  });

  it('calls getBotMove with the post-player-move FEN and botLevel', async () => {
    await service.makeMove({ gameId: GAME_ID, userId: USER_ID, from: 'e2', to: 'e4' });
    const expectedFen = new Chess(INITIAL_FEN).move({ from: 'e2', to: 'e4' })
      ? new Chess(INITIAL_FEN).move({ from: 'e2', to: 'e4' }) // discard, just call getFen below
      : null;
    const tempChess = new Chess(INITIAL_FEN);
    tempChess.move({ from: 'e2', to: 'e4' });
    expect(mockGetBotMove).toHaveBeenCalledWith(tempChess.fen(), 5);
  });
});

// ── makeMove — player checkmates bot ──────────────────────────────────────────
describe('GameService.makeMove — player wins by checkmate (ELO applied)', () => {
  // Scholar's mate: e4, e5, Qh5, Nc6, Bc4, Nf6??, Qxf7#
  // We simulate this by providing a FEN one move before mate
  // FEN: white to move, Qxf7 is checkmate
  const preMate =
    'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

  it('applies ELO when player checkmates bot', async () => {
    const game = makeMockGame({ fen: preMate });
    gameRepoMock.findById.mockResolvedValue(game);
    gameRepoMock.addMove.mockResolvedValue({} as never);
    gameRepoMock.updateFenAndStatus.mockResolvedValue({
      ...game,
      status: GameStatus.FINISHED,
      result: GameResult.WHITE_WIN,
      fen: 'post-mate-fen',
      moves: [],
    });

    const result = await service.makeMove({
      gameId: GAME_ID,
      userId: USER_ID,
      from: 'h5',
      to: 'f7',
    });

    expect(result.isGameOver).toBe(true);
    expect(result.result).toBe('WHITE_WIN');
    expect(result.ratingDelta).not.toBeNull();
    expect(result.ratingDelta).toBeGreaterThan(0); // player won → gained ELO
    expect(userRepoMock.updateRating).toHaveBeenCalledTimes(1);
    expect(gameRepoMock.createRatingHistory).toHaveBeenCalledTimes(1);
    // Bot should not have been asked for a move
    expect(mockGetBotMove).not.toHaveBeenCalled();
  });
});

// ── resign ─────────────────────────────────────────────────────────────────────
describe('GameService.resign', () => {
  it('throws 404 when game not found', async () => {
    gameRepoMock.findById.mockResolvedValue(null);
    await expect(service.resign({ gameId: GAME_ID, userId: USER_ID })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws 400 when game is already finished', async () => {
    gameRepoMock.findById.mockResolvedValue(
      makeMockGame({ status: GameStatus.FINISHED }),
    );
    await expect(service.resign({ gameId: GAME_ID, userId: USER_ID })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('white resigning gives BLACK_WIN', async () => {
    gameRepoMock.findById.mockResolvedValue(makeMockGame());
    gameRepoMock.updateFenAndStatus.mockResolvedValue({
      ...makeMockGame(),
      status: GameStatus.FINISHED,
      result: GameResult.BLACK_WIN,
      moves: [],
    });

    const result = await service.resign({ gameId: GAME_ID, userId: USER_ID });

    expect(gameRepoMock.updateFenAndStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        status: GameStatus.FINISHED,
        result: GameResult.BLACK_WIN,
      }),
    );
    expect(result.game.result).toBe(GameResult.BLACK_WIN);
  });

  it('white resigning a bot game applies ELO (loss)', async () => {
    gameRepoMock.findById.mockResolvedValue(makeMockGame());
    gameRepoMock.updateFenAndStatus.mockResolvedValue({
      ...makeMockGame(),
      status: GameStatus.FINISHED,
      result: GameResult.BLACK_WIN,
      moves: [],
    });

    const result = await service.resign({ gameId: GAME_ID, userId: USER_ID });

    expect(userRepoMock.updateRating).toHaveBeenCalledTimes(1);
    expect(result.ratingDelta).not.toBeNull();
    expect(result.ratingDelta).toBeLessThan(0); // resigned → lost ELO
  });

  it('resign on a non-bot game does not change rating', async () => {
    gameRepoMock.findById.mockResolvedValue(
      makeMockGame({ isBotGame: false }),
    );
    gameRepoMock.updateFenAndStatus.mockResolvedValue({
      ...makeMockGame({ isBotGame: false }),
      status: GameStatus.FINISHED,
      result: GameResult.BLACK_WIN,
      moves: [],
    });

    const result = await service.resign({ gameId: GAME_ID, userId: USER_ID });

    expect(userRepoMock.updateRating).not.toHaveBeenCalled();
    expect(result.ratingDelta).toBeNull();
  });
});
