# Sole Proprietor Business Manager

A single-user, Dockerized full-stack application for managing clients, expenses, timesheets, invoices, and tax breakdowns. Built for Canadian sole proprietors with HST handling.

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
docker compose up -d --build
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
docker compose exec backend npx prisma migrate reset --force
```

To run migrations manually:

```bash
docker compose exec backend npx prisma migrate deploy
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
docker compose logs -f backend

# All services
docker compose logs -f
```

### Restart Services

```bash
docker compose restart
```

### Stop Application

```bash
docker compose down
```

### Full Reset (Data + Uploads + Backups)

```bash
docker compose down -v
```

> This destroys the database, uploads, and backup volumes. Use with caution.

---

### Updating Business Settings

After login, navigate to **Settings** to update business profile values, backup settings, and password.

- Settings access is protected by a password re-authentication prompt.
- When you leave Settings and come back, password confirmation is required again.

---

## Features Overview

### Client Management
- CRUD clients with locations, pay rates, contract details, and recruiter assignment
- Upload and preview contract PDFs
- Support for direct and middle-party billing

### Expense Tracking
- Log expenses per client with date/time, amount, and description
- Upload receipt images or PDFs
- Inline preview and download
- Filter by client and date range
- Export to Excel (`.xlsx`) with styled headers
- Timezone-safe display for date-only expense records
- Invoice-state highlighting on expense rows:
  - Orange = invoiced but pending payment
  - Violet = partially paid invoice
  - Green = fully paid invoice

### Timesheets
- Log daily entries with location, date, start/end times
- Auto-computed total hours
- Filter by client and period
- Running totals in the table footer
- Invoice-state highlighting on timesheet rows:
  - Orange = invoiced but pending payment
  - Violet = partially paid invoice
  - Green = fully paid invoice

### Invoices
- Generate invoices from timesheet periods or selected expenses
- Timesheet invoice helper in the invoice modal:
  - Shows worked-day count and uninvoiced worked-day count for the selected client
  - Displays uninvoiced worked dates as chips
  - Suggests the next bi-weekly range from the earliest uninvoiced worked date
- Expense invoices are tax-inclusive reimbursements and do not add extra tax
- Expense invoice generation does not require period dates when expenses are selected
- Duplicate safety checks prevent re-invoicing already linked timesheets or expenses
- Historical invoice linkage backfill runs on backend startup for older records
- Auto-incrementing invoice numbers
- Styled PDF generation with embedded timesheet summary table
- Color-coded invoice status: Orange, Violet, Green
- Payment workflow:
  - Record payment amounts with payment date
  - Record CPP, EI, and HST on non-expense invoices when payment is captured
  - Follow-up payments only expose tax fields that are still missing from earlier payments
  - Partial payments are stored in payment history
  - Invoice-level paid date keeps the first payment date
  - Add payment notes
  - Upload required pay statement before marking paid/partial
  - View or download pay statement
- Expense invoices do not ask for CPP, EI, or HST during payment
- Invoice payment modal only shows tax fields that are still missing on follow-up payments
- Marked invoices use a dedicated download picker modal for Invoice or Pay Statement
- Paid/partial invoices support expandable payment details:
  - Payment notes
  - Pay statement quick-view action
  - Payment history table
- Invoice summary cards align with collected and outstanding balances

### Tax
- Dedicated **Tax** page for paid invoices only
- Read-only tax cards for each paid invoice
- Shows CPP, EI, HST, and Net Income breakdown
- Top-right download actions for **Invoice** and **Paystatement**
- Expense invoices are excluded from tax totals and do not display tax rows

### Reports
- Dedicated **Reports** page with analytics from app data
- Filter by client and date range
- KPI cards for invoiced, collected, outstanding, expenses, hours logged, mileage, and tax split summaries
- Charts for monthly invoiced vs collected, invoice status mix, and top clients by invoiced amount
- Client performance table with invoiced, collected, outstanding, hours, and expenses

### Dashboard
- High-level summary cards for clients, expenses, hours, mileage, invoices, pending revenue, and collected revenue
- Tax summary cards for CPP, EI, HST, and Net Income
- Daily hours chart and recent activity feed

### Settings
- Update business profile values
- Manage backup settings and password
- Password re-authentication required for protected settings actions

### Backups
- Automatic snapshots for database and uploads
- Manual snapshot, download, and restore controls in the app
- Retention and backup interval controls in Settings

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
- **Re-Authentication:**
  - Any delete action requires password confirmation.
  - Settings endpoints require password re-authentication.
  - Re-auth prompts are shown using an in-app security modal (not browser prompt/confirm popups).

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
docker compose ps          # Check container health
docker compose logs db     # Check PostgreSQL logs
```

### Backend won't start

Ensure the database is healthy first. The backend waits for the DB health check to pass before starting.

### File uploads fail

Check that the `uploads` volume is mounted and writable:

```bash
docker compose exec backend ls -la /app/uploads
```

### Invoice PDF does not reflect latest changes

Code changes require rebuilding containers in this Dockerized setup:

```bash
docker compose up -d --build backend nginx
```

If invoice content/layout changed, generate a **new** invoice PDF. Existing saved PDFs are not auto-regenerated.

### Settings changes not visible

For Settings/Frontend UI updates (backup controls, snapshot actions, modal/form layout), rebuild frontend + nginx:

```bash
docker compose up -d --build frontend nginx
```

For backup logic or invoice backend behavior updates, rebuild backend too:

```bash
docker compose up -d --build backend frontend nginx
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
          ├── Recruiters.jsx
            ├── Expenses.jsx
            ├── Timesheets.jsx
            ├── Invoices.jsx
          ├── Tax.jsx
          ├── Reports.jsx
          ├── Settings.jsx
          ├── Resources.jsx
          ├── SecurityGateModalHost.jsx
            └── FileViewer.jsx
```

---

## License

MIT — For personal and commercial use by sole proprietors.
