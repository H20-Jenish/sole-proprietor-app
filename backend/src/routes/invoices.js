const express = require('express');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const { parseDateOnly, formatDateOnly } = require('../utils/dateOnly');

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
  const { clientId, recruiterId, periodStart, periodEnd, source, expenseIds } = req.body;
  const client = await prisma.client.findUnique({ where: { id: Number(clientId) } });
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const invoiceSource = String(source || 'TIMESHEET').toUpperCase() === 'EXPENSE' ? 'EXPENSE' : 'TIMESHEET';

  let recruiter = null;
  if (recruiterId) {
    recruiter = await prisma.recruiter.findUnique({ where: { id: Number(recruiterId) } });
    if (!recruiter) return res.status(404).json({ error: 'Recruiter not found' });
  }

  let adjustedTimesheets = [];
  let selectedExpenses = [];
  let normalizedPeriodStart = periodStart;
  let normalizedPeriodEnd = periodEnd;
  let totalHours = 0;
  let rate = 0;
  let subtotal = 0;
  let hst13pct = 0;
  let total = 0;

  if (invoiceSource === 'EXPENSE') {
    const ids = Array.isArray(expenseIds)
      ? expenseIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [];
    if (!ids.length) {
      return res.status(400).json({ error: 'Select at least one expense to generate an expense invoice' });
    }

    selectedExpenses = await prisma.expense.findMany({
      where: {
        id: { in: ids },
        clientId: Number(clientId),
      },
      orderBy: { dateTime: 'asc' },
    });

    if (selectedExpenses.length !== ids.length) {
      return res.status(400).json({ error: 'Some selected expenses are invalid for this client' });
    }

    const existingExpenseLinks = await prisma.invoiceItem.findMany({
      where: { expenseId: { in: ids } },
      include: { invoice: { select: { invoiceNum: true, status: true } } },
    });
    if (existingExpenseLinks.length) {
      const first = existingExpenseLinks[0]?.invoice;
      const invoiceLabel = first ? `#${first.invoiceNum} (${first.status})` : 'an existing invoice';
      return res.status(409).json({ error: `One or more selected expenses are already invoiced in ${invoiceLabel}.` });
    }

    const firstExpenseDate = formatDateOnly(selectedExpenses[0].dateTime);
    const lastExpenseDate = formatDateOnly(selectedExpenses[selectedExpenses.length - 1].dateTime);
    normalizedPeriodStart = normalizedPeriodStart || firstExpenseDate;
    normalizedPeriodEnd = normalizedPeriodEnd || lastExpenseDate;

    // Expense amounts are treated as tax-inclusive reimbursements; no extra tax added on invoice.
    subtotal = parseFloat(selectedExpenses.reduce((sum, x) => sum + Number(x.amount || 0), 0).toFixed(2));
    hst13pct = 0;
    total = subtotal;
    totalHours = 0;
    rate = 0;
  } else {
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ error: 'Period start and end are required' });
    }

    const timesheets = await prisma.timesheet.findMany({
      where: {
        clientId: Number(clientId),
        date: { gte: parseDateOnly(periodStart), lte: parseDateOnly(periodEnd) },
      },
      orderBy: { date: 'asc' },
    });

    const timesheetIds = timesheets.map((t) => t.id);
    if (timesheetIds.length) {
      const existingTimesheetLinks = await prisma.invoiceItem.findMany({
        where: { timesheetId: { in: timesheetIds } },
        include: { invoice: { select: { invoiceNum: true, status: true } } },
      });
      if (existingTimesheetLinks.length) {
        const first = existingTimesheetLinks[0]?.invoice;
        const invoiceLabel = first ? `#${first.invoiceNum} (${first.status})` : 'an existing invoice';
        return res.status(409).json({ error: `One or more timesheets in this range are already invoiced in ${invoiceLabel}.` });
      }
    }

    const deductionMinutes = client.paysBreak === false ? Number(client.paidBreakMinutes || 0) : 0;
    adjustedTimesheets = timesheets.map((t) => ({
      ...t,
      totalHours: computeHours(t.startTime, t.endTime, deductionMinutes),
    }));

    totalHours = adjustedTimesheets.reduce((sum, t) => sum + Number(t.totalHours), 0);
    rate = Number(client.payRate) || 0;
    if (client.payRateType === 'HOURLY') subtotal = totalHours * rate;
    else subtotal = (rate / 52 / 40) * totalHours;

    // Fetch user to check HST setting.
    const user = await prisma.user.findFirst();
    const hasHst = !!(user?.hstNumber && String(user.hstNumber).trim());
    hst13pct = hasHst ? parseFloat((subtotal * 0.13).toFixed(2)) : 0;
    subtotal = parseFloat(subtotal.toFixed(2));
    total = parseFloat((subtotal + hst13pct).toFixed(2));
  }

  const last = await prisma.invoice.findFirst({ orderBy: { invoiceNum: 'desc' } });
  const invoiceNum = (last?.invoiceNum || 0) + 1;

  let invoice;
  try {
    invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          clientId: Number(clientId),
          recruiterId: recruiterId ? Number(recruiterId) : null,
          periodStart: parseDateOnly(normalizedPeriodStart),
          periodEnd: parseDateOnly(normalizedPeriodEnd),
          totalHours,
          rate,
          subtotal,
          hst13pct,
          total,
          invoiceNum,
        },
        include: { client: true },
      });

      if (invoiceSource === 'EXPENSE' && selectedExpenses.length) {
        await tx.invoiceItem.createMany({
          data: selectedExpenses.map((expense) => ({
            invoiceId: created.id,
            expenseId: expense.id,
          })),
        });
      }

      if (invoiceSource === 'TIMESHEET' && adjustedTimesheets.length) {
        await tx.invoiceItem.createMany({
          data: adjustedTimesheets.map((timesheet) => ({
            invoiceId: created.id,
            timesheetId: timesheet.id,
          })),
        });
      }

      return created;
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'Some selected entries are already attached to an invoice.' });
    }
    throw err;
  }

  // Generate PDF
  const user = await prisma.user.findFirst();
  const pdfBytes = await generateInvoicePDF(
    invoice,
    client,
    adjustedTimesheets,
    user || {},
    recruiter,
    {
      invoiceSource,
      expenses: selectedExpenses,
    }
  );
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