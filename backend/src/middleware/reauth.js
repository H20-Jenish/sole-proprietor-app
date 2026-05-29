const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

function getAuthUserId(req) {
  const authToken = req.cookies?.token;
  if (!authToken) return null;

  try {
    const decoded = jwt.verify(authToken, JWT_SECRET);
    return decoded?.userId || null;
  } catch {
    return null;
  }
}

function getReauthPayload(req) {
  const token = req.headers['x-reauth-token'];
  if (!token) return null;

  try {
    const decoded = jwt.verify(String(token), JWT_SECRET);
    if (decoded?.purpose !== 'reauth') return null;
    return decoded;
  } catch {
    return null;
  }
}

function sendReauthRequired(res) {
  return res.status(428).json({
    error: 'Re-authentication required',
    code: 'REAUTH_REQUIRED',
  });
}

function requireReauthForDelete(req, res, next) {
  if (req.method !== 'DELETE') return next();

  const authUserId = getAuthUserId(req);
  if (!authUserId) return res.status(401).json({ error: 'Unauthorized' });

  const reauth = getReauthPayload(req);
  if (!reauth || Number(reauth.userId) !== Number(authUserId)) {
    return sendReauthRequired(res);
  }

  return next();
}

function requireReauthForSettings(req, res, next) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return res.status(401).json({ error: 'Unauthorized' });

  const reauth = getReauthPayload(req);
  if (!reauth || Number(reauth.userId) !== Number(authUserId)) {
    return sendReauthRequired(res);
  }

  return next();
}

module.exports = {
  requireReauthForDelete,
  requireReauthForSettings,
};
