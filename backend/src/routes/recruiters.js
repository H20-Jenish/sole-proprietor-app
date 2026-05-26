const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join('/app/uploads/recruiters', String(req.params.id || '0'));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', authMiddleware, async (_req, res) => {
  const recruiters = await prisma.recruiter.findMany({
    include: {
      _count: { select: { clients: true } },
      documents: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(recruiters);
});

router.post('/', authMiddleware, async (req, res) => {
  const data = req.body || {};
  if (!data.name?.trim()) return res.status(400).json({ error: 'Recruiter name is required' });
  if (!data.address?.trim()) return res.status(400).json({ error: 'Recruiter address is required' });

  const recruiter = await prisma.recruiter.create({
    data: {
      name: data.name.trim(),
      address: data.address.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      fax: data.fax?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });

  res.json(recruiter);
});

router.put('/:id', authMiddleware, async (req, res) => {
  const data = req.body || {};
  if (!data.name?.trim()) return res.status(400).json({ error: 'Recruiter name is required' });
  if (!data.address?.trim()) return res.status(400).json({ error: 'Recruiter address is required' });

  const recruiter = await prisma.recruiter.update({
    where: { id: Number(req.params.id) },
    data: {
      name: data.name.trim(),
      address: data.address.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      fax: data.fax?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });

  res.json(recruiter);
});

router.delete('/:id', authMiddleware, async (req, res) => {
  await prisma.recruiter.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

router.get('/:id/documents', authMiddleware, async (req, res) => {
  const docs = await prisma.recruiterDocument.findMany({
    where: { recruiterId: Number(req.params.id) },
    orderBy: { createdAt: 'desc' },
  });
  res.json(docs);
});

router.post('/:id/documents', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const recruiterId = Number(req.params.id);
  const filePath = path.join('recruiters', String(recruiterId), req.file.filename);
  const doc = await prisma.recruiterDocument.create({
    data: {
      recruiterId,
      filePath,
      filename: req.file.originalname,
      mimeType: req.file.mimetype || 'application/octet-stream',
      description: req.body.description?.trim() || null,
    },
  });
  res.json(doc);
});

router.delete('/:id/documents/:docId', authMiddleware, async (req, res) => {
  const recruiterId = Number(req.params.id);
  const docId = Number(req.params.docId);

  const doc = await prisma.recruiterDocument.findFirst({
    where: { id: docId, recruiterId },
  });
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const fp = path.join('/app/uploads', doc.filePath);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);

  await prisma.recruiterDocument.delete({ where: { id: docId } });
  res.json({ ok: true });
});

module.exports = router;
