# Runway

A single-user, self-hosted personal finance tool. **Not a budgeting app** — its
job is *awareness*: always know where you stand today, and where your habits are
taking you.

The name is the metric. The hero number is a **runway date** — *"At this pace you
hit your floor on the 23rd."*

> **The soul:** it never lies, in either direction. It doesn't scare, doesn't
> soothe, doesn't pad a number.

> **The one rule (the unit test for the whole app):** paying a known, *fixed*
> commitment must **not** change your safe-to-spend.

## Status

**Runway is feature-complete — all phases (0–13) built and test-gated.** The
spine (auth, schema, engine, money, logging, gauge, reconcile) plus all five
layers (subscription audit, pace, replay, what-if, AI analyst). 52 unit tests
green. See [`ROADMAP.md`](./ROADMAP.md) and [`SOAK.md`](./SOAK.md).

Layers (Movement 3):

| Phase | Layer |
|-------|-------|
| 9  | Subscription audit — names every recurring charge |
| 10 | Pace — "faster than normal", curve-based, speaks only when sure |
| 11 | Replay — the month's story, ranked by surprise |
| 12 | What-if — two futures side by side, reusing the engine |
| 13 | AI analyst — ask-anything, grounded only in your data |

| # | Phase | State |
|---|-------|-------|
| 0 | Foundation — Next.js + Supabase SSR, env guards, route gate | ✅ |
| 1 | Auth — password + mandatory TOTP, allowlist of one, no email | ✅ |
| 2 | Schema — all tables, category enum, RLS on everything | ✅ |
| 3 | Engine — safe-to-spend, pure & test-gated (4 invariants green) | ✅ |
| 4 | Money in/out — income + commitments (monthly + sinking) + cycles | ✅ |
| 5 | Logging — deterministic parse → Gemini fallback, alias learning | ✅ |
| 6 | Gauge — the "since you last looked" diff greeting | ✅ |
| 7 | Reconcile — CSV import, matching, cash/refund/transfer rules | ✅ |

## Stack

Next.js (App Router, 16) · TypeScript · Tailwind v4 · shadcn/ui · Supabase
(Postgres + Auth, `@supabase/ssr`, current publishable/secret keys) · Google
Gemini (`@google/genai`, server-only) · Vitest. Currency ZAR, locale en-ZA.

## Getting started

See [`SETUP.md`](./SETUP.md) for the full walkthrough. In short:

```bash
npm install
# 1. Create a Supabase project; put URL + publishable + secret keys in .env.local
# 2. Apply the schema: supabase/migrations/0001_init.sql (SQL Editor or `supabase db push`)
# 3. Disable signups + enable TOTP in the Supabase dashboard
# 4. Set OWNER_EMAIL + OWNER_PASSWORD in .env.local, then:
npm run seed:owner
npm run dev
```

Open <http://localhost:3000> → **Enter** → email + password → authenticator code → `/today`.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm test` | Run the Vitest suite (engine + parser + greeting + reconcile) |
| `npm run seed:owner` | Create the single owner user + settings row |

## How it's built

- **The engine** (`lib/engine/`) is a pure, fully-tested function over a snapshot
  of the open cycle — no I/O — so the four invariants (fixed-commitment net-zero,
  sinking-fund steady, variable-bill returns the difference, lump level-not-rate)
  are proven before any UI depends on them.
- **Everything is RLS-scoped to `auth.uid()`**; sessions are httpOnly cookies;
  secrets are isolated behind `import 'server-only'` so they can't reach the
  browser bundle. The Supabase secret key is used only by the seed script.
- **Logging is deterministic-first** (regex + your learned aliases, offline) and
  only calls Gemini when the input is genuinely ambiguous; it never hard-fails.
- **Reconcile treats the bank statement as truth**, and keeps refunds and
  internal transfers out of income by construction.

## Security

Password + mandatory TOTP, with three locks against signup (in-app signup
disabled, a server-side allowlist of one email, and signups turned off in
Supabase). No email is ever sent. `.env.local` is gitignored. See `SETUP.md`.

## License

Personal project — all rights reserved (for now).
