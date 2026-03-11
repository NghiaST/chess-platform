/**
 * Singleton Socket.IO client.
 *
 * Call connect(token) once (e.g. after login) to authenticate.
 * All pages/hooks share the same socket instance.
 */
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_API_URL as string | undefined)
  // VITE_API_URL is typically "/api" or "https://host/api" — strip the /api suffix
  ?.replace(/\/api\/?$/, '') ?? 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: '/socket.io',
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
  }
  return socket;
}

export function connectSocket(token: string): Socket {
  const s = getSocket();
  s.auth = { token };
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
