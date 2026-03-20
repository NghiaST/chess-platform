/**
 * Integration tests for auth routes.
 *
 * These tests exercise the full Express middleware stack
 * (rate-limiter, validation, error-handler) but mock the AuthService
 * so no real DB is needed.
 */

import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

jest.mock('../config/database', () => ({ __esModule: true, default: {} }));
jest.mock('../services/auth.service');
// Bypass rate limiting in tests so repeated calls don't produce 429
jest.mock('../middlewares/rateLimiter', () => ({
  rateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  authRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  analysisRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import request from 'supertest';
import app from '../app';
import { AuthService } from '../services/auth.service';

const MockAuthService = AuthService as jest.MockedClass<typeof AuthService>;

const validUser = {
  token: 'fake-jwt-token',
  user: {
    id: 'user-uuid-1',
    username: 'player1',
    email: 'player1@example.com',
    rating: 1200,
    createdAt: new Date(),
  },
};

let authServiceMock: jest.Mocked<AuthService>;

beforeAll(() => {
  authServiceMock = MockAuthService.mock.instances[0] as jest.Mocked<AuthService>;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── POST /api/auth/register ────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('returns 201 with token on valid registration', async () => {
    authServiceMock.register.mockResolvedValue(validUser);

    const res = await request(app).post('/api/auth/register').send({
      username: 'player1',
      email: 'player1@example.com',
      password: 'secret123',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.username).toBe('player1');
  });

  it('returns 400 when username is missing', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'player1@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'player1',
      email: 'player1@example.com',
      password: 'abc', // < 8 chars
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is invalid', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'player1',
      email: 'not-an-email',
      password: 'secret123',
    });
    expect(res.status).toBe(400);
  });

  it('returns 409 when email already in use', async () => {
    const { AppError } = await import('../middlewares/errorHandler');
    authServiceMock.register.mockRejectedValue(new AppError('Email already in use.', 409));

    const res = await request(app).post('/api/auth/register').send({
      username: 'player2',
      email: 'player1@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(409);
  });
});

// ── POST /api/auth/login ───────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('returns 200 with token when logging in with email', async () => {
    authServiceMock.login.mockResolvedValue(validUser);

    const res = await request(app).post('/api/auth/login').send({
      identifier: 'player1@example.com',
      password: 'secret123',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.username).toBe('player1');
  });

  it('returns 200 with token when logging in with username', async () => {
    authServiceMock.login.mockResolvedValue(validUser);

    const res = await request(app).post('/api/auth/login').send({
      identifier: 'player1',
      password: 'secret123',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('returns 400 when identifier is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({
      password: 'secret123',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Email or username is required');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({
      identifier: 'player1',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Password is required');
  });

  it('returns 401 when credentials are wrong', async () => {
    const { AppError } = await import('../middlewares/errorHandler');
    authServiceMock.login.mockRejectedValue(new AppError('Invalid credentials.', 401));

    const res = await request(app).post('/api/auth/login').send({
      identifier: 'player1@example.com',
      password: 'wrongpass',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials.');
  });

  it('returns 401 when user does not exist', async () => {
    const { AppError } = await import('../middlewares/errorHandler');
    authServiceMock.login.mockRejectedValue(new AppError('Invalid credentials.', 401));

    const res = await request(app).post('/api/auth/login').send({
      identifier: 'ghost',
      password: 'secret123',
    });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/users/me ──────────────────────────────────────────────────────────
describe('GET /api/users/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer this.is.not.valid');
    expect(res.status).toBe(401);
  });
});
