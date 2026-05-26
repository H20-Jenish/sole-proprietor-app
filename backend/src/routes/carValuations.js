const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const { parseDateOnly } = require('../utils/dateOnly');

const router = express.Router();
const prisma = new PrismaClient();

function parseMonthToDate(value) {
  const monthValue = String(value || '').trim();
  if (!/^\d{4}-\d{2}$/.test(monthValue)) return null;
  return parseDateOnly(`${monthValue}-01`);
}

router.get('/', authMiddleware, async (_req, res) => {
  const rows = await prisma.carValuation.findMany({
    orderBy: { valuationMonth: 'desc' },
    include: { client: { select: { id: true, name: true } } },
  });
  res.json(rows);
});

router.post('/', authMiddleware, async (req, res) => {
  const { carModel, modelYear, clientId, valuationMonth, totalValuation } = req.body;
  const model = String(carModel || '').trim();
  const year = Number(modelYear);
  const client = Number(clientId);
  const monthDate = parseMonthToDate(valuationMonth);
  const valuation = Number(totalValuation);

  if (!model || !Number.isInteger(year) || year < 1900 || year > 2100 || !Number.isInteger(client) || client <= 0 || !monthDate || Number.isNaN(valuation) || valuation < 0) {
    return res.status(400).json({ error: 'Valid car model, model year, client, month, and valuation are required' });
  }

  const created = await prisma.carValuation.create({
    data: {
      carModel: model,
      modelYear: year,
      clientId: client,
      valuationMonth: monthDate,
      totalValuation: valuation,
    },
    include: { client: { select: { id: true, name: true } } },
  });

  res.json(created);
});

router.put('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const { carModel, modelYear, clientId, valuationMonth, totalValuation } = req.body;
  const model = String(carModel || '').trim();
  const year = Number(modelYear);
  const client = Number(clientId);
  const monthDate = parseMonthToDate(valuationMonth);
  const valuation = Number(totalValuation);

  if (!Number.isInteger(id) || id <= 0 || !model || !Number.isInteger(year) || year < 1900 || year > 2100 || !Number.isInteger(client) || client <= 0 || !monthDate || Number.isNaN(valuation) || valuation < 0) {
    return res.status(400).json({ error: 'Valid car model, model year, client, month, and valuation are required' });
  }

  const existing = await prisma.carValuation.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Car valuation not found' });

  const updated = await prisma.carValuation.update({
    where: { id },
    data: {
      carModel: model,
      modelYear: year,
      clientId: client,
      valuationMonth: monthDate,
      totalValuation: valuation,
    },
    include: { client: { select: { id: true, name: true } } },
  });

  res.json(updated);
});

router.delete('/:id', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Valid valuation id is required' });
  }

  const existing = await prisma.carValuation.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Car valuation not found' });

  await prisma.carValuation.delete({ where: { id } });
  res.json({ ok: true });
});

module.exports = router;
