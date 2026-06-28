# Runway — Testing Guide

How to verify Runway does its one job: **never lie about the number, in either
direction.** Three layers — automated tests, a clean build, and a manual
end-to-end script you run once before trusting it daily.

---

## 1. Automated tests (`npm test`)

```bash
npm test          # Vitest — pure logic, no DB, no network
```

Expect **all suites green**. What they lock down:

- **Engine invariants** (`lib/engine/safe-to-spend.test.ts`) — the four that must
  never break: fixed-commitment net-zero, sinking-fund steady (no cliff),
  variable bill returns the difference, lump lowers level not rate; plus the
  rolled-buffer adds to the pool and cold-start fabricates nothing.
- **Cycle transition** (`lib/cycles/transition.test.ts`) — sinking accrual →
  payout → reset; leftover never negative.
- **Parser** (`lib/logging/parser.test.ts`) — amounts, alias defaults,
  need-amount vs ambiguous.
- **Reconcile** (`lib/reconcile/reconcile.test.ts`) — CSV parsing, the three
  breakers classified correctly, log matching.
- **Pace / Replay / Subscriptions / Simulation / Greeting / Analyst prompt** —
  each layer's pure core.

Run a single suite while iterating: `npx vitest run lib/engine`.

---

## 2. Build & type check (`npm run build`)

```bash
npm run build     # compiles + type-checks every route; expect a clean finish
```

A green build means no type errors and every page/route/middleware compiled.

---

## 3. Manual end-to-end script

Run this once on a real (or test) Supabase project. It walks the spine and every
layer, and explicitly re-checks the audit fixes.

### Prerequisites

1. `.env.local` filled (URL, publishable + secret keys, `OWNER_EMAIL`,
   `OWNER_PASSWORD`; `GEMINI_API_KEY` for logging fallback + Ask).
2. Both migrations applied: `0001_init.sql`, then `0002_audit_fixes.sql`.
3. Supabase: email signups **off**, **TOTP enabled**, owner seeded
   (`npm run seed:owner`).
4. `npm run dev`, open <http://localhost:3000>.

> Tip: to reset between runs, clear the tables in the SQL Editor
> (`delete from transactions; delete from cycles; delete from income_events;`
> etc.) — never the `auth.users` row.

### A. Auth & the gate

1. Landing page shows **only Enter** — no app name, no data. ✅ leaks nothing.
2. Enter → wrong email or password → neutral **"Invalid credentials."** (no hint
   which was wrong).
3. Correct email + password → first time: scan the QR into your authenticator,
   enter the 6-digit code → land on `/today`. Subsequent logins ask for the TOTP
   code too.
4. Visit `/today` in a fresh private window (no session) → redirected to `/`.
5. **Lock** on `/today` → back to the gate; `/today` again redirects.

### B. First cycle & safe-to-spend

6. `/income` → add a **confirmed** salary, e.g. R20 000 today. → `/today` shows a
   safe-to-spend number and the breakdown (cash, commitments, set aside, floor).
7. With no spend yet, the runway line reads **"Still learning your pace"** (no
   fabricated date). ✅ cold start.

### C. The four invariants (the heart)

8. **Fixed net-zero (Inv 1).** `/commitments` → add **Rent, R8 000, monthly,
   fixed**. Note the exact safe-to-spend on `/today`. Back on `/commitments`,
   **Pay** R8 000. → safe-to-spend is **unchanged**, and Rent shows
   *"paid this cycle"*.
9. **Variable returns the difference (Inv 3).** Add **Electricity, R1 400,
   monthly, variable, variable_high 1 400**. Note safe-to-spend (it reserves
   1 400). **Pay** the actual R900. → safe-to-spend **rises by R500**.
