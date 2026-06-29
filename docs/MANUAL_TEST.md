# Runway — Manual Test Script

Hand-testing by *using* the app. Work top to bottom on a freshly reset instance.
Each check has **Steps**, **Expected**, and a **Result** box — tick `[x]` pass or
write what went wrong.

**Before you start**
- [ ] Reset done — ran `supabase/reset.sql` against the correct project.
- [ ] You can sign in (password + TOTP) as the owner.
- [ ] Documents ready: 3 consecutive payslips (e.g. Apr/May/Jun), a 3-month bank
      statement (PDF), and a few receipts (a shop receipt, an e-hailing receipt,
      a takeaway receipt, and a **photo of a paper receipt**).
- [ ] Note your device: test once on desktop, once on a phone (see §8).

Legend for amounts below: substitute your real figures; "≤ small" means at or
under your lump threshold (default R1 000), "large" means above it.

---

## 0. Clean slate

**Steps:** Run the reset SQL, then sign in.
**Expected:** You land on a fresh state — Today shows the welcome / empty state
("Set up with the agent" + "Add income manually"), no number, no transactions;
Inbox is empty; Subscriptions/Commitments empty.

- [ ] Result: ____________________________________________

---

## 1. Onboarding — the clean run with documents

### 1a. Start the conversation
**Steps:** Today → "Set up with the agent" (or open `/onboarding`).
**Expected:** The agent opens with a warm, single question about income — not a
form/wall of questions.

- [ ] Result: ____________________________________________

