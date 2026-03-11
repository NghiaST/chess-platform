/**
 * Integration tests for game routes.
 *
 * Mocks GameService so no DB / Stockfish process is required.
 * A real JWT is signed with the test secret to exercise the authenticate
 * middleware without issuing any real tokens.
 */

jest.mock('../config/database', () => ({ __esModule: true, default: {} }));
jest.mock('../services/game.service');

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { GameService } from '../services/game.service';

const MockGameService = GameService as jest.MockedClass<typeof GameService>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_USER = { id: 'user-uuid-1', email: 'player@test.com', username: 'player1' };
const GAME_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

function makeToken(user = TEST_USER): string {
  return jwt.sign(user, process.env.JWT_SECRET as string, { expiresIn: '1h' });
}

const baseGame = {
  id: GAME_ID,
  whitePlayerId: TEST_USER.id,
  blackPlayerId: null,
  isBotGame: true,
  botLevel: 5,
  status: 'IN_PROGRESS',
  currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  winner: null,
  moves: [],
  ratingDelta: null,
};

let gameSvcMock: jest.Mocked<GameService>;

beforeAll(() => {
  gameSvcMock = MockGameService.mock.instances[0] as jest.Mocked<GameService>;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── POST /api/games/create ─────────────────────────────────────────────────────
describe('POST /api/games/create', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/games/create').send({ isBotGame: true });
    expect(res.status).toBe(401);
  });

  it('returns 201 and the new game', async () => {
    gameSvcMock.createGame.mockResolvedValue(baseGame as any);

    const res = await request(app)
      .post('/api/games/create')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ isBotGame: true, botLevel: 5 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.id).toBe(GAME_ID);
    expect(gameSvcMock.createGame).toHaveBeenCalledWith({
      userId: TEST_USER.id,
      isBotGame: true,
      botLevel: 5,
    });
  });

  it('forwards optional mode when provided', async () => {
    gameSvcMock.createGame.mockResolvedValue(baseGame as any);

    const res = await request(app)
      .post('/api/games/create')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ isBotGame: true, botLevel: 5, mode: 'practice' });

    expect(res.status).toBe(201);
    expect(gameSvcMock.createGame).toHaveBeenCalledWith({
      userId: TEST_USER.id,
      isBotGame: true,
      botLevel: 5,
      mode: 'practice',
    });
  });

  it('returns 400 when isBotGame is missing', async () => {
    const res = await request(app)
      .post('/api/games/create')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ botLevel: 3 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when botLevel is out of range', async () => {
    const res = await request(app)
      .post('/api/games/create')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ isBotGame: true, botLevel: 99 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when mode is invalid', async () => {
    const res = await request(app)
      .post('/api/games/create')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ isBotGame: true, botLevel: 5, mode: 'arcade' });

    expect(res.status).toBe(400);
  });
});

// ── GET /api/games/:id ─────────────────────────────────────────────────────────
describe('GET /api/games/:id', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/api/games/${GAME_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 400 for a non-UUID id', async () => {
    const res = await request(app)
      .get('/api/games/not-a-uuid')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(400);
  });

  it('returns 200 and the game', async () => {
    gameSvcMock.getGameById.mockResolvedValue(baseGame as any);

    const res = await request(app)
      .get(`/api/games/${GAME_ID}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(GAME_ID);
  });

  it('returns 404 when game does not exist', async () => {
    const { AppError } = await import('../middlewares/errorHandler');
    gameSvcMock.getGameById.mockRejectedValue(new AppError('Game not found.', 404));

    const res = await request(app)
      .get(`/api/games/${GAME_ID}`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
  });
});

// ── POST /api/games/:id/move ───────────────────────────────────────────────────
describe('POST /api/games/:id/move', () => {
  const moveResult = {
    ...baseGame,
    moves: [{ from: 'e2', to: 'e4', san: 'e4', fen: 'some-fen' }],
    botMove: { from: 'e7', to: 'e5', san: 'e5', fen: 'some-fen-2' },
    ratingDelta: null,
  };

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post(`/api/games/${GAME_ID}/move`)
      .send({ from: 'e2', to: 'e4' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when from or to is missing', async () => {
    const res = await request(app)
      .post(`/api/games/${GAME_ID}/move`)
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ from: 'e2' }); // missing to

    expect(res.status).toBe(400);
  });

  it('returns 200 on a valid move', async () => {
    gameSvcMock.makeMove.mockResolvedValue(moveResult as any);

    const res = await request(app)
      .post(`/api/games/${GAME_ID}/move`)
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ from: 'e2', to: 'e4' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(gameSvcMock.makeMove).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'e2', to: 'e4', gameId: GAME_ID })
    );
  });

  it('returns 400 on an illegal chess move', async () => {
    const { AppError } = await import('../middlewares/errorHandler');
    gameSvcMock.makeMove.mockRejectedValue(new AppError('Illegal move.', 400));

    const res = await request(app)
      .post(`/api/games/${GAME_ID}/move`)
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ from: 'e2', to: 'e5' });

    expect(res.status).toBe(400);
  });
});

// ── POST /api/games/:id/resign ─────────────────────────────────────────────────
describe('POST /api/games/:id/resign', () => {
  const resignedGame = { ...baseGame, status: 'BLACK_WIN', winner: 'BLACK' };

  it('returns 401 without a token', async () => {
    const res = await request(app).post(`/api/games/${GAME_ID}/resign`);
    expect(res.status).toBe(401);
  });

  it('returns 200 and the finished game', async () => {
    gameSvcMock.resign.mockResolvedValue(resignedGame as any);

    const res = await request(app)
      .post(`/api/games/${GAME_ID}/resign`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('BLACK_WIN');
  });

  it('returns 404 when game does not exist', async () => {
    const { AppError } = await import('../middlewares/errorHandler');
    gameSvcMock.resign.mockRejectedValue(new AppError('Game not found.', 404));

    const res = await request(app)
      .post(`/api/games/${GAME_ID}/resign`)
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
  });
});
