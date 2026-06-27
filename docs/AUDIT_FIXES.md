# Audit fixes (v1.0 production-readiness audit)

All eight findings from the static audit, addressed.

| # | Finding | What changed |
|---|---------|--------------|
| 1 | **Critical** — commitment-pay loop unwired (bills double-count at reconcile) | `payCommitment` writes a `kind='commitment'` transaction carrying `commitment_id` (`lib/commitments/actions.ts`); the **Pay** control + "paid this cycle" badge on `/commitments`; reconcile now matches a debit to a known commitment (by name hint / amount) and writes the same link, so the engine nets it to zero (`lib/reconcile/actions.ts`). |
| 2 | Sinking pot never pays out / resets | `closeSinkingFund` accrues the per-cycle reserve into `reserved_balance`, then at due **pays from the pot and resets** (`lib/cycles/transition.ts`, tested). Applied at cycle close via the transition. |
| 3 | Leftover at cycle close unimplemented | `computeLeftover` + the transition apply `leftover_mode`: **sweep** → `settings.emergency_fund`; **roll** → next cycle's `opening_buffer`, which the engine adds to the pool (`openingBuffer`). |
| 4 | Cycle close + open not atomic | `transition_cycle()` Postgres function (migration `0002`) does close + sinking updates + leftover + open in **one transaction**; the math stays single-sourced in TS (`lib/cycles/perform-transition.ts`). |
| 5 | Server actions failed silently | Income, commitments, and settings actions return a typed `FormState`; the pages are now client components that surface errors (and a "Saved." confirmation). |
| 6 | No error / loading / not-found boundaries | Added `app/error.tsx`, `app/loading.tsx`, `app/not-found.tsx`. |
| 7 | Thin accessibility | `aria-live` on the hero number and the diff greeting; `role="alert"` on errors; nav tap targets raised to 44px (`min-h-11`). |
| 8 | Flow rate was a whole-cycle average | Snapshot now uses a **trailing 10-day window**, so an early, front-loaded cycle no longer reads pessimistically. |

The four engine invariants still hold (verified) — net-zero fixed commitment, sinking steady, variable-return, lump level-not-rate — now with the buffer in the formula.

> Requires migration `0002_audit_fixes.sql` to be applied.
