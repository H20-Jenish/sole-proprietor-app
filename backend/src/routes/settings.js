const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');
const {
  getBackupConfig,
  updateBackupConfig,
  createSnapshot,
  listSnapshots,
  getSnapshotPath,
  restoreSnapshotByName,
  restoreSnapshotArchive,
  saveUploadedArchive,
} = require('../services/backupService');

const router = express.Router();
const prisma = new PrismaClient();

const uploadDir = '/tmp/backup-uploads';
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 1024 * 1024 * 1024 },
});

router.get('/', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'No user' });
  res.json({ name: user.name, phone: user.phone, hstNumber: user.hstNumber, businessName: user.businessName, email: user.email });
});

router.put('/', authMiddleware, async (req, res) => {
  const { name, phone, hstNumber, businessName, email, currentPassword, newPassword } = req.body || {};
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'No user' });

  const hasField = (field) => Object.prototype.hasOwnProperty.call(req.body || {}, field);

  const updateData = {
    name: hasField('name') ? String(name || '').trim() : user.name,
    phone: hasField('phone') ? (String(phone || '').trim() || null) : user.phone,
    hstNumber: hasField('hstNumber') ? String(hstNumber || '').trim() : user.hstNumber,
    businessName: hasField('businessName') ? String(businessName || '').trim() : user.businessName,
    email: hasField('email') ? String(email || '').trim().toLowerCase() : user.email,
  };

  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ error: 'Current password is required to set a new password' });
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    if (String(newPassword).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    updateData.password = await bcrypt.hash(String(newPassword), 10);
  }

  try {
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
    });
    res.json({ name: updated.name, phone: updated.phone, hstNumber: updated.hstNumber, businessName: updated.businessName, email: updated.email });
  } catch (error) {
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Email is already in use' });
    throw error;
  }
});

router.get('/backup', authMiddleware, async (_req, res) => {
  const config = getBackupConfig();
  const snapshots = listSnapshots();
  res.json({ ...config, snapshots });
});

router.put('/backup', authMiddleware, async (req, res) => {
  const current = getBackupConfig();
  const next = updateBackupConfig({
    intervalMinutes: req.body?.intervalMinutes ?? current.intervalMinutes,
    autoEnabled: req.body?.autoEnabled ?? current.autoEnabled,
  });
  res.json(next);
});

router.post('/backup/snapshot', authMiddleware, async (_req, res) => {
  const snapshot = await createSnapshot('manual');
  res.json(snapshot);
});

router.get('/backup/snapshots', authMiddleware, async (_req, res) => {
  res.json(listSnapshots());
});

router.get('/backup/download/:fileName', authMiddleware, async (req, res) => {
  const full = getSnapshotPath(req.params.fileName);
  if (!full) return res.status(404).json({ error: 'Snapshot not found' });
  const fileName = path.basename(full);
  res.set('Content-Type', 'application/gzip');
  res.set('Content-Disposition', `attachment; filename="${fileName}"`);
  res.sendFile(full);
});

router.post('/backup/restore/snapshot', authMiddleware, async (req, res) => {
  const fileName = String(req.body?.fileName || '').trim();
  if (!fileName) return res.status(400).json({ error: 'Snapshot fileName is required' });
  const result = await restoreSnapshotByName(fileName);
  res.json(result);
});

router.post('/backup/restore/upload', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Backup file is required' });
  const uploadedPath = saveUploadedArchive(req.file);
  try {
    const result = await restoreSnapshotArchive(uploadedPath);
    res.json(result);
  } finally {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

module.exports = router;