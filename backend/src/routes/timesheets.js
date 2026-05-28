const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const { exportTimesheetsToXLSX } = require('../utils/xlsxGenerator');
const { parseDateOnly, formatDateOnly } = require('../utils/dateOnly');

const router = express.Router();
const prisma = new PrismaClient();

function dateOnly(value) {
  return parseDateOnly(value);
}

async function ensureMileagePlaceholder(clientId, date, existingPurpose = '') {
  const normalizedDate = dateOnly(date);
  return prisma.mileage.upsert({
    where: {
      clientId_date: {
        clientId: Number(clientId),
        date: normalizedDate,
      },
    },
    update: {
      purpose: existingPurpose,
      source: 'timesheet',
    },
    create: {
      clientId: Number(clientId),
      date: normalizedDate,
      purpose: existingPurpose,
      source: 'timesheet',
    },
  });
}

function computeHours(start, end, deductionMinutes = 0) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  const netMinutes = Math.max(0, diff - Math.max(0, Number(deductionMinutes) || 0));
  return parseFloat((netMinutes / 60).toFixed(2));
}

function toYmd(value) {
  if (!value) return '';
  return formatDateOnly(value);
}

router.get('/', authMiddleware, async (req, res) => {
  const { clientId, startDate, endDate } = req.query;
  const where = {};
  if (clientId) where.clientId = Number(clientId);
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = parseDateOnly(startDate);
    if (endDate) where.date.lte = parseDateOnly(endDate);
  }
  const rows = await prisma.timesheet.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, paysBreak: true, paidBreakMinutes: true } },
      invoiceItems: {
        include: { invoice: { select: { id: true, invoiceNum: true, status: true } } },
      },
    },
    orderBy: { date: 'desc' },
  });
  const adjusted = rows.map((r) => {
    const deduction = r.client && r.client.paysBreak === false ? Number(r.client.paidBreakMinutes || 0) : 0;
    // Find short name for this location if available
    let shortLoc = r.location;
    if (Array.isArray(r.client?.siteLocations)) {
      const found = r.client.siteLocations.find(s => s.fullAddress === r.location || s.shortName === r.location);
      if (found && found.shortName) shortLoc = found.shortName;
    }
    return {
      ...r,
      location: shortLoc,
      totalHours: computeHours(r.startTime, r.endTime, deduction),
      invoiceId: r.invoiceItems?.[0]?.invoice?.id || null,
      invoiceNum: r.invoiceItems?.[0]?.invoice?.invoiceNum || null,
      invoiceStatus: r.invoiceItems?.[0]?.invoice?.status || null,
    };
  });
  res.json(adjusted);
});

router.get('/export', authMiddleware, async (req, res) => {
  const { clientId, startDate, endDate } = req.query;
  const where = {};
  if (clientId) where.clientId = Number(clientId);
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = parseDateOnly(startDate);
    if (endDate) where.date.lte = parseDateOnly(endDate);
  }

  const rows = await prisma.timesheet.findMany({
    where,
    include: { client: { select: { id: true, name: true, paysBreak: true, paidBreakMinutes: true } } },
    orderBy: { date: 'asc' },
  });

  // Recalculate totalHours for export to ensure break deduction is reflected
  const adjusted = rows.map((r) => {
    const deduction = r.client && r.client.paysBreak === false ? Number(r.client.paidBreakMinutes || 0) : 0;
    // Find short name for this location if available
    let shortLoc = r.location;
    if (Array.isArray(r.client?.siteLocations)) {
      const found = r.client.siteLocations.find(s => s.fullAddress === r.location || s.shortName === r.location);
      if (found && found.shortName) shortLoc = found.shortName;
    }
    return {
      ...r,
      location: shortLoc,
      totalHours: computeHours(r.startTime, r.endTime, deduction),
    };
  });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const derivedStart = startDate || (adjusted[0]?.date ? toYmd(adjusted[0].date) : '');
  const derivedEnd = endDate || (adjusted.length ? toYmd(adjusted[adjusted.length - 1].date) : '');
  const monthSeed = derivedStart || derivedEnd;
  const monthLabel = monthSeed
    ? new Date(`${monthSeed}T12:00:00.000Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/Toronto' })
    : '';
  const uniqueClientNames = [...new Set(adjusted.map((r) => r?.client?.name).filter(Boolean))];
  const clientName = uniqueClientNames.length === 1
    ? uniqueClientNames[0]
    : (uniqueClientNames.length > 1 ? uniqueClientNames.join(', ') : '');

  await exportTimesheetsToXLSX(adjusted, {
    userName: user?.name || '',
    startDate: derivedStart,
    endDate: derivedEnd,
    monthLabel,
    clientName,
  }, res);
});

router.post('/', authMiddleware, async (req, res) => {
  const { clientId, location, date, startTime, endTime } = req.body;
  const client = await prisma.client.findUnique({
    where: { id: Number(clientId) },
    select: { id: true, paysBreak: true, paidBreakMinutes: true },
  });
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const deductionMinutes = client.paysBreak === false ? Number(client.paidBreakMinutes || 0) : 0;
  const totalHours = computeHours(startTime, endTime, deductionMinutes);
  const normalizedDate = dateOnly(date);
  const row = await prisma.timesheet.create({
    data: {
      clientId: Number(clientId),
      location: location || '',
      date: normalizedDate,
      startTime,
      endTime,
      totalHours,
    },
    include: { client: { select: { id: true, name: true } } },
  });

  const mileageEntry = await ensureMileagePlaceholder(clientId, date);
  res.json({
    ...row,
    mileageReminderNeeded: mileageEntry.startOdometer == null || mileageEntry.endOdometer == null,
  });
});

router.put('/:id', authMiddleware, async (req, res) => {
  const { clientId, location, date, startTime, endTime } = req.body;
  const client = await prisma.client.findUnique({
    where: { id: Number(clientId) },
    select: { id: true, paysBreak: true, paidBreakMinutes: true },
  });
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const deductionMinutes = client.paysBreak === false ? Number(client.paidBreakMinutes || 0) : 0;
  const totalHours = computeHours(startTime, endTime, deductionMinutes);
  const normalizedDate = dateOnly(date);

  const row = await prisma.timesheet.update({
    where: { id: Number(req.params.id) },
    data: {
      clientId: Number(clientId),
      location: location || '',
      date: normalizedDate,
      startTime,
      endTime,
      totalHours,
    },
    include: { client: { select: { id: true, name: true } } },
  });

  const mileageEntry = await ensureMileagePlaceholder(clientId, date);
  res.json({
    ...row,
    mileageReminderNeeded: mileageEntry.startOdometer == null || mileageEntry.endOdometer == null,
  });
});

router.delete('/:id', authMiddleware, async (req, res) => {
  await prisma.timesheet.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

module.exports = router;