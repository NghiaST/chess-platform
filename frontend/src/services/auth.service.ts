import api from './api';

export interface RegisterDto {
  username: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export const authService = {
  register: (data: RegisterDto) =>
    api.post('/auth/register', data).then((r) => r.data.data),

  login: (data: LoginDto) =>
    api.post('/auth/login', data).then((r) => r.data.data),
};
