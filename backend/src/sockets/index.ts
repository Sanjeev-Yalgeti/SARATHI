import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { Server, type Socket } from 'socket.io';
import type { AuthUser } from '../middleware/auth.js';
import { trucks, type Truck } from '../services/trucks.js';

let io: Server | null = null;

function getSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

function verifyToken(raw: unknown): AuthUser | null {
  if (typeof raw !== 'string' || raw === '') return null;
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
  try {
    const payload = jwt.verify(token, getSecret()) as AuthUser;
    if (payload.role !== 'ADMIN' && payload.role !== 'DRIVER') return null;
    return { id: payload.id, role: payload.role, name: payload.name ?? null };
  } catch {
    return null;
  }
}

function snapshotFor(user: AuthUser): Truck[] {
  if (user.role === 'ADMIN') return [...trucks.values()];
  const truck = trucks.get(user.id);
  return truck ? [truck] : [];
}

/** Attach Socket.io to the HTTP server. Idempotent. REST polling keeps working. */
export function initSockets(httpServer: HttpServer): Server {
  if (io) return io;
  const corsOrigin = process.env['CORS_ORIGIN'];
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
    },
  });

  io.use((socket: Socket, next) => {
    const token =
      (socket.handshake.auth as Record<string, unknown> | undefined)?.['token'] ??
      socket.handshake.headers.authorization;
    const user = verifyToken(token);
    if (!user) {
      next(new Error('Unauthorized'));
      return;
    }
    socket.data.user = user as AuthUser;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as AuthUser;
    if (user.role === 'ADMIN') {
      void socket.join('admin');
    } else {
      void socket.join(`driver:${user.id}`);
    }
    // BACKEND_TASKS §3.4 compat: client asks, server sends current positions.
    socket.on('client:subscribe', () => {
      socket.emit('vehicle:update', snapshotFor(user));
    });
    // Push current board immediately so the map paints without waiting a tick.
    socket.emit('vehicle:update', snapshotFor(user));
  });

  return io;
}

export function getIo(): Server | null {
  return io;
}

function emitToTruckRooms(vehicleId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to('admin').emit(event, payload);
  io.to(`driver:${vehicleId}`).emit(event, payload);
}

/** Per-tick position push. Admin gets it via 'admin' room, driver via own room. */
export function emitVehicleUpdate(truck: Truck): void {
  emitToTruckRooms(truck.vehicleId, 'vehicle:update', { ...truck });
}

export function emitBlockageAlert(detail: {
  vehicleId: string;
  lat: number;
  lng: number;
  reason: string;
  incidentId?: string;
  district?: string;
  band?: string | null;
  scenarioDate: string;
}): void {
  emitToTruckRooms(detail.vehicleId, 'alert:blockage', detail);
}

export function emitRiskAlert(detail: {
  vehicleId: string;
  district: string;
  band: string;
  confidence: number | null;
  source: string;
  scenarioDate: string;
}): void {
  emitToTruckRooms(detail.vehicleId, 'alert:risk', detail);
}
