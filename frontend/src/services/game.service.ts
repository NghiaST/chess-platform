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
};
