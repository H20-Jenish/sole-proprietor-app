const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BACKUP_DIR = '/app/backups';
const SNAPSHOT_DIR = path.join(BACKUP_DIR, 'snapshots');
const IMPORT_DIR = path.join(BACKUP_DIR, 'imports');
const TMP_DIR = path.join(BACKUP_DIR, 'tmp');
const CONFIG_PATH = path.join(BACKUP_DIR, 'config.json');
const APP_UPLOADS_DIR = '/app/uploads';

const DEFAULT_INTERVAL_MINUTES = 360;
const MIN_INTERVAL_MINUTES = 5;
const MAX_INTERVAL_MINUTES = 10080;

let timer = null;
let state = {
  intervalMinutes: DEFAULT_INTERVAL_MINUTES,
  lastSnapshotAt: null,
  autoEnabled: true,
};

function ensureDirs() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  fs.mkdirSync(IMPORT_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function readConfig() {
  ensureDirs();
  if (!fs.existsSync(CONFIG_PATH)) {
    const seed = {
      intervalMinutes: DEFAULT_INTERVAL_MINUTES,
      autoEnabled: true,
      lastSnapshotAt: null,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(seed, null, 2));
    return seed;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return {
      intervalMinutes: clampInterval(parsed.intervalMinutes),
      autoEnabled: parsed.autoEnabled !== false,
      lastSnapshotAt: parsed.lastSnapshotAt || null,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch (_err) {
    const fallback = {
      intervalMinutes: DEFAULT_INTERVAL_MINUTES,
      autoEnabled: true,
      lastSnapshotAt: null,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

function writeConfig(next) {
  ensureDirs();
  const payload = {
    intervalMinutes: clampInterval(next.intervalMinutes),
    autoEnabled: next.autoEnabled !== false,
    lastSnapshotAt: next.lastSnapshotAt || null,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(payload, null, 2));
  state = payload;
  return payload;
}

function clampInterval(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_INTERVAL_MINUTES;
  return Math.max(MIN_INTERVAL_MINUTES, Math.min(MAX_INTERVAL_MINUTES, Math.round(numeric)));
}

function makeTimestamp() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}Z`;
}

async function collectDatabasePayload() {
  const [
    users,
    recruiters,
    clients,
    expenses,
    timesheets,
    invoices,
    clientDocuments,
    recruiterDocuments,
  ] = await Promise.all([
    prisma.user.findMany({ orderBy: { id: 'asc' } }),
    prisma.recruiter.findMany({ orderBy: { id: 'asc' } }),
    prisma.client.findMany({ orderBy: { id: 'asc' } }),
    prisma.expense.findMany({ orderBy: { id: 'asc' } }),
    prisma.timesheet.findMany({ orderBy: { id: 'asc' } }),
    prisma.invoice.findMany({ orderBy: { id: 'asc' } }),
    prisma.clientDocument.findMany({ orderBy: { id: 'asc' } }),
    prisma.recruiterDocument.findMany({ orderBy: { id: 'asc' } }),
  ]);

  return {
    users,
    recruiters,
    clients,
    expenses,
    timesheets,
    invoices,
    clientDocuments,
    recruiterDocuments,
  };
}

function runTar(args) {
  const result = spawnSync('tar', args, { stdio: 'pipe' });
  if (result.status !== 0) {
    const stderr = (result.stderr || Buffer.from('')).toString('utf8').trim();
    throw new Error(stderr || 'tar command failed');
  }
}

async function createSnapshot(source = 'manual') {
  ensureDirs();
  const timestamp = makeTimestamp();
  const snapshotName = `snapshot-${timestamp}.tar.gz`;
  const snapshotPath = path.join(SNAPSHOT_DIR, snapshotName);
  const workDir = path.join(TMP_DIR, `snapshot-${timestamp}`);
  fs.mkdirSync(workDir, { recursive: true });

  try {
    const dbPayload = await collectDatabasePayload();
    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      source,
      snapshotName,
      counts: {
        users: dbPayload.users.length,
        recruiters: dbPayload.recruiters.length,
        clients: dbPayload.clients.length,
        expenses: dbPayload.expenses.length,
        timesheets: dbPayload.timesheets.length,
        invoices: dbPayload.invoices.length,
        clientDocuments: dbPayload.clientDocuments.length,
        recruiterDocuments: dbPayload.recruiterDocuments.length,
      },
    };

    fs.writeFileSync(path.join(workDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(workDir, 'db.json'), JSON.stringify(dbPayload, null, 2));

    if (fs.existsSync(APP_UPLOADS_DIR)) {
      fs.cpSync(APP_UPLOADS_DIR, path.join(workDir, 'uploads'), { recursive: true });
    }

    runTar(['-czf', snapshotPath, '-C', workDir, '.']);

    const updated = writeConfig({
      ...state,
      lastSnapshotAt: new Date().toISOString(),
    });

    const stat = fs.statSync(snapshotPath);
    return {
      fileName: snapshotName,
      fileSize: stat.size,
      createdAt: stat.birthtime.toISOString(),
      intervalMinutes: updated.intervalMinutes,
      autoEnabled: updated.autoEnabled,
      lastSnapshotAt: updated.lastSnapshotAt,
    };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

function sanitizeSnapshotName(name) {
  const safe = String(name || '').trim();
  if (!safe || safe.includes('..') || safe.includes('/') || safe.includes('\\')) return '';
  if (!safe.endsWith('.tar.gz')) return '';
  return safe;
}

function listSnapshots() {
  ensureDirs();
  return fs.readdirSync(SNAPSHOT_DIR)
    .filter((name) => name.endsWith('.tar.gz'))
    .map((name) => {
      const fp = path.join(SNAPSHOT_DIR, name);
      const stat = fs.statSync(fp);
      return {
        fileName: name,
        fileSize: stat.size,
        createdAt: stat.birthtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getSnapshotPath(name) {
  const safe = sanitizeSnapshotName(name);
  if (!safe) return null;
  const full = path.join(SNAPSHOT_DIR, safe);
  if (!fs.existsSync(full)) return null;
  return full;
}

function mapDateRows(rows, dateKeys) {
  return (rows || []).map((row) => {
    const out = { ...row };
    dateKeys.forEach((key) => {
      if (out[key]) out[key] = new Date(out[key]);
    });
    return out;
  });
}

async function restoreFromExtracted(extractDir) {
  const dbJsonPath = path.join(extractDir, 'db.json');
  if (!fs.existsSync(dbJsonPath)) {
    throw new Error('Backup payload missing db.json');
  }

  const payload = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));

  const users = mapDateRows(payload.users, []);
  const recruiters = mapDateRows(payload.recruiters, ['createdAt', 'updatedAt']);
  const clients = mapDateRows(payload.clients, ['createdAt', 'updatedAt']);
  const expenses = mapDateRows(payload.expenses, ['dateTime', 'createdAt']);
  const timesheets = mapDateRows(payload.timesheets, ['date', 'createdAt']);
  const invoices = mapDateRows(payload.invoices, ['periodStart', 'periodEnd', 'createdDate']);
  const clientDocuments = mapDateRows(payload.clientDocuments, ['createdAt']);
  const recruiterDocuments = mapDateRows(payload.recruiterDocuments, ['createdAt']);

  await prisma.$transaction(async (tx) => {
    await tx.recruiterDocument.deleteMany({});
    await tx.clientDocument.deleteMany({});
    await tx.invoice.deleteMany({});
    await tx.timesheet.deleteMany({});
    await tx.expense.deleteMany({});
    await tx.client.deleteMany({});
    await tx.recruiter.deleteMany({});
    await tx.user.deleteMany({});

    if (users.length) await tx.user.createMany({ data: users });
    if (recruiters.length) await tx.recruiter.createMany({ data: recruiters });
    if (clients.length) await tx.client.createMany({ data: clients });
    if (expenses.length) await tx.expense.createMany({ data: expenses });
    if (timesheets.length) await tx.timesheet.createMany({ data: timesheets });
    if (invoices.length) await tx.invoice.createMany({ data: invoices });
    if (clientDocuments.length) await tx.clientDocument.createMany({ data: clientDocuments });
    if (recruiterDocuments.length) await tx.recruiterDocument.createMany({ data: recruiterDocuments });
  });

  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"User"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "User";`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Recruiter"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "Recruiter";`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Client"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "Client";`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Expense"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "Expense";`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Timesheet"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "Timesheet";`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Invoice"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "Invoice";`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"ClientDocument"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "ClientDocument";`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"RecruiterDocument"', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "RecruiterDocument";`);

  const extractedUploads = path.join(extractDir, 'uploads');
  fs.rmSync(APP_UPLOADS_DIR, { recursive: true, force: true });
  fs.mkdirSync(APP_UPLOADS_DIR, { recursive: true });
  if (fs.existsSync(extractedUploads)) {
    fs.cpSync(extractedUploads, APP_UPLOADS_DIR, { recursive: true });
  }
}

async function restoreSnapshotArchive(archivePath) {
  ensureDirs();
  const restoreTs = makeTimestamp();
  const extractDir = path.join(TMP_DIR, `restore-${restoreTs}`);
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    runTar(['-xzf', archivePath, '-C', extractDir]);
    await restoreFromExtracted(extractDir);
    return { ok: true, restoredAt: new Date().toISOString() };
  } finally {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}

async function restoreSnapshotByName(fileName) {
  const full = getSnapshotPath(fileName);
  if (!full) throw new Error('Snapshot not found');
  return restoreSnapshotArchive(full);
}

function saveUploadedArchive(file) {
  ensureDirs();
  const timestamp = makeTimestamp();
  const ext = path.extname(file.originalname || '').toLowerCase();
  const suffix = ext === '.gz' ? '.tar.gz' : '.tar.gz';
  const name = `uploaded-${timestamp}${suffix}`;
  const dest = path.join(IMPORT_DIR, name);
  fs.copyFileSync(file.path, dest);
  return dest;
}

function getBackupConfig() {
  const cfg = readConfig();
  state = cfg;
  return {
    intervalMinutes: cfg.intervalMinutes,
    autoEnabled: cfg.autoEnabled,
    lastSnapshotAt: cfg.lastSnapshotAt,
    minIntervalMinutes: MIN_INTERVAL_MINUTES,
    maxIntervalMinutes: MAX_INTERVAL_MINUTES,
  };
}

function updateBackupConfig(input) {
  const next = writeConfig({
    intervalMinutes: clampInterval(input.intervalMinutes),
    autoEnabled: input.autoEnabled !== false,
    lastSnapshotAt: state.lastSnapshotAt,
  });
  reschedule();
  return {
    intervalMinutes: next.intervalMinutes,
    autoEnabled: next.autoEnabled,
    lastSnapshotAt: next.lastSnapshotAt,
    minIntervalMinutes: MIN_INTERVAL_MINUTES,
    maxIntervalMinutes: MAX_INTERVAL_MINUTES,
  };
}

function reschedule() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (!state.autoEnabled) return;

  const everyMs = clampInterval(state.intervalMinutes) * 60 * 1000;
  timer = setInterval(async () => {
    try {
      await createSnapshot('auto');
    } catch (err) {
      console.error('Auto snapshot failed:', err.message);
    }
  }, everyMs);
}

function initBackupScheduler() {
  state = readConfig();
  reschedule();
}

module.exports = {
  initBackupScheduler,
  getBackupConfig,
  updateBackupConfig,
  createSnapshot,
  listSnapshots,
  getSnapshotPath,
  restoreSnapshotByName,
  restoreSnapshotArchive,
  saveUploadedArchive,
};
