import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string; // userId / vehicleId (e.g. "admin", "AS-01-FOOD-04")
  role: 'ADMIN' | 'DRIVER';
  name: string | null;
}

// Augment Express Request so routes can use req.user
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

function getSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

// 401 if missing/invalid/expired token. Attaches req.user on success.
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), getSecret()) as AuthUser;
    if (payload.role !== 'ADMIN' && payload.role !== 'DRIVER') {
      res.status(401).json({ error: 'Invalid token role' });
      return;
    }
    req.user = { id: payload.id, role: payload.role, name: payload.name ?? null };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Optional auth: attaches req.user if valid token provided, but doesn't block if absent
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), getSecret()) as AuthUser;
    if (payload.role === 'ADMIN' || payload.role === 'DRIVER') {
      req.user = { id: payload.id, role: payload.role, name: payload.name ?? null };
    }
  } catch {
    // Ignore invalid token for optional endpoints
  }
  next();
}

// 403 if authenticated but not ADMIN. Must be used AFTER authenticate.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  next();
}
