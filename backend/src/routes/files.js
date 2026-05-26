const express = require('express');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function sendScopedFile(baseDir, scopeId, filename, req, res) {
  const safe = path.normalize(filename).replace(/^(\.\.(\/|\\|$))+/, '');
  const root = path.join(baseDir, String(scopeId));
  const filePath = path.join(root, safe);
  if (!filePath.startsWith(root)) {
    return res.status(403).json({ error: 'Invalid path' });
  }
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });

  const download = req.query.download === '1';
  const mime = safe.endsWith('.pdf') ? 'application/pdf' : (safe.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? `image/${safe.split('.').pop()}` : 'application/octet-stream');
  res.set('Content-Type', mime);
  res.set('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${safe}"`);
  res.sendFile(filePath);
}

router.get('/clients/:clientId/:filename', authMiddleware, (req, res) => {
  const { clientId, filename } = req.params;
  sendScopedFile('/app/uploads/clients', clientId, filename, req, res);
});

router.get('/recruiters/:recruiterId/:filename', authMiddleware, (req, res) => {
  const { recruiterId, filename } = req.params;
  sendScopedFile('/app/uploads/recruiters', recruiterId, filename, req, res);
});

// Backward-compatible client file route.
router.get('/:clientId/:filename', authMiddleware, (req, res) => {
  const { clientId, filename } = req.params;
  sendScopedFile('/app/uploads/clients', clientId, filename, req, res);
});

module.exports = router;