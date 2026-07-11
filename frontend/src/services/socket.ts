import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (!socket) {
    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';
    socket = io(url, { autoConnect: true, reconnectionDelay: 2000 });
    socket.on('connect', () => console.log('[socket] conectado'));
    socket.on('disconnect', () => console.log('[socket] desconectado'));
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
