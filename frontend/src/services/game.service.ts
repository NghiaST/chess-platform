import api from './api';

export interface CreateGameDto {
  isBotGame: boolean;
  botLevel?: number;
  mode?: 'standard' | 'practice' | 'study';
}

export interface MakeMoveDto {
  from: string;
  to: string;
  promotion?: string;
}

export const gameService = {
  createGame: (data: CreateGameDto) =>
    api.post('/games/create', data).then((r) => r.data.data),

  getGame: (id: string) =>
    api.get(`/games/${id}`).then((r) => r.data.data),

  makeMove: (gameId: string, data: MakeMoveDto) =>
    api.post(`/games/${gameId}/move`, data).then((r) => r.data.data),

  resign: (gameId: string) =>
    api.post(`/games/${gameId}/resign`).then((r) => r.data.data),

  undoMove: (gameId: string) =>
    api.post(`/games/${gameId}/undo`).then((r) => r.data.data),

  getHint: (gameId: string) =>
    api.get(`/games/${gameId}/hint`).then((r) => r.data.data) as Promise<{ uci: string; from: string; to: string; san: string }>,

  analyze: (fen: string, numLines = 3, quick = false) =>
    api.post('/analysis', { fen, numLines, quick }).then((r) => r.data.data) as Promise<{
      lines: { uci: string; san: string; score: number; mate: number | null }[];
      evaluation: number;
      mate: number | null;
    }>,
};
