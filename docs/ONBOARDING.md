# Onboarding — verified-profile conversation

Onboarding is the agent's first conversation: it builds the profile everything
else stands on. It is a conversation with an advisor, not a 60-question form,
governed by four rules — a conversation not a form; never assume, verify; depth
follows the person; awareness-first.

## Two tracks

The **conversation** captures what Dennis says; **documents** capture the truth.
The agent reconciles them and asks about every difference — that reconciliation
is what makes the profile *verified*, not merely collected.

- `lib/agent/onboarding-prompt.ts` — `buildOnboardingInstruction` drives the
  tiered arc (money in → spoken-for → subscriptions → daily life → people →
  safety & savings → reconcile & confirm), one topic at a time, and emits a
  strict JSON turn `{reply, done, requestDocs, proposal}`.
- `lib/agent/onboarding.ts` — `onboardingTurn` (Gemini JSON mode) + the pure,
  tested `sanitizeProposal`.
- `onboardingIngest` (`lib/agent/actions.ts`) — the truth track: reads uploaded
  payslips (`extractDocument`) or statements (`extractStatementLines` +
  `detectSubscriptions`) and returns a plain-language fact summary that is
  dropped back into the conversation for the agent to reconcile. It writes
  nothing.
- `app/onboarding/onboarding-client.tsx` — chat with an upload affordance that
  appears exactly when the agent sets `requestDocs`, then the verified-profile
  confirm card (each fact tagged with its source: confirmed / payslip /
  statement).

## Reconciliation — never a silent overwrite

Three outcomes: **match** (store, verified), **gap** (a document shows something
unmentioned — "I see a R450 Dischem debit, what's that?"), **conflict** (spoken ≠
document — "you said rent is R8,000 but R8,500 leaves on the 1st — which is
right?"). Dennis decides; the agent never assumes.

## What it persists (only at confirm)

`confirmOnboarding` writes the engine model: reliable **base** income (variable
pay is captured as a windfall note, never folded into base, so safe-to-spend
stays honest), commitments (monthly + sinking), subscriptions → monthly
commitments (the single home, per A4), ongoing family support → commitments,
the floor, the emergency fund, and the savings mode. The income opens the first
cycle via the same atomic `performTransition`.

## Out of scope (for now)

The **Deepen** wealth tier — investments, retirement, risk tolerance, net worth
— is intentionally not captured yet, keeping Runway the awareness instrument it
set out to be. The proposal schema can grow into it later without disruption.
