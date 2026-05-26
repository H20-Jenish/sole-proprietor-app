const ExcelJS = require('exceljs');
const { formatDateOnly, formatDayOfWeek } = require('./dateOnly');

async function exportExpensesToXLSX(expenses, res) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Expenses');

  ws.columns = [
    { header: 'Date', key: 'date', width: 16 },
    { header: 'Client', key: 'client', width: 22 },
    { header: 'Description', key: 'desc', width: 35 },
    { header: 'Amount', key: 'amount', width: 12 },
  ];

  expenses.forEach((e) => {
    ws.addRow({
      date: e.dateTime ? formatDateOnly(e.dateTime) : '',
      client: e.client?.name || '',
      desc: e.desc,
      amount: Number(e.amount).toFixed(2),
    });
  });

  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } };
  ws.getRow(1).alignment = { horizontal: 'center' };

  ws.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: 'middle' };
    }
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="expenses.xlsx"');
  await workbook.xlsx.write(res);
}

async function exportTimesheetsToXLSX(timesheets, meta, res) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Timesheets');
  const periodText = meta.startDate && meta.endDate
    ? `${meta.startDate} to ${meta.endDate}`
    : (meta.startDate || meta.endDate || '');

  ws.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Day', key: 'day', width: 12 },
    { header: 'Location', key: 'location', width: 24 },
    { header: 'Start', key: 'start', width: 10 },
    { header: 'End', key: 'end', width: 10 },
    { header: 'Hours', key: 'hours', width: 12 },
  ];

  ws.spliceRows(1, 0,
    ['Employee Name', meta.userName || ''],
    ['Period', periodText],
    ['Month', meta.monthLabel || ''],
    ['Client', meta.clientName || ''],
    []
  );

  timesheets.forEach((t) => {
    ws.addRow({
      date: t.date ? formatDateOnly(t.date) : '',
      day: t.date ? formatDayOfWeek(t.date) : '',
      location: t.location || '',
      start: t.startTime || '',
      end: t.endTime || '',
      hours: t.totalHours,
    });
  });

  const headerRow = ws.getRow(6);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } };
  headerRow.alignment = { horizontal: 'center' };

  ws.getCell('A1').font = { bold: true };
  ws.getCell('A2').font = { bold: true };
  ws.getCell('A3').font = { bold: true };
  ws.getCell('A4').font = { bold: true };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF1FF' } };
  ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF1FF' } };
  ws.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF1FF' } };
  ws.getCell('A4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF1FF' } };

  ws.eachRow((row, rowNumber) => {
    if (rowNumber >= 7) {
      row.alignment = { vertical: 'middle' };
    }
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="timesheets.xlsx"');
  await workbook.xlsx.write(res);
}

async function exportMileageToXLSX(entries, meta, res) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Mileage');

  ws.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Day', key: 'day', width: 12 },
    { header: 'Client', key: 'client', width: 28 },
    { header: 'Purpose', key: 'purpose', width: 36 },
    { header: 'Start Odometer', key: 'start', width: 16 },
    { header: 'End Odometer', key: 'end', width: 16 },
    { header: 'Mileage', key: 'mileage', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
  ];

  ws.spliceRows(1, 0,
    ['Employee Name', meta.userName || ''],
    ['Generated On', formatDateOnly(new Date())],
    []
  );

  entries.forEach((entry) => {
    const isComplete = entry.startOdometer != null && entry.endOdometer != null;
    ws.addRow({
      date: entry.date ? formatDateOnly(entry.date) : '',
      day: entry.date ? formatDayOfWeek(entry.date) : '',
      client: entry.client?.name || '',
      purpose: entry.purpose || 'Work commute',
      start: entry.startOdometer == null ? '' : Number(entry.startOdometer).toFixed(2),
      end: entry.endOdometer == null ? '' : Number(entry.endOdometer).toFixed(2),
      mileage: entry.mileage == null ? '' : Number(entry.mileage).toFixed(2),
      status: isComplete ? 'Complete' : 'Needs update',
    });
  });

  const headerRow = ws.getRow(4);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } };
  headerRow.alignment = { horizontal: 'center' };

  ws.getCell('A1').font = { bold: true };
  ws.getCell('A2').font = { bold: true };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF1FF' } };
  ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF1FF' } };

  ws.eachRow((row, rowNumber) => {
    if (rowNumber >= 5) {
      row.alignment = { vertical: 'middle' };
    }
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="mileage.xlsx"');
  await workbook.xlsx.write(res);
}

module.exports = { exportExpensesToXLSX, exportTimesheetsToXLSX, exportMileageToXLSX };