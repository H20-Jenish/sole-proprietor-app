const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { format } = require('date-fns');
const { formatDateOnly, formatDayOfWeek } = require('./dateOnly');

function fmtDate(d) {
  return d ? formatDateOnly(d) : '';
}

function normalizeSiteMap(client) {
  const map = new Map();
  const rows = Array.isArray(client?.siteLocations) ? client.siteLocations : [];
  rows.forEach((row) => {
    const shortName = String(row?.shortName || '').trim();
    const fullAddress = String(row?.fullAddress || '').trim();
    if (shortName) map.set(shortName.toLowerCase(), { shortName, fullAddress });
    if (fullAddress) map.set(fullAddress.toLowerCase(), { shortName, fullAddress });
  });
  return map;
}

function buildServiceLocationLines(timesheets, client) {
  const siteMap = normalizeSiteMap(client);
  const uniq = [];
  const seen = new Set();

  timesheets.forEach((t) => {
    const raw = String(t?.location || '').trim();
    if (!raw) return;
    const mapped = siteMap.get(raw.toLowerCase());
    const shortName = mapped?.shortName || raw;
    const fullAddress = mapped?.fullAddress || '';
    const address = fullAddress && fullAddress.toLowerCase() !== shortName.toLowerCase() ? fullAddress : '';
    const dedupeKey = `${shortName} ${address}`.trim().toLowerCase();
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      uniq.push({ shortName, address });
    }
  });

  return uniq;
}

