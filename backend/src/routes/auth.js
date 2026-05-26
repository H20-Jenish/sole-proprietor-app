const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const COOKIE_OPTS = { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 };

router.get('/setup', async (_req, res) => {
  const usersCount = await prisma.user.count();
  res.json({ hasUsers: usersCount > 0 });
});

router.post('/signup', async (req, res) => {
  const usersCount = await prisma.user.count();
  if (usersCount > 0) return res.status(403).json({ error: 'Signup is only available for first-time setup' });

  const { email, password, name, phone, businessName, hstNumber } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: String(email).trim().toLowerCase(),
      password: hashed,
      name: String(name).trim(),
      phone: String(phone || '').trim() || null,
      businessName: String(businessName || '').trim(),
      hstNumber: String(hstNumber || '').trim(),
    },
  });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, COOKIE_OPTS);
  res.json({ user: { id: user.id, email: user.email, name: user.name, phone: user.phone, hstNumber: user.hstNumber, businessName: user.businessName } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, COOKIE_OPTS);
  res.json({ user: { id: user.id, email: user.email, name: user.name, phone: user.phone, hstNumber: user.hstNumber, businessName: user.businessName } });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
  res.json({ ok: true });
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email, name: user.name, phone: user.phone, hstNumber: user.hstNumber, businessName: user.businessName });
});

module.exports = router;