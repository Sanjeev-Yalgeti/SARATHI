import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

function getSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

// POST /api/auth/login { userId, password } -> { token, user }
router.post('/login', async (req: Request, res: Response) => {
  const { userId, password } = req.body as Record<string, unknown>;
  if (typeof userId !== 'string' || userId === '' || typeof password !== 'string' || password === '') {
    res.status(400).json({ error: 'userId and password are required' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  // Same 401 message either way — don't leak which userIds exist.
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name ?? null },
    getSecret(),
    { expiresIn: process.env['JWT_EXPIRES_IN'] ?? '8h' } as jwt.SignOptions,
  );
  res.json({ token, user: { id: user.id, role: user.role, name: user.name } });
});

// GET /api/auth/me -> current profile from JWT (for page refresh hydration)
router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

export default router;