async function generateInvoicePDF(invoice, client, timesheets, user, recruiter = null) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const right = width - margin;
  const palette = {
    ink: rgb(0.12, 0.16, 0.22),
    body: rgb(0.28, 0.33, 0.4),
    muted: rgb(0.47, 0.53, 0.61),
    accent: rgb(0.14, 0.37, 0.62),
    accentSoft: rgb(0.93, 0.96, 0.99),
    line: rgb(0.82, 0.86, 0.91),
    surface: rgb(0.972, 0.978, 0.986),
  };

  const drawRightText = (text, rightX, y, options = {}) => {
    const value = String(text);
    const size = options.size || 10;
    const usedFont = options.font || font;
    const color = options.color || palette.body;
    const textWidth = usedFont.widthOfTextAtSize(value, size);
    page.drawText(value, { x: rightX - textWidth, y, size, font: usedFont, color });
  };

  const wrapText = (text, maxWidth, options = {}) => {
    const value = String(text || '').trim();
    if (!value) return [''];

    const size = options.size || 10;
    const usedFont = options.font || font;
    const words = value.split(/\s+/);
    const lines = [];
    let current = '';

    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      const candidateWidth = usedFont.widthOfTextAtSize(candidate, size);
      if (candidateWidth <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    });

    if (current) lines.push(current);
    return lines;
  };

  const drawLabel = (text, x, y) => {
    page.drawText(text, {
      x,
      y,
      size: 8,
      font: bold,
      color: palette.accent,
    });
  };

  const drawKeyValue = (label, value, x, y, labelWidth, valueRightX) => {
    page.drawText(label, { x, y, size: 9, font: bold, color: palette.muted });
    drawRightText(value || '—', valueRightX, y, { size: 10, font, color: palette.ink });
  };

  const drawMixedTextLine = (segments, x, y, maxWidth, size, color) => {
    let cursorX = x;
    let cursorY = y;
    const lineHeight = size + 3;

    segments.forEach((segment) => {
      const text = String(segment.text || '');
      if (!text) return;

      const segmentFont = segment.font || font;
      const words = text.split(/(\s+)/).filter(Boolean);
      words.forEach((word) => {
        const wordWidth = segmentFont.widthOfTextAtSize(word, size);
        if (cursorX > x && cursorX + wordWidth > x + maxWidth) {
          cursorX = x;
          cursorY -= lineHeight;
        }
        page.drawText(word, {
          x: cursorX,
          y: cursorY,
          size,
          font: segmentFont,
          color,
        });
        cursorX += wordWidth;
      });
    });

    return cursorY;
  };

  const drawCard = (x, yTop, widthValue, heightValue, title, bodyLines = []) => {
    page.drawRectangle({
      x,
      y: yTop - heightValue,
      width: widthValue,
      height: heightValue,
      color: rgb(1, 1, 1),
      borderColor: palette.line,
      borderWidth: 1,
    });
    page.drawRectangle({
      x,
      y: yTop - 28,
      width: widthValue,
      height: 28,
      color: palette.surface,
      borderColor: palette.line,
      borderWidth: 1,
    });
    drawLabel(title, x + 12, yTop - 17);

    let lineY = yTop - 48;
    bodyLines.forEach((line, index) => {
      if (line && typeof line === 'object' && line.type === 'service-location') {
        const endY = drawMixedTextLine([
          { text: line.shortName, font: bold },
          { text: line.address ? ` - ${line.address}` : '', font },
        ], x + 12, lineY, widthValue - 24, 9.5, palette.body);
        lineY = endY - 15;
        return;
      }

      const lineFont = index === 0 ? bold : font;
      const lineSize = index === 0 ? 11 : 9.5;
      const wrappedLines = wrapText(String(line), widthValue - 24, { font: lineFont, size: lineSize });

      wrappedLines.forEach((wrappedLine) => {
        page.drawText(wrappedLine, {
          x: x + 12,
          y: lineY,
          size: lineSize,
          font: lineFont,
          color: index === 0 ? palette.ink : palette.body,
        });
        lineY -= index === 0 ? 13 : 12;
      });
      lineY -= 3;
    });
  };

  page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: palette.accent });

  let y = height - 52;
  page.drawText(user.businessName || 'Business Name', {
    x: margin,
    y,
    size: 22,
    font: bold,
    color: palette.ink,
  });

  let contactY = y - 20;
  if (user.hstNumber && String(user.hstNumber).trim()) {
    page.drawText(`HST # ${user.hstNumber}`, { x: margin, y: contactY, size: 10, font: bold, color: palette.ink });
    contactY -= 15;
  }

  const contactLines = [];
  if (user.phone && String(user.phone).trim()) {
    contactLines.push(`Phone: ${String(user.phone).trim()}`);
  }
  if (user.email) {
    contactLines.push(`Email: ${user.email}`);
  }

  if (contactLines.length) {
    page.drawText('Contact Details', { x: margin, y: contactY, size: 9, font: bold, color: palette.accent });
    contactY -= 13;
    contactLines.forEach((line) => {
      page.drawText(line, { x: margin, y: contactY, size: 10, font, color: palette.body });
      contactY -= 12;
    });
  }

  const metaW = 196;
  const metaH = 112;
  const metaX = right - metaW;
  const metaTop = height - 38;
  page.drawRectangle({
    x: metaX,
    y: metaTop - metaH,
    width: metaW,
    height: metaH,
    color: rgb(1, 1, 1),
    borderColor: palette.line,
    borderWidth: 1,
  });
  page.drawRectangle({
    x: metaX,
    y: metaTop - 26,
    width: metaW,
    height: 26,
    color: palette.accentSoft,
    borderColor: palette.line,
    borderWidth: 1,
  });
  page.drawText('INVOICE', {
    x: metaX + 14,
    y: metaTop - 17,
    size: 16,
    font: bold,
    color: palette.ink,
  });
  let metaY = metaTop - 42;
  drawKeyValue('Invoice #', String(invoice.invoiceNum), metaX + 14, metaY, 70, metaX + metaW - 14);
  metaY -= 17;
  drawKeyValue('Date', fmtDate(invoice.createdDate), metaX + 14, metaY, 70, metaX + metaW - 14);
  metaY -= 17;
  drawKeyValue('Month', format(new Date(invoice.createdDate), 'MMMM yyyy'), metaX + 14, metaY, 70, metaX + metaW - 14);
  metaY -= 17;
  drawKeyValue('Period', `${fmtDate(invoice.periodStart)} to ${fmtDate(invoice.periodEnd)}`, metaX + 14, metaY, 70, metaX + metaW - 14);

  const billName = invoice.recruiterId
    ? `${recruiter?.name || 'Recruiter'} (for ${client.name})`
    : client.name;
  const billAddr = invoice.recruiterId
    ? (recruiter?.address || client.recruiterAddress || '')
    : (client.mainLocation || client.locations?.join(', ') || '');
  const billPhone = invoice.recruiterId ? (recruiter?.phone || '') : (client.phone || '');
  const billFax = invoice.recruiterId ? (recruiter?.fax || '') : '';
  const serviceLines = buildServiceLocationLines(timesheets, client);

  drawCard(margin, height - 160, 246, 126, 'Bill To', [
    billName,
    billAddr || 'N/A',
    billPhone ? `Phone: ${billPhone}` : null,
    billFax ? `Fax: ${billFax}` : null,
  ].filter(Boolean));

  drawCard(margin + 266, height - 160, 246, 126, 'Service Details', [
    ...(serviceLines.length
      ? serviceLines.map((line) => ({ type: 'service-location', shortName: line.shortName, address: line.address }))
      : ['Location: N/A']),
  ]);

  y = height - 310;
  page.drawText('Detail Timesheet', {
    x: margin,
    y,
    size: 14,
    font: bold,
    color: palette.ink,
  });
  page.drawText('Daily technical service breakdown', {
    x: margin,
    y: y - 14,
    size: 9,
    font: font,
    color: palette.muted,
  });

  y -= 34;
  const cols = [margin + 10, margin + 88, margin + 136, margin + 270, margin + 344, margin + 408, margin + 470];
  const headers = ['Date', 'Day', 'Location', 'Start', 'End', 'Hours', 'Rate'];

  page.drawRectangle({
    x: margin,
    y: y - 16,
    width: width - margin * 2,
    height: 24,
    color: palette.accentSoft,
    borderColor: palette.line,
    borderWidth: 0.8,
  });

  headers.forEach((h, i) => {
    page.drawText(h, { x: cols[i], y: y - 9, size: 9, font: bold, color: palette.accent });
  });

  let rowY = y - 34;
  timesheets.forEach((t, idx) => {
    page.drawRectangle({
      x: margin,
      y: rowY - 7,
      width: width - margin * 2,
      height: 18,
      color: idx % 2 === 0 ? rgb(1, 1, 1) : palette.surface,
      borderColor: palette.line,
      borderWidth: 0.3,
    });

    page.drawText(fmtDate(t.date), { x: cols[0], y: rowY, size: 8.8, font, color: palette.ink });
    page.drawText(formatDayOfWeek(t.date), { x: cols[1], y: rowY, size: 8.8, font, color: palette.body });
    page.drawText(String(t.location || '').substring(0, 20), { x: cols[2], y: rowY, size: 8.8, font, color: palette.ink });
    page.drawText(t.startTime, { x: cols[3], y: rowY, size: 8.8, font, color: palette.body });
    page.drawText(t.endTime, { x: cols[4], y: rowY, size: 8.8, font, color: palette.body });
    page.drawText(Number(t.totalHours).toFixed(2), { x: cols[5], y: rowY, size: 8.8, font: bold, color: palette.ink });
    page.drawText(`$${Number(invoice.rate).toFixed(2)}`, { x: cols[6], y: rowY, size: 8.8, font: bold, color: palette.ink });

    rowY -= 18;
  });

  const hasHst = !!(user.hstNumber && String(user.hstNumber).trim());
  const boxW = 220;
  const boxX = right - boxW;
  const boxH = hasHst ? 132 : 116;
  let boxTop = rowY - 22;

  page.drawRectangle({
    x: boxX,
    y: boxTop - boxH,
    width: boxW,
    height: boxH,
    color: rgb(1, 1, 1),
    borderColor: palette.line,
    borderWidth: 1,
  });

  page.drawRectangle({
    x: boxX,
    y: boxTop - 3,
    width: boxW,
    height: 3,
    color: palette.accent,
  });

  page.drawText('SUMMARY', {
    x: boxX + 12,
    y: boxTop - 18,
    size: 10,
    font: bold,
    color: palette.accent,
  });

  let sY = boxTop - 38;
  page.drawText('Total Hours', { x: boxX + 12, y: sY, size: 10, font, color: palette.ink });
  drawRightText(Number(invoice.totalHours).toFixed(2), boxX + boxW - 12, sY, { font: bold, color: palette.ink });

  sY -= 16;
  page.drawText('Rate', { x: boxX + 12, y: sY, size: 10, font, color: palette.ink });
  drawRightText(`$${Number(invoice.rate).toFixed(2)}`, boxX + boxW - 12, sY, { font: bold, color: palette.ink });

  sY -= 16;
  page.drawText('Subtotal', { x: boxX + 12, y: sY, size: 10, font, color: palette.ink });
  drawRightText(`$${Number(invoice.subtotal).toFixed(2)}`, boxX + boxW - 12, sY, { font: bold, color: palette.ink });

  if (hasHst) {
    sY -= 16;
    page.drawText('HST (13%)', { x: boxX + 12, y: sY, size: 10, font, color: palette.ink });
    drawRightText(`$${Number(invoice.hst13pct).toFixed(2)}`, boxX + boxW - 12, sY, { font: bold, color: palette.ink });
  }

  sY -= 18;
  page.drawLine({
    start: { x: boxX + 12, y: sY + 13 },
    end: { x: boxX + boxW - 12, y: sY + 13 },
    thickness: 1,
    color: palette.line,
  });

  page.drawText('TOTAL', {
    x: boxX + 12,
    y: sY - 2,
    size: 12,
    font: bold,
    color: palette.accent,
  });
  drawRightText(`$${Number(invoice.total).toFixed(2)}`, boxX + boxW - 12, sY - 2, {
    size: 12,
    font: bold,
    color: palette.accent,
  });

  return pdfDoc.save();
}

module.exports = { generateInvoicePDF };
