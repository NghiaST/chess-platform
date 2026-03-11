import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chess Platform API',
      version: '1.0.0',
      description: 'REST API for Chess Platform — authentication, game management, leaderboard',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production'
          ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME ?? 'your-backend.onrender.com'}`
          : 'http://localhost:4000',
        description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            rating: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Game: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            fen: { type: 'string' },
            status: { type: 'string', enum: ['WAITING', 'ACTIVE', 'FINISHED', 'ABANDONED'] },
            result: { type: 'string', enum: ['WHITE_WIN', 'BLACK_WIN', 'DRAW'], nullable: true },
            isBotGame: { type: 'boolean' },
            botLevel: { type: 'integer', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            message: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
