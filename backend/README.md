# Media Octus CRM — Backend

API for the OOH advertising CRM. **Node.js + Express + MongoDB (Mongoose)**, in TypeScript.

Setup, demo accounts and the auth API are in the [root README](../README.md).
The rules that get a PR sent back are in [CONTRIBUTING.md](../CONTRIBUTING.md).
This file covers how the server is put together.

---

## Versions

These are what the project is built and tested against. Newer patch/minor
versions are generally fine; check the changelog before a **major** bump.

| Layer | Package | Version |
|---|---|---|
| Runtime | Node.js | 22.x LTS |
| Framework | Express | 5.x |
| ODM | Mongoose | 9.x |
| Database | MongoDB | 7.x / Atlas |
| Language | TypeScript | 5.7.x |
| Dev runner + test runner | tsx (`node:test`) | 4.x |
| Validation | Zod | 3.x |
| Hashing | bcryptjs | 2.4.x |
| Tokens | jsonwebtoken | 9.x |

Not installed yet, added when the module that needs them lands: `sharp`
(watermarking), `pdfkit` (documents), `node-cron` (scheduled jobs), the object
storage SDK.

> Mongoose 9 renamed `FilterQuery` to `QueryFilter`. If you copy a snippet off
> the internet and the type does not resolve, that is usually why.

---

## Structure

```
src/
├── config/index.ts         The only place process.env is read. Add new env vars here.
│
├── core/                   ⚠️ Shared foundation — discuss before changing
│   ├── audit/              Global change log — records every mutation automatically
│   ├── files/              Upload service behind a storage adapter
│   ├── pdf/                Document rendering — quotations, POs, reports
│   ├── auth/               Login, OTP, JWT + refresh tokens, requireAuth
│   │   ├── auth-model.ts           users
│   │   ├── otp-model.ts            OTP challenges (hashed code, TTL index)
│   │   ├── refresh-token-model.ts  hashed, rotating refresh tokens
│   │   ├── auth-service.ts         the flow
│   │   ├── auth-controller.ts      request → service → response
│   │   ├── auth-routes.ts          paths + permissions
│   │   ├── auth-validator.ts       Zod schemas
│   │   ├── auth-middleware.ts      requireAuth → builds req.ctx
│   │   └── auth-service.test.ts
│   ├── rbac/               permissions.ts (THE matrix) + requirePermission/requireRole
│   ├── scoping/            scopedFind() — row-level security
│   ├── notifications/      notify() — in-app + email, behind one transport seam
│   ├── errors/             AppError, ValidationError, ConflictError, …
│   ├── http/               asyncHandler + the central error handler
│   ├── db/                 connect.ts, basePlugin.ts
│   └── context.ts          the RequestContext type behind req.ctx
│
├── modules/                One folder per feature — this is where you work
│   └── employees/          ⭐ G1 — THE REFERENCE MODULE. Read its README first.
│
├── jobs/                   node-cron scheduler + the concurrency lock
├── scripts/seed.ts         Demo users, one per role
├── app.ts                  Express app, middleware, router mounting
└── server.ts               Entry point — connects the DB, starts listening
```

Planned module folders, from the developer spec: `leads` (A1–A4), `quotations`
(B1–B3), `sites` (C1), `bookings` (C2), `vendors` (C3), `purchase-orders` (C4),
`campaigns` (D1), `tasks` (D2–D3), `escalations` (D4), `proofs` (E1–E4),
`payments-in` (F1), `payments-out` (F2), `finance` (F3–F5), `attendance` (G2),
`leave` (G3–G4), `audit` (H1), `exceptions` (H2).

`employees` (G1) is already built. Each module contains exactly six files —
see `modules/employees/README.md` for what belongs in each one.

---

## Request flow

```
1. Client       →  GET /api/leads
2. app.ts       →  matching router
3. routes.ts    →  requireAuth  →  requirePermission('leads.view')
4. controller   →  parses query/body/params, validates with Zod
5. service      →  business logic + scopedFind(Model, filter, ctx)
6. model        →  MongoDB
7. response     ←  back through the controller
```

Any thrown error skips straight to the central handler in `core/http/error-middleware.ts`,
which returns `{ error: { code, message, details? } }`. Duplicate keys, Zod
failures and Mongoose validation errors are all translated there — a raw driver
error never reaches the client.

---

