# Sole Proprietor Business Manager

A single-user, Dockerized full-stack application for managing clients, expenses, timesheets, and invoices. Built specifically for Canadian sole proprietors with HST (13%) handling.

---

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + Tailwind CSS + Recharts |
| Backend | Node.js + Express + Prisma ORM |
| Database | PostgreSQL 15 |
| Auth | JWT (HttpOnly cookies) |
| PDF Generation | pdf-lib |
| Excel Export | exceljs |

---

## Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose v2+

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd sole-proprietor-app
```

### 2. Configure Environment

Create `.env` from the safe template:

```bash
cp .env.example .env
```

Edit `.env` in the project root:

```env
# Database
DB_USER=soleprop
DB_PASSWORD=soleprop_secret
DB_NAME=soleprop

# Security — CHANGE THIS!
JWT_SECRET=your_random_32_char_string_here

```

> **Security Note:** Never commit `.env` to Git. It is ignored by `.gitignore`.

### 3. Launch

```bash
docker-compose up -d --build
```

### 4. Access

Open your browser to: **http://localhost:8002**

### 5. First-Time Access

- Open the app and create your first account from the setup/signup screen.
- After the first user is created, signup is disabled and normal login is used.

---

## Port Mapping

| Service | Host Port | Container Port | Notes |
|---------|-----------|----------------|-------|
| Nginx (App) | **8002** | 80 | Main entry point |
| PostgreSQL | **5433** | 5432 | For local admin tools only |
| Backend | — | 3001 | Internal only |
| Frontend | — | 80 | Internal only |

---

## First-Time Database Setup

Prisma migrate and seed run **automatically** when the backend container starts.

To manually reset the database (destroys all data):

```bash
docker-compose exec backend npx prisma migrate reset --force
```

To run migrations manually:

```bash
docker-compose exec backend npx prisma migrate deploy
```

---

## File Storage & Backups

All uploads are stored in the Docker volume `uploads` at:

```
/app/uploads/clients/{clientId}/
```

- Contract documents
- Receipt images

Files are organized by `clientId` and referenced by path in the database.

### Automated Backups & Snapshots

- All data (database + uploads) is automatically snapshotted to a dedicated Docker volume `backups`.
- Snapshots are timestamped and preserved for download or restore.
- Automatic retention keeps up to 25 snapshots.
- The newest 10 snapshots are protected from manual deletion.
- Snapshots older than the newest 25 are auto-pruned.
- Configure backup interval, create manual snapshots, download, and restore from the **Settings → Backup & Restore** section in the app.
- Backup interval is constrained to **120 to 480 minutes**.
- Snapshots are stored at `/app/backups/snapshots/` inside the backend container.
- You can restore from any snapshot or upload a backup file for recovery/migration.

---

## Daily Operations

### View Logs

```bash
# Backend
docker-compose logs -f backend