10. **Lump: level down, rate flat (Inv 4).** Log `Tyres R5000` (above your lump
    threshold → it's a lump). → the pool drops R5 000 but the **runway date /
    pace doesn't lurch** (rate unchanged).
11. **Sinking steady (Inv 2).** Add an **annual** commitment (sinking fund), e.g.
    Insurance R6 000 due in ~3 cycles. It draws a steady per-cycle reserve, not a
    one-off hit — visible as "set aside" on `/today`.

### D. Fast logging

12. `Coffee R38` → records instantly (deterministic, no spinner from network).
13. Log `Engen R900`, then on the recent row set category **transport** and tick
    **remember**. Next time, `Engen` alone fills transport — **no network call**.
14. Messy input like `coffee and cake R60` → handled via Gemini fallback (needs
    `GEMINI_API_KEY`); if the key is absent it asks you for the amount instead of
    failing.
15. A wrong guess → one tap on the category/kind select fixes it.

### E. The gauge greeting

16. Reload `/today` after logging → the top line summarises **what changed since
    you last looked** ("…R1 200 spent, still on track"), not a transaction dump.
    Reload again with no changes → **"Nothing's changed since you last looked."**

### F. Reconcile (statement = truth) + the breakers

17. `/reconcile` → paste a CSV with a header row, e.g.:

    ```
    Date,Description,Amount
    2026-06-02,Woolworths,-350.00
    2026-06-03,Refund Takealot,200.00
    2026-06-04,Transfer to Savings,-1000.00
    2026-06-05,ATM Withdrawal,-500.00
    2026-06-06,Rent,-8000.00
    ```

18. Check the proposed types: Woolworths → **spend**, Refund → **refund**,
    Transfer → **transfer**, ATM → **cash**, Rent → **commitment** (matched to
    your Rent commitment). Adjust if needed → **Apply**.
19. Confirm: the **refund** nets against spend (not income), the **transfer** is
    excluded from both, the **cash** line lands as category `cash`, and **Rent**
    nets to zero (it's a known bill, not fresh spend).

### G. N1 — settlement can't double-count (the gate)

20. Pay Rent manually (step 8). Then reconcile a statement that includes the Rent
    debit (step 17). → reconcile **skips** it; safe-to-spend does **not** drop a
    second R8 000.
21. Try paying the same commitment twice in a cycle → **"Already settled this
    cycle."**

### H. N3 — income isn't duplicated

22. With a salary already recorded, reconcile a statement whose salary line has
    the **same amount + date** → it's **skipped**, income isn't doubled.

### I. Cycle transition (atomic, leftover, sinking)

23. `/income` → add the **next** confirmed salary. → the prior cycle **closes**
    and a new one **opens** (only ever one open). Per your `leftover_mode`,
    leftover either swept to the emergency fund or rolled into the new cycle's
    pool; any **due** sinking fund pays out and re-arms. It's one atomic step —
    you never see a momentary "no open cycle" empty state.

### J. The layers

24. **Subscriptions** (`/subscriptions`) — after a couple of cycles with a
    repeating same-amount merchant (e.g. Netflix R199 monthly), it lists it with
    monthly + yearly totals. Daily coffee / one-offs are not listed.
25. **Pace** (`/today`) — silent until ≥3 comparable cycles; before that it says
    *"still learning your normal."* Then it speaks only when materially ahead of
    your normal curve.
26. **Replay** (`/replay`) — after a cycle closes: a headline, surprise-ranked
    beats, a verdict, a forward line, and one uncanny fact.
27. **What-if** (`/simulate`) — with no shocks, the two columns match the live
    number exactly. Stack a purchase + lost income + rent rise → the scenario
    column moves; the baseline doesn't.
28. **Ask** (`/ask`) — "How much on coffee this year?" answers from your data;
    ask something not in the data → it says it doesn't have that (no guessing).

### K. Security smoke

29. `GEMINI_API_KEY` / `SUPABASE_SECRET_KEY` never appear in the browser
    DevTools → Sources/Network (they're server-only).
30. Session cookies are httpOnly (DevTools → Application → Cookies: `HttpOnly`
    ticked).

---

## What "pass" means

Green automated tests, a clean build, and — most importantly — **step 8 and step
20**: paying a known bill, by any path, never moves safe-to-spend. That's the
unit test for the whole app. If it ever does, stop and treat it as a bug before
anything else.
