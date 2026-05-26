const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const { parseDateOnly } = require('../utils/dateOnly');
const { exportMileageToXLSX } = require('../utils/xlsxGenerator');

const router = express.Router();
const prisma = new PrismaClient();

function toDateOnly(value) {
  return parseDateOnly(value);
}

router.get('/export/xlsx', authMiddleware, async (req, res) => {
  const { date, clientId } = req.query;
  const where = {};
  if (date) where.date = toDateOnly(date);
  if (clientId) where.clientId = Number(clientId);

  const logs = await prisma.mileage.findMany({
    where,
    orderBy: { date: 'asc' },
    include: { client: { select: { id: true, name: true } } },
  });
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  await exportMileageToXLSX(logs, { userName: user?.name || '' }, res);
});

// Get all mileage logs for user (optionally filter by date/client)
router.get('/', authMiddleware, async (req, res) => {
  const { date, clientId } = req.query;
  const where = {};
  if (date) where.date = toDateOnly(date);
  if (clientId) where.clientId = Number(clientId);
  const logs = await prisma.mileage.findMany({ where, orderBy: { date: 'desc' }, include: { client: { select: { id: true, name: true } } } });
  res.json(logs);
});

// Add or update a mileage log
router.post('/', authMiddleware, async (req, res) => {
  const { date, clientId, startOdometer, endOdometer, purpose } = req.body;
  if (!date || !clientId) return res.status(400).json({ error: 'Date and clientId required' });
  const parsedStart = startOdometer === '' || startOdometer == null ? null : Number(startOdometer);
  const parsedEnd = endOdometer === '' || endOdometer == null ? null : Number(endOdometer);
  if ((parsedStart != null && Number.isNaN(parsedStart)) || (parsedEnd != null && Number.isNaN(parsedEnd))) {
    return res.status(400).json({ error: 'Odometer values must be numbers' });
  }
  if (parsedStart != null && parsedEnd != null && parsedEnd < parsedStart) {
    return res.status(400).json({ error: 'End odometer must be greater than or equal to start odometer' });
  }

  const data = {
    date: toDateOnly(date),
    clientId: Number(clientId),
    startOdometer: parsedStart,
    endOdometer: parsedEnd,
    mileage: parsedStart != null && parsedEnd != null ? parsedEnd - parsedStart : null,
    purpose: String(purpose || '').trim(),
    source: 'manual',
  };

  const result = await prisma.mileage.upsert({
    where: {
      clientId_date: {
        clientId: Number(clientId),
        date: toDateOnly(date),
      },
    },
    update: data,
    create: data,
    include: { client: { select: { id: true, name: true } } },
  });
  res.json(result);
});

router.delete('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Valid mileage id is required' });
  }

  const existing = await prisma.mileage.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Mileage entry not found' });

  await prisma.mileage.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
