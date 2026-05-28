function toUtcDateOnly(value) {
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  }
  const iso = String(value).slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}

function nextUtcDateOnly(value) {
  const d = toUtcDateOnly(value);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function isExpenseInvoice(invoice) {
  return Number(invoice.totalHours) === 0 && Number(invoice.rate) === 0;
}

async function backfillInvoiceItems(prisma) {
  const invoices = await prisma.invoice.findMany({
    select: {
      id: true,
      clientId: true,
      periodStart: true,
      periodEnd: true,
      totalHours: true,
      rate: true,
    },
    orderBy: [{ createdDate: 'asc' }, { id: 'asc' }],
  });

  let linkedCount = 0;

  for (const invoice of invoices) {
    const hasLinks = await prisma.invoiceItem.findFirst({
      where: { invoiceId: invoice.id },
      select: { id: true },
    });
    if (hasLinks) continue;

    if (isExpenseInvoice(invoice)) {
      const expenses = await prisma.expense.findMany({
        where: {
          clientId: invoice.clientId,
          dateTime: {
            gte: toUtcDateOnly(invoice.periodStart),
            lt: nextUtcDateOnly(invoice.periodEnd),
          },
          invoiceItems: { none: {} },
        },
        orderBy: [{ dateTime: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });

      if (expenses.length) {
        await prisma.invoiceItem.createMany({
          data: expenses.map((expense) => ({
            invoiceId: invoice.id,
            expenseId: expense.id,
          })),
        });
        linkedCount += expenses.length;
      }
      continue;
    }

    const timesheets = await prisma.timesheet.findMany({
      where: {
        clientId: invoice.clientId,
        date: {
          gte: toUtcDateOnly(invoice.periodStart),
          lte: toUtcDateOnly(invoice.periodEnd),
        },
        invoiceItems: { none: {} },
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });

    if (timesheets.length) {
      await prisma.invoiceItem.createMany({
        data: timesheets.map((timesheet) => ({
          invoiceId: invoice.id,
          timesheetId: timesheet.id,
        })),
      });
      linkedCount += timesheets.length;
    }
  }

  return { invoicesScanned: invoices.length, linksCreated: linkedCount };
}

module.exports = { backfillInvoiceItems };