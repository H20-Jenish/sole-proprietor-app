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
    const dir = path.join('/app/uploads/clients', String(req.params.id || req.body.clientId || '0'));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function normalizeSiteLocations(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((s) => ({
      shortName: String(s?.shortName || '').trim(),
      fullAddress: String(s?.fullAddress || '').trim(),
    }))
    .filter((s) => s.shortName || s.fullAddress);
}

router.get('/', authMiddleware, async (_req, res) => {
  const clients = await prisma.client.findMany({
    include: {
      recruiter: {
        select: { id: true, name: true, address: true, email: true, phone: true },
      },
      documents: {
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(clients);
});

router.post('/', authMiddleware, async (req, res) => {
  const data = req.body;
  const siteLocations = normalizeSiteLocations(data.siteLocations);
  const sitesFromObjects = siteLocations.map((s) => s.shortName).filter(Boolean);
  const fullAddressesFromObjects = siteLocations.map((s) => s.fullAddress).filter(Boolean);
  const sites = Array.isArray(data.sites)
    ? data.sites
    : (Array.isArray(data.locations) ? data.locations : []);
  const effectiveSites = siteLocations.length ? sitesFromObjects : sites;
  const mainLocation = data.mainLocation || data.address || fullAddressesFromObjects[0] || effectiveSites[0] || null;
  const client = await prisma.client.create({
    data: {
      name: data.name,
      phone: data.phone || null,
      address: data.address || null,
      siteLocations: siteLocations.length ? siteLocations : null,
      paysBreak: !!data.paysBreak,
      paidBreakMinutes: Math.max(0, Number(data.paidBreakMinutes) || 0),
      mainLocation,
      sites: effectiveSites,
      locations: siteLocations.length ? [mainLocation, ...fullAddressesFromObjects].filter(Boolean) : [mainLocation, ...effectiveSites].filter(Boolean),
      connectVia: data.connectVia || 'DIRECT',
      recruiterId: data.recruiterId ? Number(data.recruiterId) : null,
      recruiterAddress: data.recruiterAddress || null,
      payRate: Number(data.payRate) || 0,
      payRateType: data.payRateType || 'HOURLY',
      contractLength: data.contractLength || null,
      serviceDesc: data.serviceDesc || null,
    },
    include: {
      recruiter: {
        select: { id: true, name: true, address: true, email: true, phone: true },
      },
    },
  });
  res.json(client);
});

router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const siteLocations = normalizeSiteLocations(data.siteLocations);
  const sitesFromObjects = siteLocations.map((s) => s.shortName).filter(Boolean);
  const fullAddressesFromObjects = siteLocations.map((s) => s.fullAddress).filter(Boolean);
  const sites = Array.isArray(data.sites)
    ? data.sites
    : (Array.isArray(data.locations) ? data.locations : []);
  const effectiveSites = siteLocations.length ? sitesFromObjects : sites;
  const mainLocation = data.mainLocation || data.address || fullAddressesFromObjects[0] || effectiveSites[0] || null;
  const client = await prisma.client.update({
    where: { id: Number(id) },
    data: {
      name: data.name,
      phone: data.phone || null,
      address: data.address || null,
      siteLocations: siteLocations.length ? siteLocations : null,
      paysBreak: !!data.paysBreak,
      paidBreakMinutes: Math.max(0, Number(data.paidBreakMinutes) || 0),
      mainLocation,
      sites: effectiveSites,
      locations: siteLocations.length ? [mainLocation, ...fullAddressesFromObjects].filter(Boolean) : [mainLocation, ...effectiveSites].filter(Boolean),
      connectVia: data.connectVia || 'DIRECT',
      recruiterId: data.recruiterId ? Number(data.recruiterId) : null,
      recruiterAddress: data.recruiterAddress || null,
      payRate: Number(data.payRate) || 0,
      payRateType: data.payRateType || 'HOURLY',
      contractLength: data.contractLength || null,
      serviceDesc: data.serviceDesc || null,
    },
    include: {
      recruiter: {
        select: { id: true, name: true, address: true, email: true, phone: true },
      },
    },
  });
  res.json(client);
});

router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  await prisma.client.delete({ where: { id: Number(id) } });
  // Clean up uploads
  const dir = path.join('/app/uploads/clients', id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  res.json({ ok: true });
});

router.post('/:id/contract', authMiddleware, upload.single('file'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filePath = path.join('clients', id, req.file.filename);
  const client = await prisma.client.update({
    where: { id: Number(id) },
    data: { contractDocPath: filePath },
  });
  res.json(client);
});

router.get('/:id/documents', authMiddleware, async (req, res) => {
  const docs = await prisma.clientDocument.findMany({
    where: { clientId: Number(req.params.id) },
    orderBy: { createdAt: 'desc' },
  });
  res.json(docs);
});

router.post('/:id/documents', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const clientId = Number(req.params.id);
  const filePath = path.join('clients', String(clientId), req.file.filename);
  const doc = await prisma.clientDocument.create({
    data: {
      clientId,
      filePath,
      filename: req.file.originalname,
      mimeType: req.file.mimetype || 'application/octet-stream',
      description: req.body.description?.trim() || null,
    },
  });

  res.json(doc);
});

router.delete('/:id/documents/:docId', authMiddleware, async (req, res) => {
  const clientId = Number(req.params.id);
  const docId = Number(req.params.docId);

  const doc = await prisma.clientDocument.findFirst({
    where: { id: docId, clientId },
  });
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const fp = path.join('/app/uploads', doc.filePath);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);

  await prisma.clientDocument.delete({ where: { id: docId } });
  res.json({ ok: true });
});

module.exports = router;