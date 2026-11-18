# Media Octus CRM

OOH advertising CRM — leads, quotations, inventory, campaigns, proof of display, finance and HR in one modular monolith.

| | |
|---|---|
| **Backend** | Node 22 · Express 5 · MongoDB (Mongoose 9) · TypeScript |
| **Frontend** | Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TypeScript |
| **Docs** | `MediaOctus_CRM_Developer_Spec.md` — find your section number and build it |

> **Read `CONTRIBUTING.md` before you write any code.** It has the rules that get a PR sent back if you break them.
>
> Then read the **reference module**: `backend/src/modules/employees/README.md`.
> Every other module copies its structure.

---

## Run it locally (clean clone → working app in ~5 minutes)

### 0. Prerequisites

- **Node.js 22 LTS** and npm 10+
- **MongoDB 7** running locally, or an Atlas connection string

MongoDB should run as a **single-node replica set** — multi-document transactions
(bookings, payments, payroll) do not work on a standalone `mongod`. It behaves
exactly like standalone otherwise, so set it up now rather than in week 6:

```bash
mongod --replSet rs0 --dbpath /path/to/data
# then once, in mongosh:
rs.initiate()
```

Auth and everything built so far works fine on standalone too, so this will not
block you on day one.

### 1. Backend

```bash
cd backend
cp .env.example .env      # the defaults work as-is for local development
npm install
npm run seed              # creates one demo user per role
npm run dev               # http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev               # http://localhost:3000
```

Open <http://localhost:3000> and sign in.

**If it does not run from a clean clone, say so in the group chat immediately.**
Do not spend hours debugging setup.

---

## Signing in

Login is **two steps**: email + password, then a 6-digit code.

**You do not need an email account.** In development the code is printed to the
backend log *and* returned in the login response, so the login screen shows it
and fills it in for you. Click **Verify and sign in**.

### Demo accounts

`npm run seed` creates these. Password for all of them: **`Password123!`**

| Email | Role |
|---|---|
| `admin@mediaoctus.test` | Administrator |
| `manager@mediaoctus.test` | Manager |
| `sales@mediaoctus.test` | Sales Agent |
| `ops@mediaoctus.test` | Operations |
| `finance@mediaoctus.test` | Finance |
| `hr@mediaoctus.test` | HR |
| `employee@mediaoctus.test` | Employee |

Sign in as at least two of these when testing your module — that is how you find
out whether your permissions are actually enforced. It is on the Definition of Done.

To reset their passwords back to the default: `npm run seed -- --reset-passwords`.

---

## Where things live

```
backend/src
  config/          the only place process.env is read
  core/            ⚠️ shared foundation — discuss before changing
    auth/          login, OTP, JWT + refresh tokens, requireAuth
    rbac/          the permission matrix and requirePermission()
    scoping/       scopedFind() — row-level security
    audit/         records every mutation automatically
    notifications/ notify() — in-app + email
    files/         uploads behind a storage adapter
    pdf/           document rendering
    db/            connection, base schema plugin, atomic sequences
    errors/        AppError and friends
    http/          asyncHandler + the central error handler
  modules/
    employees/     ⭐ G1 — the reference module. Copy this. Start with its README.
  jobs/            node-cron scheduler + concurrency lock
  scripts/seed.ts  demo data

frontend/src
  app/             routes (App Router)
  shared/          design system, api client, auth — used by every module
    api/           the fetch wrapper; never call fetch() directly
    auth/          AuthProvider, useAuth, RequireAuth
    layout/        AppShell — header and navigation
    ui/            Button, Field, Alert, Card, Badge, EmptyState, Spinner
  modules/
    employees/     ⭐ the reference module's frontend half
```

---

## Scripts

**Backend** (`cd backend`)

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with reload |
| `npm run seed` | Create the demo users |
| `npm test` | Run tests |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint (also enforces the no-cross-module-import rule) |
| `npm run format` | Prettier over `src/` |
| `npm run build` / `npm start` | Compile to `dist/` and run it |