# All services
docker-compose logs -f
```

### Restart Services

```bash
docker-compose restart
```

### Stop Application

```bash
docker-compose down
```

### Full Reset (Data + Uploads + Backups)

```bash
docker-compose down -v
```

> This destroys the database, uploads, and backup volumes. Use with caution.

---

## Updating Business Settings

After login, navigate to **Dashboard** to view your business name and HST number. To update:

1. Use the Settings API or directly update the database user record.
2. Restart the backend container if needed.

---

## Features Overview

### Client Management Portal (CMP)
- CRUD clients with locations, pay rates, contract details
- Upload and preview contract PDFs
- Support for direct and middle-party (recruiter) billing

### Expense Tracker
- Log expenses per client with date/time, amount, description
- Upload receipt images (JPG/PNG/PDF)
- Inline preview and download
- Filter by client and date range
- Export to Excel (.xlsx) with styled headers
- Date display is timezone-safe for date-only expense records (prevents day-shift/off-by-one display)
- Expense rows show invoice state highlighting:
  - Orange strip = invoiced but pending payment
  - Green strip = invoiced and paid

### Timesheets
- Log daily entries: location, date, start/end times
- Auto-computed total hours
- Filter by client and period
- Running totals in table footer
- Timesheet rows show invoice state highlighting:
  - Orange strip = invoiced but pending payment
  - Green strip = invoiced and paid

### Invoices
- Generate invoices from timesheet periods
- Auto-calculate hours, rate, subtotal, HST 13%, total
- Toggle billing to client or recruiter (for middle-party setups)
- Generate expense reimbursement invoices by selecting specific expenses
- Expense invoices do not add extra tax (treated as tax-inclusive reimbursements)
- Expense invoice PDFs include receipt filename references and attach receipt pages (image/PDF receipts)
- Expense invoice generation does not require period dates when expenses are selected
- Duplicate safety net:
  - Prevents generating an invoice for expenses already tied to another invoice
  - Prevents generating an invoice for timesheets already tied to another invoice
  - Expense picker disables already-invoiced items and shows invoice number/status
- Historical invoice linkage backfill:
  - Existing invoices are linked to eligible historical timesheets/expenses on backend startup
  - Enables strip-color status for older records, not just newly created invoices
- Auto-incrementing invoice numbers
- Styled PDF generation with embedded timesheet summary table
- Color-coded status: **Orange** (Pending) / **Green** (Paid)
- Mark as paid, regenerate, download

### UX Improvements
- Data entry moved into modals for:
  - Expenses (new/edit)
  - Timesheets (new/edit)
  - Invoices (generate new)
- Filters redesigned as compact/collapsible panels so tables stay visible and readable.

---

## Timezone

- All containers are configured to use the `America/Toronto` timezone (Eastern Time, Canada).
- All logs, timestamps, and scheduled tasks (including backups) are aligned to Toronto local time.

## Security Notes

- **JWT Secret:** Must be changed from default before production use.
- **Credentials:** Use a strong unique password for your first account.
- **Env File:** Never commit `.env` to version control.
- **File Access:** Upload routes validate paths to prevent directory traversal.
- **Auth:** All API routes (except `/api/auth/login`) require valid JWT via HttpOnly cookie.

---

## Publish To GitHub (Safe)

### 1. Verify ignored secrets and build artifacts

This project ignores:

- `.env` and all environment files except `.env.example`
- `node_modules`
- `frontend/dist`
- local logs and temp files

Quick check before first push:

```bash
git status --short
```

Confirm `.env` does not appear in staged/tracked files.

### 2. Initialize and commit

```bash
git init
git add .
git commit -m "Initial commit"
```

### 3. Create GitHub repo and push

Using GitHub CLI:

```bash
gh auth login
gh repo create sole-proprietor-app --private --source . --remote origin --push
```

Or manually:

```bash
git branch -M main
git remote add origin https://github.com/<your-username>/sole-proprietor-app.git
git push -u origin main
```

---

## Troubleshooting

### Database connection fails

```bash
docker-compose ps          # Check container health
docker-compose logs db     # Check PostgreSQL logs
```

### Backend won't start

Ensure the database is healthy first. The backend waits for the DB health check to pass before starting.

### File uploads fail

Check that the `uploads` volume is mounted and writable:

```bash
docker-compose exec backend ls -la /app/uploads
```

### Invoice PDF does not reflect latest changes

Code changes require rebuilding containers in this Dockerized setup:

```bash
docker-compose up -d --build backend nginx
```

If invoice content/layout changed, generate a **new** invoice PDF. Existing saved PDFs are not auto-regenerated.

### Settings changes not visible

For Settings/Frontend UI updates (backup controls, snapshot actions, modal/form layout), rebuild frontend + nginx:

```bash
docker-compose up -d --build frontend nginx
```

For backup logic or invoice backend behavior updates, rebuild backend too:

```bash
docker-compose up -d --build backend frontend nginx
```

### Port 8002 already in use

Change the host port in `docker-compose.yml`:

```yaml
ports:
  - "YOUR_PORT:80"
```

---

## Project Structure

```
sole-proprietor-app/
├── .env
├── docker-compose.yml
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── src/
│       ├── server.js
│       ├── middleware/
│       │   └── auth.js
│       ├── routes/
│       │   ├── auth.js
│       │   ├── clients.js
│       │   ├── expenses.js
│       │   ├── timesheets.js
│       │   ├── invoices.js
│       │   ├── files.js
│       │   └── settings.js
│       └── utils/
│           ├── pdfGenerator.js
│           └── xlsxGenerator.js
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── vite.config.js
    └── src/
        ├── index.css
        ├── main.jsx
        ├── App.jsx
        ├── api.js
        ├── context/
        │   └── AuthContext.jsx
        └── components/
            ├── Layout.jsx
            ├── Login.jsx
            ├── Dashboard.jsx
            ├── Clients.jsx
            ├── Expenses.jsx
            ├── Timesheets.jsx
            ├── Invoices.jsx
            └── FileViewer.jsx
```

---

## License

MIT — For personal and commercial use by sole proprietors.
