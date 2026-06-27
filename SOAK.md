# Movement 2 — The Soak

The spine is built. Before any layer (pace, replay, simulation, audit, AI) earns
its place, **live in Runway for one full cycle** — one income event to the next.
This isn't idle time; it's the gate that tells you what to build next and whether
the hero number is actually trustworthy.

## Set up the soak (5 minutes)

1. Open **Settings** and set your real **floor** and **lump threshold**, and lock
   your **savings** and **leftover** choices (see the four decisions below).
2. Add your real **income** (confirm the salary that's landed — this opens cycle 1).
3. Add your real **commitments**: monthly bills (rent, etc.), variable bills with
   a pessimistic `variable_high`, and any annual/custom bills as sinking funds.
4. From now on, **log as you spend** — `Coffee R38`, `Fuel R900`. Seconds, not
   minutes. Don't aim for perfect; reconcile cleans it up.

## The daily habit

- Open `/today` once a day. Read the one-line greeting and the runway date.
- Log spend as it happens. Correct a wrong guess with one tap and tick *remember*.
- That's it. Calm and near-silent is the point.

## Once, at month-end

- Import your bank statement on **Reconcile**. Let it match, fix the unmatched,
  and confirm refunds/transfers are classified right. The statement is truth.

## Exit gate — answer these from real use (not theory)

You're ready to leave the soak when you can answer:

1. **Does the hero number feel true every morning?** If it ever lies (either
   direction), fix the engine before building anything new.
2. **Did reconcile kill the guilt, or create work?** Daily logging should feel
   free because month-end corrects it.
3. **Which layer do you reach for the absence of first?** That one goes next.

## The four decisions to lock (do these during the soak)

These are real forks. Set them in **Settings**; the recommendation is first.

1. **Savings — automatic or best-effort?** *(per goal)*
   - **Automatic (recommended for goals you care about):** sacred, off the top,
     safe-to-spend is what's left after it.
   - Best-effort: competes with flexible spend, loses when you overspend.

2. **Leftover at cycle-end — sweep or roll?**
   - **Sweep to emergency fund (recommended):** leftover moves to your emergency
     fund at cycle close.
   - Roll into a buffer: leftover carries into the next cycle's buffer.
   - Either way: **never silently reset** — that teaches you to burn it.

3. **Surprise expense — flexible or floor?**
   - **Ask each time (recommended):** the choice *is* the story. If it comes from
     the floor, the app surfaces a refill plan until it's rebuilt.

4. **Going negative — how to show it?**
   - **Always show consequence + exit (recommended):** *"R800 over — comes from
     your floor unless next cycle absorbs it."* Truth plus a path, never just red.

> Decisions 1 and 2 are wired into Settings now. Decisions 3 and 4 are behaviours
> the relevant layer will implement; locking the choice here means we build them
> the way you decided.

## Known carry-forwards to revisit during the soak

- **Leftover sweep/roll math** isn't executed yet (cycles close without losing
  data, but leftover isn't moved). Needs an emergency-fund / buffer model.
- **Sinking-fund `cyclesUntilDue`** is approximated as ~monthly from the due date.
- **Reconcile-created income** doesn't run the cycle lifecycle (avoids spurious
  cycles during a bulk import).

When the gate is passed and the decisions are locked, Movement 3 begins — and the
first layer is whichever one you reached for.
