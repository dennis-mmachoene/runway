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

## Re-audit (v2) follow-ups

| # | Finding | What changed |
|---|---------|--------------|
| N1 | **Duplicate commitment settlement** — a bill settled by both the manual Pay and reconcile hit cash twice (understating safe-to-spend). | Settlement is now idempotent per (commitment, open cycle): `payCommitment` refuses if a commitment-tx already exists this cycle; reconcile preloads already-settled commitment ids and skips them (and dedupes within the batch). |
| N3 | Reconcile could insert an income line duplicating a salary already recorded. | Reconcile preloads existing income keyed by amount + date and skips duplicates (also within the batch). |
| N2 | Residual accessibility — some 32–36px tap targets; light SR coverage on the hero. | Recent-row + commitments controls and the inline selects raised to 44px (`h-11`/`min-h-11`); the safe-to-spend number now carries an `aria-label`. |

## UI/UX re-audit (v2) — the gauge

| # | Finding | What changed |
|---|---------|--------------|
| G1 | **Honesty** — a depleted cycle (pool ≤ 0) fell into the "still learning" branch and was told a comforting lie. | The gauge has a distinct `depleted` branch ("you're at your floor"), derived from the **same** flag the hero computes (`spendablePool <= 0`), so the two can never disagree (`components/runway-gauge.tsx`, `app/today/page.tsx`). |
| G2 | **Fidelity** — the descent always ran corner-to-corner with the date pinned to the right edge, so urgency was invisible. | The x-axis now maps to the cycle window — **days until the next expected income**, estimated from the user's own pay cadence (`estimateCycleDays`, the median gap between past cycle starts; monthly fallback, clamped to a weekly–quarterly band, tested). The line crosses the floor where it really does: a near crossing reads steep and early, a comfortable one shallow and exits the right edge above the floor. The right edge is labelled `next pay ~<date>` and marked approximate. Vertical scale stays linear and honest. |

## Build audit — agent phase (A1.0)

| # | Sev | Finding | What changed |
|---|-----|---------|--------------|
| A1 | P0 | An uploaded bill for a known commitment became a raw transaction (`commitFromProposal` never set `commitment_id`), so it double-counted on top of the reserve — the v2 bug through the upload door. | On commit, a non-payslip doc is matched (fuzzy payee or amount ±10%) to an active monthly commitment via `matchSettleableCommitment`; a match is settled as `kind='commitment'` + `commitment_id` (category `bills`) so the engine nets it to zero, reusing the per-cycle settled guard so it can't double-settle. |
| A2 | P1 | Confirming any payslip always called `performTransition`, so a back-dated payslip would close/open a cycle mid-month and corrupt the structure. | Transition only fires when the payslip date is newer than the open cycle's start (or there's no open cycle yet); otherwise it's recorded as confirmed historical income with no transition. |
| A3 | P1 | Exact-string merchant matching → missed dedup and over-asking ("Uber" vs "UBER *TRIP"). | New pure `normalizeMerchant` / `merchantsMatch` (tested). Used by the irregularity/familiarity checks (now over a recent window + `merchant_aliases`), the A1 commitment match, and the reconcile matcher's hint — so name mangling no longer breaks dedup or triggers needless questions. |
| A4 | P2 | Subscriptions had no single home — onboarding subs → commitments, but subscription receipts → ordinary transactions. | Commitments are the one home (what the engine reserves against). `/subscriptions` is the *detector* of undeclared recurring charges; a "Track as bill" action promotes one into a monthly commitment, after which its receipts settle it (A1) and the detector stops flagging it. |
| A5 | P2 | `uploadDocument` accepted any file, unbounded, before buffering + base64 + shipping to Gemini. | Pure `checkUpload` (tested): ≤10MB and PDF/JPG/PNG/WEBP only, with a clear rejection message. Applied to both the inbox upload and the statement-upload on reconcile. |

> A6 (gauge G2) from this report was already resolved — see the UI/UX v2 section above.

## Build audit — agent phase, 2nd pass (A2.0)

Verified A1–A5 closed. One edge the A1 fix introduced:

| # | Sev | Finding | What changed |
|---|-----|---------|--------------|
| B1 | P1 | The A1 settlement match fell back to amount-only (±10%) with a lenient payee matcher, so a coincidence (R8,200 furniture vs R8,000 rent) could silently *settle* the commitment and **overstate** safe-to-spend, corrupting the bill's paid-state. | Settlement now requires a STRONG payee match: new pure `payeeMatchesStrict` (equal or contiguous-phrase, never a shared common word) + `classifyBill` → `settle` \| `ask` \| `none` (tested). `commitFromProposal` settles only on `settle`; everything else is ordinary spend, so a coincidence can never overstate. An amount-coincidence with a weak payee now triggers the ask-rule's new `ambiguous_settlement` reason — "Is this R8,200 your rent, or a separate purchase?" — and defaults to a separate purchase unless Dennis says otherwise. When a strong match *will* settle, the confirm card says so ("I'll log this against your <bill>"). |

> A6/G2 carried in this report was already done (UI/UX v2).

## Agent audit 3 (A3.0) + Security audit (S1.0)

A3.0 verified B1 and the onboarding build as closed; one cleanup remained. The security audit found the architecture sound (real mandatory TOTP, owner-only sign-in, RLS everywhere, the service-role key server-only/off the request path, bounded gated uploads) with header hardening outstanding.

| # | Sev | Finding | What changed |
|---|-----|---------|--------------|
| O1 | P2 | `confirmOnboarding` wasn't idempotent — re-running onboarding would re-insert commitments and open a second cycle. | `/onboarding` now redirects to `/today` when a cycle already exists, and `confirmOnboarding` refuses when one is open (defense in depth). First-run only. |
| S1 | P2 | `next.config.ts` was empty — no HSTS/CSP/X-Frame-Options/etc. | Added the full header set via `headers()`: HSTS (preload), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, and an app-aware CSP (`frame-ancestors 'none'`, Supabase allowed for auth + signed-URL thumbnails; `'unsafe-inline'` kept for Next hydration + the no-flash theme script). |
| S3 | Low | A malicious uploaded document could embed text aiming to steer the extractor. | Already contained (enum-validated parsing + human confirm). Hardened anyway: both extractors are now told to treat all document text as DATA, never instructions. |

> S2 (app-level brute-force throttling) is accepted as-is — mandatory TOTP means a password alone can't get in; proxy/host throttling is the deployment-layer defence-in-depth. The deployment boundary (HTTPS/TLS, locking the Supabase project, secrets in host env, patching, host hardening) is the owner's half and can't be set from the app code. A6/G2 was already resolved (UI/UX v2).

