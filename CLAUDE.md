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
3. ✅ Pricing engine (grids + garment markup, line calculator) — `src/lib/pricing.ts`
4. ✅ Art approval (versioned proofs on quotes, files under `uploads/`) — `src/lib/proofs.ts`
5. ✅ Production management (jobs, kanban board at `/production`) — `src/lib/production.ts`
6. ✅ Inventory / Purchasing (movement ledger, PO receiving) — `src/lib/inventory.ts`
7. ✅ Shipping (shipments + tracking links, portal visibility) + accounting CSV export — `src/lib/shipping.ts`
8. ✅ Dashboards & reporting (dashboard at `/`) — `src/lib/reporting.ts`

**Deferred — need the shop's own external accounts/keys, so left as manual/export paths:**
- Stripe online card payments (slot: portal invoice page)
- Carrier rate/label APIs (EasyPost/Shippo/UPS) — tracking is entered manually; CSV/deep-links cover the rest
- QuickBooks/Xero OAuth sync — the `/api/export/accounting` CSV is the offline path

**Known gap:** setup/screen fees are still manual line items, not a pricing primitive.

## Money = tests

Anything touching money — pricing, tax, totals, discounts, payments — **must have tests**. No exceptions.

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
