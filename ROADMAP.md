# RUNWAY — Roadmap to Finished

Awareness is the product: always know where you stand today, and where your
habits are taking you. Spine first, gates between phases, layers only once the
spine is a daily habit. The whole thing never lies — in either direction.

## What "finished" means

The spine shipped and lived in, then every deferred layer earned its place
without breaking the one rule. Done when: all four engine invariants stay green;
you open it daily for a full cycle without wanting another tool; the five layers
are in and none can make the hero number lie. That is the hard stop.

## Movement 1 — The Spine

- **Phase 0 — Foundation.** Supabase SSR wiring, env contract, `server-only`
  guards, proxy route gate. *Done: app boots; secrets server-side only.* ✅
- **Phase 1 — Auth.** Enter gate, allowlist-of-one OTP, full TOTP, three signup
  locks, owner seed. *Done: only the owner gets in; signup impossible; pre-auth
  leaks nothing.* ✅
- **Phase 2 — Schema.** All tables + RLS scoped to `auth.uid()`; flat ~9 category
  enum; seed script. *Done: every table RLS-scoped.* ✅
- **Phase 3 — Engine.** Safe-to-spend as a pure, tested function. *Done: the four
  invariant tests are green before any UI.* ✅
- **Phase 4 — Money in/out.** Income + commitments CRUD (monthly + sinking-fund).
  *Done: both commitment paths feed the engine.*
- **Phase 5 — Logging.** Deterministic parse first, Gemini fallback, alias
  learning. *Done: a log takes seconds and never hard-fails.*
- **Phase 6 — Gauge.** The diff greeting. *Done: open shows what changed, never a
  ledger.*
- **Phase 7 — Reconcile.** CSV import + matching + cash/refund/transfer rules.
  *Done: statement corrects the month; refunds & transfers aren't income.*

## Movement 2 — The Soak

- **Phase 8 — Live in the spine** for one real income-to-income cycle. Lock the
  four decisions (savings mode, leftover, surprise expense, going negative).

## Movement 3 — The Layers (each earns its place)

Ordered by value per unit of risk:

- **Phase 9 — Subscription audit** (cheapest win).
- **Phase 10 — Pace** (highest care: curve not line, median baseline, shut up early).
- **Phase 11 — Replay** (rank by surprise, commit to a verdict, end forward).
- **Phase 12 — Simulation / what-if** (stress test, reuses the same engine).
- **Phase 13 — AI analyst / ask-anything** (last, because it speaks most).

## The one test that governs everything

> Paying a known, fixed commitment must not change safe-to-spend.

Green from Phase 3 to finished. Break it once and Runway is just another app.
