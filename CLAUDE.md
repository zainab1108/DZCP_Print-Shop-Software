@AGENTS.md

# Print Shop Manager

Self-hosted print shop management + invoicing app replacing YoPrint. Built in stages.

## Tech stack

- **Next.js 16** (App Router, `src/` layout, TypeScript, Turbopack dev)
- **PostgreSQL 16** + **Prisma 7** — connection URL in `prisma.config.ts` via `DATABASE_URL` env var; client uses the `@prisma/adapter-pg` driver adapter; generated client in `src/generated/prisma` (gitignored, regenerated on `npm install`)
- **Tailwind CSS 4** + **shadcn/ui** (components in `src/components/ui`)
- **ESLint** (flat config) + **Prettier** (with Tailwind class sorting) — `npm run lint`, `npm run format`

## Conventions

- TypeScript strict mode; no `any` escapes.
- All DB access goes through Prisma via the singleton in `src/lib/prisma.ts` — never raw `pg` connections.
- UI components: shadcn/ui first; add with `npx shadcn@latest add <component>`.
- API surface: server actions for mutations, route handlers (`src/app/api`) where an HTTP endpoint is genuinely needed. No separate backend.

## Roadmap

All eight stages are complete (tested library shown where money/logic is involved):

1. ✅ Customers / Quotes / Invoices — `src/lib/money.ts`
2. ✅ Payments / Customer portal (`/portal/[token]`, no accounts) — `src/lib/payments.ts`
3. ✅ Pricing engine (grids + garment markup + per-tier setup fees, line calculator) — `src/lib/pricing.ts`. Grids are tagged with a `DecorationMethod` (screen print / DTF / embroidery / laser engraving / promotional — `src/lib/decoration-methods.ts`) and grouped by method on `/pricing` and in the line calculator's grid picker.
4. ✅ Art approval (versioned proofs on quotes, files under `uploads/`) — `src/lib/proofs.ts`
5. ✅ Production management (jobs, kanban board at `/production`) — `src/lib/production.ts`
6. ✅ Inventory / Purchasing (movement ledger, PO receiving) — `src/lib/inventory.ts`
7. ✅ Shipping (shipments + tracking links, portal visibility) + accounting CSV export — `src/lib/shipping.ts`
8. ✅ Dashboards & reporting (dashboard at `/`) — `src/lib/reporting.ts`

**Deferred — need the shop's own external accounts/keys, so left as manual/export paths:**

- Stripe online card payments (slot: portal invoice page)
- Carrier rate/label APIs (EasyPost/Shippo/UPS) — tracking is entered manually; CSV/deep-links cover the rest
- QuickBooks/Xero OAuth sync — the `/api/export/accounting` CSV is the offline path

**Invoice PDF export** (`src/lib/invoice-pdf.tsx`, `@react-pdf/renderer`): `renderInvoicePdf()` builds a customer-facing PDF from `InvoicePdfData` — **internal notes are never included**, only customer-facing `terms` (see `src/lib/invoice-pdf-data.ts`'s `loadInvoicePdfData`, which deliberately doesn't select `notes`). Two download routes share that loader: `/api/invoices/[id]/pdf` (admin, gated by the normal session) and `/api/portal/[token]/invoices/[id]/pdf` (customer, verifies token ownership and excludes DRAFT invoices — 404 on any mismatch, never 403). The embedded logo is a pre-downscaled `public/logo-pdf.png` (256px), not the full-size nav logo — react-pdf embeds raw image bytes with no resizing, so using the original would bloat every PDF to 1.5MB+.

**Quick customer creation** (`src/components/quick-customer-dialog.tsx`): the "+ New" button beside the customer picker on quote/invoice forms opens a dialog to create a customer inline via the existing `createCustomer` action, without losing the in-progress document form state. Its content is a `<div>`, not a `<form>` — the dialog is portaled but stays a React-tree descendant of `DocumentForm`'s own `<form>`, so a nested form would risk its submit bubbling into the outer one.

**Setup/screen fees** are a pricing primitive (`SetupFeeTier`, one fee per grid tier). They are **one-time per order — never multiplied by piece quantity**, which is why they live in their own model rather than as another `PriceCell`, resolve by exact tier match (`resolveSetupFee`, not a quantity-break lookup), and land on their own quote line at qty 1 rather than folding into the per-piece unit price. Keep that separation if you touch this.

## Money = tests

Anything touching money — pricing, tax, totals, discounts, payments — **must have tests**. No exceptions.

## Auth

- The admin area is gated by `src/proxy.ts` (Next 16 renamed `middleware`→`proxy`), which verifies a signed session cookie via `src/lib/auth/session.ts` (HMAC over `AUTH_SECRET`, no DB lookup). It also covers server actions and admin API routes.
- **`/login`, `/portal/*`, and `/api/portal/*` are intentionally public** — the customer portal has its own per-customer token auth. Don't gate them.
- Passwords are scrypt-hashed (`src/lib/auth/password.ts`), no external auth service. Create the first staff login with `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin` (operator sets the password; always ADMIN role; never seeded).
- Requires `AUTH_SECRET` in `.env` (see `.env.example`).
- **Roles**: `ADMIN` (users, pricing/markup config) vs `STAFF` (everything else). Checked live per request via `getCurrentUser()` — not baked into the session token, so a role change takes effect immediately. Page guard: `requireAdminPage()` (redirects to `/`); action guard: `requireAdminAction()` / the pattern in `src/lib/actions/users.ts`. `src/lib/auth/roles.ts` has `isLastAdmin` — deleting/demoting the sole admin is blocked to prevent lockout. Manage staff at `/users` (admin-only); self-service password change at `/account`.

## Conventions (cont.)

- shadcn/ui here is built on **Base UI, not Radix**: use the `render` prop + `nativeButton={false}` for link-buttons, not `asChild`; `Select` takes an `items` prop.
- Admin pages live in the `(admin)` route group (shared nav); the customer portal is under `/portal/[token]` with its own layout and no nav.
- Documents copy their values at creation (quote→invoice totals, applied grid prices) so later edits to grids/pricing never rewrite history.
- Prisma migrations are non-interactive here: `printf 'y\n' | script -q /dev/null npx prisma migrate dev --name <name>`.

## Environment notes

- Node is nvm-managed (`~/.nvm/versions/node/v22.23.1/bin`); shells here may need that on PATH explicitly.
- Local Postgres runs from `~/.pgdata-printshop` (db `printshop`) and does not auto-start; start with:
  `export LC_ALL=en_US.UTF-8 && /usr/local/opt/postgresql@16/bin/pg_ctl -D ~/.pgdata-printshop -l ~/.pgdata-printshop/server.log start`
- **After every migration, restart the dev server** — the long-running Next dev process caches the old Prisma client and errors with "Unknown field" until restarted (the build always uses the fresh client from disk).