### 1b. Income + payslip verification
**Steps:** Tell it your salary in round terms ("about R25,000, sometimes
commission"). When it offers, upload your **3 payslips**.
**Expected:** It treats the base as reliable and commission as a **windfall**
(not added to base). After reading the payslips it states the net pay and pay
date and whether pay looks **steady**, and reconciles against what you said.

- [ ] Result: ____________________________________________

### 1c. Commitments + statement verification (GAP)
**Steps:** Name a few commitments but **deliberately leave one out** that is in
your statement (e.g. don't mention a gym or iCloud). Upload the **3-month
statement** when asked.
**Expected:** The agent surfaces the **gap** — names the recurring charge you
didn't mention and asks what it is ("I see a R199 gym on the 2nd — log it?").
It does **not** silently add it.

- [ ] Result: ____________________________________________

### 1d. Conflict the agent must question (CONFLICT)
**Steps:** State an amount that differs from the statement (say rent is R8,000
when the statement shows R8,500).
**Expected:** It asks which is right ("you said R8,000 but R8,500 leaves on the
1st — which is it?") and uses your answer. It never overwrites silently.

- [ ] Result: ____________________________________________

### 1e. Confirm → first cycle opens
**Steps:** Let it propose the picture; review the verified-profile card; press
"Looks right — set it up".
**Expected:** Card shows income (with pay-date / consistency, source tag),
committed total, floor, and "you can actually spend". On confirm you land on
Today with a real safe-to-spend number and an open cycle.

- [ ] Result: ____________________________________________

### 1f. Onboarding is first-run only (O1)
**Steps:** Manually visit `/onboarding` again.
**Expected:** Redirects to Today — it does not let you re-run and double-count.

- [ ] Result: ____________________________________________

---

## 2. Document ingestion + the ask-rule

For each upload: Inbox → "Hand me a document" → pick the type → upload.
Check the whole path: it **extracts** amount/date/merchant, **categorises**,
**stores** the original, and applies the **ask-rule**.

### 2a. Small, clear receipt → auto-files
**Steps:** Upload a clean shop receipt for a **≤ small** amount (e.g. groceries
R120).
**Expected:** "Filed it — done." It appears in Today's recent list and in the
Inbox activity log marked "· auto". Safe-to-spend drops by that amount.

- [ ] Result: ____________________________________________

### 2b. E-hailing receipt
**Steps:** Upload an Uber/Bolt receipt.
**Expected:** Categorised as transport; merchant read as Uber/Bolt even if the
text is mangled (e.g. "UBER *TRIP"); small+clear auto-files, otherwise asks.

- [ ] Result: ____________________________________________

### 2c. Takeaway receipt
**Steps:** Upload a takeaway/restaurant receipt.
**Expected:** Categorised as eating out; total (VAT-inclusive) read, not a
subtotal.

- [ ] Result: ____________________________________________

### 2d. Photo of a paper receipt
**Steps:** Upload a **photo** (not a PDF) of a crumpled paper receipt.
**Expected:** It still reads it; if the amount/date are unclear it **asks** (low
confidence) rather than guessing.

- [ ] Result: ____________________________________________

### 2e. Large amount → asks first
**Steps:** Upload a receipt/invoice for a **large** amount (above your lump
threshold).
**Expected:** It does **not** auto-file; the Inbox shows a specific question
("This … is R… — real money. File it as is, or adjust?").

- [ ] Result: ____________________________________________

### 2f. Thumbnail + a thrown-away file type (A5)
**Steps:** Confirm uploaded items show a thumbnail / "view" link in the Inbox.
Then try uploading a `.txt` or a >10MB file.
**Expected:** Image/PDF show a preview via a short-lived link; the unsupported /
oversized file is rejected with a clear message (no crash).

- [ ] Result: ____________________________________________

---

## 3. The Inbox

**Steps:** After §2, review the Inbox.
**Expected:** Auto-filed items are in the **Activity** log (with "· auto");
unclear ones sit under **"Needs a quick answer"** with an editable card; you can
**Confirm & file** (writes the record) or **Discard** (writes nothing). Editing
the amount/category before confirming is respected.

- [ ] Result: ____________________________________________

---

## 4. Bank-statement reconcile

### 4a. Upload-to-reconcile
**Steps:** Reconcile → "Upload a statement" → upload a statement image/PDF (or
paste CSV).
**Expected:** Every transaction line is read into the review table; debits are
negative, credits positive. Spend lines that match an existing log show
"matched".

- [ ] Result: ____________________________________________

### 4b. Irregular line is questioned, not assumed
**Steps:** Ensure the statement has an unusual line (a refund, an internal
transfer, or a one-off much larger than usual). Review the proposed types.
**Expected:** Refund is typed `refund` (not income); a transfer is `transfer`
(excluded from both income and spend); an ATM line is `cash_withdrawal`. Nothing
ambiguous is silently counted as income. You can correct any line before
applying.

- [ ] Result: ____________________________________________

### 4c. Apply = statement is truth
**Steps:** Apply the reconcile.
**Expected:** Summary reads back counts (matched / added / bills / refunds /
income / transfers excluded). Re-applying the same statement does **not**
double-count (idempotent income + commitment settlement).

- [ ] Result: ____________________________________________

---

## 5. The hero + gauge

### 5a. On track
**Steps:** With a normal cycle, look at Today.
**Expected:** Big safe-to-spend number; co-headline "At this pace you hit your
floor on <date>"; the gauge descends and crosses the floor, with "next pay ~<date>"
marked on the right. A short runway reads steep/early; a comfortable one shallow
and exits the right edge above the floor.

- [ ] Result: ____________________________________________

### 5b. Still learning
**Steps:** Right after onboarding, before much spend is logged.
**Expected:** Gauge says "still learning your pace"; no fabricated runway date.

- [ ] Result: ____________________________________________

### 5c. At the floor (depleted)
**Steps:** Log enough spend to drive the pool to/under the floor (use a what-if
on `/simulate` first if you don't want to commit it).
**Expected:** Hero says "You're at your floor — time to pause"; gauge shows
"you're at your floor" — **not** "still learning". Honest in both directions.

- [ ] Result: ____________________________________________

---

## 6. The invariant — paying a fixed bill must NOT move safe-to-spend

**Steps:** Note the current safe-to-spend. Pay a known **fixed** monthly
commitment — either Commitments → Pay, or upload that bill's receipt (the payee
matches the commitment), or reconcile the debit.
**Expected:** Safe-to-spend is **unchanged** (the bill was already reserved). The
commitment shows "paid this cycle". It is not double-counted.

- [ ] Result: ____________________________________________

### 6b. Settlement is strict (B1)
**Steps:** Upload a receipt for an **unrelated** purchase whose amount happens to
be near a commitment (e.g. R8,200 furniture vs R8,000 rent).
**Expected:** It does **not** settle rent. It asks "Is this R8,200 your rent, or
a separate purchase?" and, unless you say it's the bill, files it as a separate
purchase (safe-to-spend drops — never silently overstated). A receipt whose payee
**does** match a commitment settles it, and the confirm card says "I'll log this
against your <bill>".

- [ ] Result: ____________________________________________

---

## 7. Chat + what-if (spot checks)

**Steps:** Insights → Chat: ask "how am I doing this cycle?" then "can I afford a
R8 000 phone?". Try "log R85 lunch".
**Expected:** Answers are grounded in your real numbers (never invented). A log
proposal shows a confirm chip — nothing is saved until you tap it. A what-if shows
now-vs-scenario with the runway delta and writes nothing.

- [ ] Result: ____________________________________________

---

## 8. Mobile / responsive

**Steps:** Open Runway on a phone (or DevTools device mode ~390px). Visit Today,
Inbox, Reconcile, Subscriptions, Chat, Onboarding.
**Expected:**
- Navigation is a **bottom tab bar** (not the desktop rail); content fits the
  width with no horizontal scroll.
- The hero number and gauge scale to the screen; the gauge is readable.
- Inbox upload, the confirm cards, and the chat composer are usable; the composer
  sits above the tab bar (not hidden behind it).
- Long merchant names truncate rather than break the layout.
- Pinch-zoom works; nothing is cut off at the page bottom.

- [ ] Result (Today): __________________________________
- [ ] Result (Inbox/upload): ___________________________
- [ ] Result (Reconcile): ______________________________
- [ ] Result (Chat composer): __________________________
- [ ] Result (Onboarding): _____________________________

---

## Appendix — tips for forcing states

- **Learning vs on-track:** the runway date needs a trailing flow rate — log a
  few days of normal spend to leave "learning".
- **Depleted:** use `/simulate` (a large one-off purchase) to preview the floor
  state without committing, or actually log spend down to the floor.
- **Duplicate / unfamiliar / anomalous asks:** upload the same receipt twice
  (duplicate), a brand-new merchant (unfamiliar), or a charge 3× a merchant's
  usual (anomalous) — each should trigger a specific question.
- **Reset and repeat:** re-run `supabase/reset.sql` any time to start over.
