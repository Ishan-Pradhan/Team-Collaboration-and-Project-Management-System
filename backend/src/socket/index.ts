import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/users.repository.js';
import { OrganizationMember, ChannelMember } from '../models/index.js';
import type { JwtPayload } from '../types/auth.types.js';

let io: SocketIOServer | null = null;

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
}

function readCookie(rawCookieHeader: string, name: string): string | undefined {
  const match = rawCookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

export const initSocket = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
      const token = rawCookie ? readCookie(rawCookie, 'accessToken') : undefined;
      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as JwtPayload;
      const user = await userRepository.findById(decoded.id);
      if (!user) {
        return next(new Error('Unauthorized'));
      }

      socket.userId = user.id;
      socket.userName = user.name;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const userId = socket.userId as string;
    socket.join(`user:${userId}`);

    const [orgMemberships, channelMemberships] = await Promise.all([
      OrganizationMember.findAll({ where: { userId }, attributes: ['organizationId'] }),
      ChannelMember.findAll({ where: { userId }, attributes: ['channelId'] }),
    ]);

    orgMemberships.forEach((m) => socket.join(`org:${m.organizationId}`));
    channelMemberships.forEach((m) => socket.join(`channel:${m.channelId}`));

    socket.on('typing:start', ({ channelId }: { channelId?: string }) => {
      if (!channelId || !socket.rooms.has(`channel:${channelId}`)) return;
      socket.to(`channel:${channelId}`).emit('typing:update', {
        channelId,
        userId: socket.userId,
        userName: socket.userName,
      });
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initSocket first.');
  }
  return io;
};
