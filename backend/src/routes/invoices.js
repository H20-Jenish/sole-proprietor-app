const express = require('express');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const { parseDateOnly } = require('../utils/dateOnly');

const router = express.Router();
const prisma = new PrismaClient();

function currentDateOnly() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return parseDateOnly(`${year}-${month}-${day}`);
}

function computeHours(start, end, deductionMinutes = 0) {
  const [sh, sm] = String(start || '00:00').split(':').map(Number);
  const [eh, em] = String(end || '00:00').split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  const netMinutes = Math.max(0, diff - Math.max(0, Number(deductionMinutes) || 0));
  return parseFloat((netMinutes / 60).toFixed(2));
}

router.get('/', authMiddleware, async (req, res) => {
  const { clientId, status, periodStart, periodEnd } = req.query;
  const where = {};
  if (clientId) where.clientId = Number(clientId);
  if (status) where.status = status;
  if (periodStart || periodEnd) {
    where.periodStart = {};
    if (periodStart) where.periodStart.gte = parseDateOnly(periodStart);
    if (periodEnd) where.periodStart.lte = parseDateOnly(periodEnd);
  }
  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: { select: { id: true, name: true, payRateType: true } } },
    orderBy: { createdDate: 'desc' },
  });
  res.json(invoices);
});

router.post('/', authMiddleware, async (req, res) => {
  const { clientId, recruiterId, periodStart, periodEnd } = req.body;
  const client = await prisma.client.findUnique({ where: { id: Number(clientId) } });
  if (!client) return res.status(404).json({ error: 'Client not found' });

  let recruiter = null;
  if (recruiterId) {
    recruiter = await prisma.recruiter.findUnique({ where: { id: Number(recruiterId) } });
    if (!recruiter) return res.status(404).json({ error: 'Recruiter not found' });
  }

  const timesheets = await prisma.timesheet.findMany({
    where: {
      clientId: Number(clientId),
      date: { gte: parseDateOnly(periodStart), lte: parseDateOnly(periodEnd) },
    },
    orderBy: { date: 'asc' },
  });

  const deductionMinutes = client.paysBreak === false ? Number(client.paidBreakMinutes || 0) : 0;
  const adjustedTimesheets = timesheets.map((t) => ({
    ...t,
    totalHours: computeHours(t.startTime, t.endTime, deductionMinutes),
  }));

  const totalHours = adjustedTimesheets.reduce((sum, t) => sum + Number(t.totalHours), 0);
  const rate = Number(client.payRate) || 0;
  let subtotal = 0;
  if (client.payRateType === 'HOURLY') subtotal = totalHours * rate;
  else subtotal = (rate / 52 / 40) * totalHours;

  // Fetch user to check HST setting
  const user = await prisma.user.findFirst();
  const hasHst = !!(user?.hstNumber && String(user.hstNumber).trim());
  const hst13pct = hasHst ? parseFloat((subtotal * 0.13).toFixed(2)) : 0;
  const total = parseFloat((subtotal + hst13pct).toFixed(2));

  const last = await prisma.invoice.findFirst({ orderBy: { invoiceNum: 'desc' } });
  const invoiceNum = (last?.invoiceNum || 0) + 1;

  const invoice = await prisma.invoice.create({
    data: {
      clientId: Number(clientId),
      recruiterId: recruiterId ? Number(recruiterId) : null,
      periodStart: parseDateOnly(periodStart),
      periodEnd: parseDateOnly(periodEnd),
      totalHours,
      rate,
      subtotal,
      hst13pct,
      total,
      invoiceNum,
    },
    include: { client: true },
  });

  // Generate PDF
  const pdfBytes = await generateInvoicePDF(invoice, client, adjustedTimesheets, user || {}, recruiter);
  const pdfDir = path.join('/app/uploads/invoices');
  fs.mkdirSync(pdfDir, { recursive: true });
  const pdfPath = path.join('invoices', `${invoice.id}.pdf`);
  fs.writeFileSync(path.join('/app/uploads', pdfPath), pdfBytes);

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { pdfPath },
    include: { client: { select: { id: true, name: true, payRateType: true } } },
  });

  res.json(updated);
});

router.put('/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body;
  const nextStatus = status === 'PAID' ? 'PAID' : 'PENDING';
  const updated = await prisma.invoice.update({
    where: { id: Number(req.params.id) },
    data: {
      status: nextStatus,
      paidDate: nextStatus === 'PAID' ? currentDateOnly() : null,
    },
    include: { client: { select: { id: true, name: true, payRateType: true } } },
  });
  res.json(updated);
});

router.get('/:id/pdf', authMiddleware, async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: Number(req.params.id) } });
  if (!invoice?.pdfPath) return res.status(404).json({ error: 'PDF not found' });
  const filePath = path.join('/app/uploads', invoice.pdfPath);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });

  const download = req.query.download === '1';
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="invoice-${invoice.invoiceNum}.pdf"`);
  res.sendFile(filePath);
});

router.delete('/:id', authMiddleware, async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: Number(req.params.id) } });
  if (invoice?.pdfPath) {
    const fp = path.join('/app/uploads', invoice.pdfPath);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  await prisma.invoice.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

module.exports = router;