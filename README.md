# Pikavolt

Platform monorepo for **Pikavolt LLC** — an electrical contractor serving Central
Ohio (residential, commercial, agricultural) with 24/7 emergency service.

> Powering Ohio with Quality You Can Trust.

Content source of truth: [`docs/owner-content.md`](docs/owner-content.md).

## Layout

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js 15 (App Router, Tailwind CSS v4) customer site + owner admin |
| `apps/mobile` | Flutter owner app (created separately) |
| `packages/core` | `@pikavolt/core` — shared domain logic: appointment state machine, pricing, slot computation, API zod schemas |
| `packages/config` | `@pikavolt/config` — shared tsconfig base, ESLint flat config base, brand tokens (TS + CSS) |
| `packages/db` | Supabase migrations & seed (managed separately) |

## Getting started

Requires Node 22+ and pnpm 11+.

```sh
pnpm install
cp .env.example apps/web/.env.local   # fill in real values
pnpm dev                              # turbo dev (or: pnpm --filter web dev)
```

The web app boots without env vars (auth/session features are inert until
Supabase env vars are provided).

## Commands

```sh
pnpm build       # turbo build (packages first, then apps)
pnpm lint        # eslint everywhere
pnpm typecheck   # tsc --noEmit everywhere
pnpm test        # vitest (packages/core)
```

## Brand

Dark theme IS the brand: storm `#0A0A0F` background, surface `#12121A`, volt
yellow `#FFE600` primary, arc gradient `#3B82F6 → #22D3EE`, emergency red
`#FF3B30`. Fonts: Anton (display) + Inter (body). Tokens live in
`packages/config` (`tokens.css`, `src/tokens.ts`) and the `@theme` block in
`apps/web/src/app/globals.css`.

## Frozen contracts

Other agents build against the exact exports of `@pikavolt/core`
(`canTransition`, `TRANSITIONS`, `computeDeposit`, `computeFinal`,
`computeSlots`, and the zod schemas in `src/schemas.ts`). Do not rename or
change their semantics without coordinating across web, mobile, and db.

## Placeholders to replace before launch

- Owner phone number `(614) 555-0199`
- Logo (`apps/web/public/logo.svg` + `Logo.tsx` bolt mark)
