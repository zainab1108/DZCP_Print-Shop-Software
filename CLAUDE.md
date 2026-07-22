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

## Roadmap (build in this order)

1. Customers / Quotes / Invoices
2. Payments / Customer portal
3. Pricing engine
4. Art approval
5. Production management
6. Inventory / Purchasing
7. Shipping / Integrations
8. Dashboards & reporting

## Money = tests

Anything touching money — pricing, tax, totals, discounts, payments — **must have tests**. No exceptions.

## Environment notes

- Node is nvm-managed (`~/.nvm/versions/node/v22.23.1/bin`); shells here may need that on PATH explicitly.
- Local Postgres runs from `~/.pgdata-printshop` (db `printshop`) and does not auto-start; start with:
  `export LC_ALL=en_US.UTF-8 && /usr/local/opt/postgresql@16/bin/pg_ctl -D ~/.pgdata-printshop -l ~/.pgdata-printshop/server.log start`