## The auth flow in detail

```
POST /api/auth/login          email + password
     ├─ bcrypt.compare against the stored hash
     ├─ account must be Active and not soft-deleted
  ├─ if not enrolled: send bootstrap email code
  ├─ if enrolled: create a TOTP challenge
  └─ → { challengeId, method, expiresAt }

POST /api/auth/verify-otp     challengeId + code
  ├─ verify email code for first-time enrollment, or the authenticator code
  ├─ first login → return a QR enrollment challenge; no session yet
  └─ enrolled login → issue the session after TOTP verification

POST /api/auth/complete-mfa-enrollment  enrollmentToken + TOTP code
  └─ confirm authenticator, then issue the first session

POST /api/auth/email-fallback  challengeId
  └─ explicitly replace a TOTP challenge with an emailed code

POST /api/auth/refresh        refreshToken
     └─ look up by hash, issue a new pair, revoke the old one (rotation)
```

Security properties worth preserving if you touch this: email OTPs and refresh
tokens are stored hashed; TOTP secrets are AES-GCM encrypted; authenticator time
steps cannot be reused; wrong-password and unknown-email return the same
message; challenges and refresh tokens expire via TTL indexes.

`OTP_EXPOSE_IN_RESPONSE` adds a development-only manual code hint and is
force-disabled when `NODE_ENV=production`. Production must set
`MFA_ENCRYPTION_KEY` to 32 random bytes encoded as 64 hexadecimal characters.
For real email delivery, set `OTP_DELIVERY=email`, `EMAIL_PROVIDER=resend`,
`EMAIL_API_KEY`, and a verified `EMAIL_FROM` sender.

### Login risk approvals and location privacy

The login page requests browser location once when the user submits credentials;
it does not track continuously. The backend rounds reported coordinates to
three decimal places (roughly 100 m) and stores them with accuracy in a login
event (retained for 180 days). A device becomes trusted after its first login
that completes MFA (after admin approval); its baseline location is saved only
from a fix within `LOCATION_MAX_ACCURACY_METERS`. No IP/CIDR, office-network,
VPN, or remote-work exception configuration is used by the risk decision.

The device id is a random UUID kept in the browser's localStorage; the server
stores only its SHA-256 hash. Admin screens show the first 8 hex characters as a
device tag. Clearing browser data or switching browser makes it a new device.
Each user has **one** trusted device: when a new device completes approval and
MFA it replaces the previous one, which is revoked (kept for history) and needs
approval again if it is used later. The replacement is audit-logged.

Admins see a user's approved device and active sessions on the user profile
(`GET /api/auth/users/:id/security`). **Sign out everywhere**
(`POST …/revoke-sessions`) revokes refresh tokens and sets `sessionsRevokedAt`;
`requireAuth` loads the account on every request and rejects access tokens
issued before that instant, and any token for an inactive account, so the user
is cut off immediately rather than when the 15-minute access token expires.
**Remove device** (`POST …/remove-device`) also revokes the trusted device, so the
next sign-in needs approval.

Approval is required for:

- a **new device** — always, wherever it claims to be;
- an approved device reporting an accurate location **outside every office** in
  `OFFICE_LOCATIONS` (or, with no offices configured, more than
  `LOCATION_CHANGE_RADIUS_METERS` from its baseline, accounting for both
  accuracy estimates);
- a missing or inaccurate location, **only** when `LOCATION_REQUIRED=true`.
  Otherwise it is logged and admins are alerted, because many laptops cannot
  report an accurate fix.

`OFFICE_LOCATIONS` is a JSON array of `{name, lat, lng, radiusMeters}`
(`radiusMeters` ≥ 100); a malformed value stops the server at startup. A pending
request expires after five minutes. Admin approval applies to one attempt only;
the user must still complete MFA.

If no other active admin has an authenticator enrolled, nobody could decide an
approval, so a high-risk login skips it, goes straight to MFA, and is recorded in
the audit log. Approval resumes automatically once a second admin enrols.

Browser GPS can be denied or spoofed and is not proof of identity, so location
never upgrades a new device; it only restricts approved ones. The login screen
explains the one-time location request.

---

## Cross-cutting services

Four things every module gets for free. None of them need setting up per module.

### Audit log — `core/audit`