**Frontend** (`cd frontend`)

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run format` | Prettier over `src/` |

**Both at once** (`cd code`)

| Command | What it does |
|---|---|
| `npm install` | Installs the pre-commit hook and Prettier |
| `npm run check` | Typecheck + lint + tests across both apps |
| `npm run format` | Prettier over both apps |

A pre-commit hook formats staged files, so no review is ever about whitespace.
It activates once the repo exists — run `npm install` in `code/` after `git init`.

---

## Auth API

| Method | Path | Who | What |
|---|---|---|---|
| `POST` | `/api/auth/login` | public | Step 1 — email + password, returns a `challengeId` |
| `POST` | `/api/auth/verify-otp` | public | Step 2 — `challengeId` + `code`, returns the session |
| `POST` | `/api/auth/resend-otp` | public | New code for an existing challenge (30s cooldown) |
| `POST` | `/api/auth/refresh` | public | Rotates the refresh token, returns a new access token |
| `POST` | `/api/auth/logout` | authenticated | Revokes this device's refresh token |
| `GET` | `/api/auth/me` | authenticated | The current user and their permission list |
| `POST` | `/api/auth/register` | `users.create` | Creates a user — admin only, not self-signup |
| `GET` | `/api/health` | public | Liveness check |

### Employees (G1 — the reference module)

| Method | Path | Permission |
|---|---|---|
| `GET` | `/api/employees` | `employees.view` — paged, filtered, searchable |
| `GET` | `/api/employees/me` | `employees.self` — every role has this |
| `GET` | `/api/employees/manager-options` | `employees.view` |
| `GET` | `/api/employees/:id` | `employees.view` |
| `GET` | `/api/employees/:id/reports` | `employees.view` — direct reports |
| `POST` | `/api/employees` | `employees.manage` |
| `PATCH` | `/api/employees/:id` | `employees.manage` |
| `DELETE` | `/api/employees/:id` | `employees.manage` — soft delete |

PAN, Aadhaar, bank details and CTC are returned only to roles holding
`employees.sensitive` (Admin, HR, Finance). They are stripped in the service
layer, so they are absent from the JSON rather than hidden in the UI. Sign in as
HR and then as Manager and compare `/employees` — that is the check the
Definition of Done is asking for.

### Other core endpoints

| Method | Path | Who |
|---|---|---|
| `GET` | `/api/notifications` | authenticated — own notifications only |
| `POST` | `/api/notifications/:id/read` | authenticated — own only |
| `POST` | `/api/notifications/read-all` | authenticated |
| `GET` | `/api/files/*` | authenticated — dev storage adapter only |

Access tokens last 15 minutes; the API client refreshes them automatically.
Refresh tokens last 7 days, are stored hashed, and rotate on every use.

Errors always come back as:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ { "field": "email", "message": "…" } ] } }
```

---

## Authenticator MFA and email fallback

On first sign-in, the user verifies the existing email code, scans an authenticator
QR code, and confirms a TOTP code. No session is issued until enrollment is
confirmed. Future sign-ins use the authenticator; users can explicitly request an
email code as a fallback. TOTP secrets are encrypted in MongoDB.

Configure the backend environment using `backend/.env.example`:

| Variable | Dev | Production |
|---|---|---|
| `OTP_DELIVERY` | `console` — the code is printed to the server log | `email` |
| `OTP_EXPOSE_IN_RESPONSE` | `true` — development-only manual code hint | ignored; **force-disabled** when `NODE_ENV=production` |
| `MFA_ENCRYPTION_KEY` | development fallback | required: 32 random bytes encoded as 64 hex characters |

### Configure email delivery

The implemented provider is Resend. Use a verified sender domain, then set
`OTP_DELIVERY=email`, `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, and `EMAIL_FROM`.
Email fallback cannot deliver until these are configured. Never use VPS SMTP for
login codes.
