function parseDateOnly(value) {
  if (!value) return null;
  const iso = String(value).slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}

function formatDateOnly(value) {
  if (!value) return '';

  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
}

function formatDayOfWeek(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : parseDateOnly(value);
  if (!date) return '';
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()] || '';
}

module.exports = { parseDateOnly, formatDateOnly, formatDayOfWeek };