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
5. ✅ Production management (jobs, kanban board at `/production`, attached to sales orders) — `src/lib/production.ts`
6. ✅ Inventory / Purchasing (movement ledger, PO receiving) — `src/lib/inventory.ts`
7. ✅ Shipping (shipments + tracking links, portal visibility) + accounting CSV export — `src/lib/shipping.ts`
8. ✅ Dashboards & reporting (dashboard at `/`) — `src/lib/reporting.ts`

**Deferred — need the shop's own external accounts/keys, so left as manual/export paths:**

- Carrier rate/label APIs (EasyPost/Shippo/UPS) — tracking is entered manually; CSV/deep-links cover the rest
- QuickBooks/Xero OAuth sync — the `/api/export/accounting` CSV is the offline path

**Stripe online card payments** (customer portal). Hosted Checkout — we never see card data and there's no client-side Stripe.js. Config is optional: with `STRIPE_SECRET_KEY`/`APP_URL` unset the Pay button simply doesn't render (`stripeConfigured()`), so the app runs fine without it.

The rule the whole design hangs on: **the webhook (`src/app/api/stripe/webhook/route.ts`) is the sole writer of payments, and it records what Stripe actually captured (`amount_total`) — never a figure recomputed from the current balance.** A `SENT` invoice stays editable, so staff can change the total mid-checkout; re-validating there would reject money Stripe already took. Consequences to preserve if you touch this:

