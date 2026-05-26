const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const { exportExpensesToXLSX } = require('../utils/xlsxGenerator');

const router = express.Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join('/app/uploads/clients', String(req.body.clientId || '0'));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'receipt-' + unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', authMiddleware, async (req, res) => {
  const { clientId, startDate, endDate } = req.query;
  const where = {};
  if (clientId) where.clientId = Number(clientId);
  if (startDate || endDate) {
    where.dateTime = {};
    if (startDate) where.dateTime.gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate) {
      const end = new Date(`${endDate}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      where.dateTime.lt = end;
    }
  }
  const expenses = await prisma.expense.findMany({
    where,
    include: { client: { select: { id: true, name: true } } },
    orderBy: { dateTime: 'desc' },
  });
  res.json(expenses);
});

router.post('/', authMiddleware, upload.single('receipt'), async (req, res) => {
  const { clientId, date, dateTime, amount, desc } = req.body;
  const dateValue = date || (dateTime ? String(dateTime).slice(0, 10) : null);
  if (!dateValue) return res.status(400).json({ error: 'Date is required' });

  const data = {
    clientId: Number(clientId),
    // Normalize to date-only storage (midnight UTC) so expense timing is not tracked.
    dateTime: new Date(`${dateValue}T00:00:00.000Z`),
    amount: Number(amount),
    desc: desc || '',
    receiptImagePath: req.file ? path.join('clients', String(clientId), req.file.filename) : null,
  };
  const expense = await prisma.expense.create({ data, include: { client: { select: { id: true, name: true } } } });
  res.json(expense);
});

router.put('/:id', authMiddleware, upload.single('receipt'), async (req, res) => {
  const { clientId, date, amount, desc } = req.body;
  if (!date) return res.status(400).json({ error: 'Date is required' });

  const existing = await prisma.expense.findUnique({ where: { id: Number(req.params.id) } });
  if (!existing) return res.status(404).json({ error: 'Expense not found' });

  let receiptImagePath = existing.receiptImagePath;
  if (req.file) {
    if (existing.receiptImagePath) {
      const oldFp = path.join('/app/uploads', existing.receiptImagePath);
      if (fs.existsSync(oldFp)) fs.unlinkSync(oldFp);
    }
    receiptImagePath = path.join('clients', String(clientId), req.file.filename);
  }

  const updated = await prisma.expense.update({
    where: { id: Number(req.params.id) },
    data: {
      clientId: Number(clientId),
      dateTime: new Date(`${date}T00:00:00.000Z`),
      amount: Number(amount),
      desc: desc || '',
      receiptImagePath,
    },
    include: { client: { select: { id: true, name: true } } },
  });

  res.json(updated);
});

router.delete('/:id', authMiddleware, async (req, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: Number(req.params.id) } });
  if (expense?.receiptImagePath) {
    const fp = path.join('/app/uploads', expense.receiptImagePath);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  await prisma.expense.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

router.get('/export', authMiddleware, async (req, res) => {
  const { clientId, startDate, endDate } = req.query;
  const where = {};
  if (clientId) where.clientId = Number(clientId);
  if (startDate || endDate) {
    where.dateTime = {};
    if (startDate) where.dateTime.gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate) {
      const end = new Date(`${endDate}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      where.dateTime.lt = end;
    }
  }
  const expenses = await prisma.expense.findMany({
    where,
    include: { client: { select: { name: true } } },
    orderBy: { dateTime: 'desc' },
  });
  await exportExpensesToXLSX(expenses, res);
});

module.exports = router;