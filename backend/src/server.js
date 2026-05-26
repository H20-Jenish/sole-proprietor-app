const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initBackupScheduler } = require('./services/backupService');

const app = express();
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/recruiters', require('./routes/recruiters'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/timesheets', require('./routes/timesheets'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/files', require('./routes/files'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/mileage', require('./routes/mileage'));
app.use('/api/car-valuations', require('./routes/carValuations'));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  initBackupScheduler();
  console.log(`Backend running on port ${PORT}`);
});