- `validatePaymentAmount` is a pre-authorization guard for the **admin form only** — never call it from the webhook. Use `applyPaymentToInvoice`, which absorbs overpayment instead of rejecting (overpayments get flagged in `Payment.notes` and surfaced on the admin invoice page).
- Gate on `session.payment_status === "paid"`, **not** `status === "complete"` — async methods complete the session before the money lands. All of this decision logic is pure and tested in `src/lib/stripe-webhook.ts`.
- Idempotency is `Payment.stripePaymentIntentId @unique` — keyed on the PaymentIntent, not the session, because refund/dispute events carry only a PI. P2002 is caught _outside_ the transaction (a unique violation aborts it) and treated as success.
- `Payment.method` comes from what Stripe says was actually used (`mapStripePaymentMethod` on the charge's `payment_method_details.type`), not from our session config. Sessions are pinned to `payment_method_types: ["card"]`, but that's configuration — the mapping keeps the accounting export honest if it ever changes. Unrecognised types (including `link`) become `OTHER` rather than a guessed `CARD`; the raw Stripe type goes in `Payment.notes`. The lookup runs **outside** the transaction (Prisma's 5s interactive timeout) and falls back to `OTHER` on failure rather than dropping the payment.
- Payment writes are **uniformly incremental** (`{ increment }` / `{ decrement }`) inside interactive transactions. The `UPDATE` takes a row lock held to commit, serializing the webhook against staff entry; its return value is the post-increment row. Never mix in an absolute `amountPaid` write — that's what loses payments.
- The success redirect **never writes**. It re-checks the session read-only (`justPaid`) before showing anything, since `?paid=1` is spoofable, and shows a "confirming" state rather than a premature "Paid" while the webhook is in flight.

**PDF export** (`@react-pdf/renderer`): shared styling, brand colors, and the logo loader live in `src/lib/pdf-shared.ts` — both document templates import from it, so a styling change applies to all PDFs at once. **Internal notes are never included in any PDF**, only customer-facing `terms` (the `load*PdfData` loaders deliberately don't select `notes`). The embedded logo is a pre-downscaled `public/logo-pdf.png` (256px), not the full-size nav logo — react-pdf embeds raw image bytes with no resizing, so using the original would bloat every PDF to 1.5MB+.

- **Invoices** — `src/lib/invoice-pdf.tsx` + `invoice-pdf-data.ts`. Routes: `/api/invoices/[id]/pdf` (admin, gated by the normal session) and `/api/portal/[token]/invoices/[id]/pdf` (customer, verifies token ownership and excludes DRAFT invoices — 404 on any mismatch, never 403). Includes the paid/balance-due block.
- **Sales orders** — `src/lib/sales-order-pdf.tsx` + `sales-order-pdf-data.ts`, route `/api/sales-orders/[id]/pdf` (admin only — sales orders aren't portal-exposed). Titled "SALES ORDER" and **omits the paid/balance-due block**, since it's an order confirmation, not a bill.
- **Quotes** — `src/lib/quote-pdf.tsx` + `quote-pdf-data.ts`. Routes: `/api/quotes/[id]/pdf` (admin) and `/api/portal/[token]/quotes/[id]/pdf` (customer, same ownership + DRAFT-exclusion checks as the invoice portal route). Titled "QUOTE", shows "valid until" instead of a due date, and omits the paid/balance-due block. `QuotePdfData.status` isn't rendered — it exists so the portal route can exclude drafts.

**Quick customer creation** (`src/components/quick-customer-dialog.tsx`): the "+ New" button beside the customer picker on quote/invoice forms opens a dialog to create a customer inline via the existing `createCustomer` action, without losing the in-progress document form state. Its content is a `<div>`, not a `<form>` — the dialog is portaled but stays a React-tree descendant of `DocumentForm`'s own `<form>`, so a nested form would risk its submit bubbling into the outer one.

**Sales orders** sit between Quote and Invoice: `Quote` (non-binding estimate) → `SalesOrder` (locked-in production blueprint, `src/lib/actions/sales-orders.ts`) → `Invoice`. Conversion goes through `convertQuoteToSalesOrder` and `convertSalesOrderToInvoice` (both mirror the old copy-everything-into-a-transaction pattern — customer, line items, and totals are copied field-for-field, never recomputed). A sales order can also convert **back** into a fresh quote via `convertSalesOrderToQuote`, but only while it's `DRAFT`/`CONFIRMED` and has no `Job` yet — once production has started or it's been invoiced, reversal is blocked. Production (`Job`) attaches to `SalesOrder`, not `Quote` — a job only exists once an order is actually confirmed. Proofs/art-approval still live on `Quote` (informational only; nothing gates job creation on proof approval), reachable from a job's page via `salesOrder.sourceQuote` when the order originated from one. `Invoice.sourceQuoteId` still exists as a legacy field (pre-sales-order invoices) but new invoices set `sourceSalesOrderId` instead.

**Document discounts** are one per document (quote / sales order / invoice), either a percentage of the subtotal or a flat dollar amount — `DiscountType` + `discountValue` (the input) alongside `discountAmount` (the resolved dollars), all persisted so a document stays a stable historical record. The arithmetic lives in `resolveDiscount`/`computeDocumentTotals` in `src/lib/money.ts` and is tested, including against a real imported YoPrint invoice so we match what the shop's previous system produced.

Two rules worth preserving if you touch this:

- **`subtotal` stays pre-discount**; `total = subtotal - discountAmount + taxAmount`.
- **Tax is charged on the discounted amount**, and when a document mixes taxable and non-taxable lines the discount is split across them in proportion to their share of the subtotal — otherwise a discount aimed at untaxed goods would wrongly cut the tax owed. A discount larger than the subtotal is capped rather than producing a negative total (credit notes aren't modelled).

Note for PDFs: `@react-pdf/renderer`'s built-in Helvetica can't encode U+2212 (−), which drops silently and makes a negative line read as positive. Use a plain ASCII hyphen in PDF templates.

**Setup/screen fees** are a pricing primitive (`SetupFeeTier`, one fee per grid tier). They are **one-time per order — never multiplied by piece quantity**, which is why they live in their own model rather than as another `PriceCell`, resolve by exact tier match (`resolveSetupFee`, not a quantity-break lookup), and land on their own quote line at qty 1 rather than folding into the per-piece unit price. Keep that separation if you touch this.

## Money = tests

Anything touching money — pricing, tax, totals, discounts, payments — **must have tests**. No exceptions.

## Auth

- The admin area is gated by `src/proxy.ts` (Next 16 renamed `middleware`→`proxy`), which verifies a signed session cookie via `src/lib/auth/session.ts` (HMAC over `AUTH_SECRET`, no DB lookup). It also covers server actions and admin API routes.
- **`/login`, `/portal/*`, and `/api/portal/*` are intentionally public** — the customer portal has its own per-customer token auth. Don't gate them.
- **`/api/stripe/webhook` is also reachable without a session**, but by a different mechanism: it's excluded from the proxy's `matcher` (not added to `PUBLIC_PREFIXES`) so the raw body arrives unbuffered for signature verification. Its credential is the Stripe signature. Keep the exclusion path-exact — a `/api/stripe` prefix would silently make future routes public.
- Passwords are scrypt-hashed (`src/lib/auth/password.ts`), no external auth service. Create the first staff login with `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin` (operator sets the password; always ADMIN role; never seeded).
- Requires `AUTH_SECRET` in `.env` (see `.env.example`).
- **Roles**: `ADMIN` (users, pricing/markup config) vs `STAFF` (everything else). Checked live per request via `getCurrentUser()` — not baked into the session token, so a role change takes effect immediately. Page guard: `requireAdminPage()` (redirects to `/`); action guard: `requireAdminAction()` / the pattern in `src/lib/actions/users.ts`. `src/lib/auth/roles.ts` has `isLastAdmin` — deleting/demoting the sole admin is blocked to prevent lockout. Manage staff at `/users` (admin-only); self-service password change at `/account`.

## Conventions (cont.)

- shadcn/ui here is built on **Base UI, not Radix**: use the `render` prop + `nativeButton={false}` for link-buttons, not `asChild`; `Select` takes an `items` prop.
- Admin pages live in the `(admin)` route group (shared nav); the customer portal is under `/portal/[token]` with its own layout and no nav.
- Documents copy their values at creation (quote→sales order→invoice totals, applied grid prices) so later edits to grids/pricing never rewrite history.
- Prisma migrations are non-interactive here: `printf 'y\n' | script -q /dev/null npx prisma migrate dev --name <name>`.

## Environment notes

- Node is nvm-managed (`~/.nvm/versions/node/v22.23.1/bin`); shells here may need that on PATH explicitly.
- Local Postgres runs from `~/.pgdata-printshop` (db `printshop`) and does not auto-start; start with:
  `export LC_ALL=en_US.UTF-8 && /usr/local/opt/postgresql@16/bin/pg_ctl -D ~/.pgdata-printshop -l ~/.pgdata-printshop/server.log start`
- **After every migration, restart the dev server** — the long-running Next dev process caches the old Prisma client and errors with "Unknown field" until restarted (the build always uses the fresh client from disk).

## Production

- Hosted on a Hostinger VPS (Ubuntu 24.04) at `https://customdesk.io`, app code in `/var/www/dzcp` (deployed via `git pull` — GitHub deploy key, read-only), Node 22, Postgres 16, nginx reverse proxy with Let's Encrypt SSL (auto-renews via certbot), running under systemd as `dzcp.service`.
- **To deploy**: `ssh dzcp-vps-deploy` then `/var/www/dzcp/scripts/deploy.sh` — pulls `main`, installs deps, runs `prisma migrate deploy`, builds, restarts the service, and health-checks it.
- First admin login is created the same way as locally (`npm run create-admin`, operator sets the password directly on the server — never hand it to an assistant).
