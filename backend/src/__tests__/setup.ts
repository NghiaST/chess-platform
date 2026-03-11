// Global env vars needed before any module is imported in tests
process.env.JWT_SECRET = 'test-secret-key-32-chars-minimum!!';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