`auditMiddleware` is mounted once in `app.ts` and records **every successful
create/update/delete automatically**: who, what, which record, when, outcome.
You write no code for this. Sensitive fields (passwords, tokens, PAN, Aadhaar,
bank details) are masked on the way in — the log is read by more people than the
records it describes, and it is never deleted.

What it cannot capture is before/after values. When you want a real diff, add an
explicit entry from your service — both can coexist:

```ts
await auditService.record({
  ctx,
  action: 'update',
  entity: 'leads',
  entityId: lead.id,
  changes: diffFields(before, after, ['status', 'assignedTo']),
});
```

Add any new sensitive field name to `core/audit/redact.ts`.

### Notifications — `core/notifications`

One function. It writes the in-app record and optionally emails, so your module
never has to know which channels are switched on:

```ts
await notify({
  userId: lead.claimedBy,
  type: 'leads.assigned',
  title: 'New lead assigned',
  body: `${lead.companyName} is now yours.`,
  link: `/leads/${lead.id}`,
  email: true,
});
```

Best-effort by design — a notification failure never fails the operation that
triggered it. `notifyMany(userIds, {...})` covers "tell every eligible agent".

### Files — `core/files`

Uploads go through `fileService`, which sits behind a `StorageAdapter`. Local
disk in development, S3-compatible object storage (R2 / B2) in production —
switching is one env variable and no module changes.

```ts
router.post('/:id/photo', requireAuth, requirePermission('proofs.upload'),
  uploadSingle('photo'), asyncHandler(controller.uploadPhoto));

const stored = await fileService.save(req.file, { folder: 'proofs', ctx });
// persist stored.key — never stored.url, which expires with object storage
```

Keys are generated server-side, never taken from the client. Resolve a key to a
URL at read time with `fileService.url(key)`.

### PDFs — `core/pdf`

`renderPdf()` returns a Buffer with the company header, footer and page numbers
already drawn, plus `lineItemsTable()` and `keyValueBlock()` helpers. Money
arrives as paise and `formatPaise` converts at render time.

```ts
const buffer = await renderPdf({ title: 'Quotation', reference: quote.quoteNumber, build: (doc) => { ... } });
const stored = await fileService.saveBuffer({ buffer, folder: 'quotations', filename: `${quote.quoteNumber}.pdf`, contentType: 'application/pdf' });
```

---

## Scheduled jobs — `src/jobs`

Register your job in `jobs/index.ts`; put the implementation in
`jobs/<name>.job.ts`. Off locally by default (`JOBS_ENABLED=false`) so seven
developers do not each fire the nightly rollups.

Two rules the spec is emphatic about, both handled by `withJobLock`:

- **Idempotent.** The escalation job sees the same overdue task every 15 minutes.
  That must not send fifteen emails an hour.
- **Safe to run twice concurrently.** Under PM2 cluster mode two processes fire
  the same cron; the lock makes the second a no-op.

```ts
{
  name: 'escalation',
  schedule: '*/15 * * * *',
  lockTtlSeconds: 15 * 60,
  description: 'D4 — escalate overdue tasks',
  run: escalationJob,
}
```

`runJobNow('escalation')` runs one immediately, still respecting the lock —
that is what H1's "run now" button calls.

---

## Non-negotiable rules

1. Never `Model.find()` directly — use `scopedFind(Model, filter, ctx)`.
2. Money is integer paise. ₹1,250.50 is `125050`. Never floats.
3. No cross-module imports — go through the other module's exported service.
   `employeeService` is the pattern: `listManagerOptions` exists so other modules
   can resolve a manager without importing the `Employee` model.
4. Every schema gets `basePlugin`.
5. Soft deletes only — set `deletedAt`, never remove a record.
6. Server-side validation on every input.
7. Every route declares `requirePermission('module.action')`.
8. Don't edit `core/` — discuss first.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server, reloads on change |
| `npm run seed` | Create the demo users (`-- --reset-passwords` to reset them) |
| `npm test` | `node:test` via tsx, all `src/**/*.test.ts` |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint — also enforces the no-cross-module-import and no-query-in-controller rules |
| `npm run format` | Prettier over `src/` (also runs on staged files pre-commit) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled build |

## Environment

Copy `.env.example` to `.env` — every variable is documented there. The defaults
work for local development as-is; only `JWT_SECRET` should be replaced with your
own value before anything is deployed:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Node does not hot-reload environment variables — restart the dev server after
editing `.env`.
