# Runway — Setup

Covers **Phase 0 (foundation)**, **Phase 1 (auth)**, and **Phase 2 (schema)**.
Auth is **password + mandatory TOTP — no email is ever sent** (no OTP, no magic
links, no SMTP). Email is only the owner's username.

> All commands run from the project root.

---

## 1. Install dependencies

```bash
npm install
```

---

## 2. Supabase project & keys

Runway uses Supabase's **current API keys** (publishable + secret); the legacy
`anon` / `service_role` JWTs deprecate end of 2026.

<https://supabase.com/dashboard> → **New project**, then **Project Settings**:

| `.env.local` variable                   | Where to find it                                                            |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`              | Data API → "Project URL"                                                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`  | API Keys → **Publishable key** (`sb_publishable_...`)                       |
| `SUPABASE_SECRET_KEY`                    | API Keys → **Secret keys** → reveal/create (`sb_secret_...`) — server only  |

Then in `.env.local` set `OWNER_EMAIL` (your username) and `OWNER_PASSWORD` (a
strong password — store it in your password manager). `.env.local` is gitignored.

---

## 3. Apply the database schema (Phase 2)

Run `supabase/migrations/0001_init.sql` against your project — either:

- **SQL Editor:** Dashboard → SQL Editor → paste the file → Run, or
- **CLI:** `supabase link` then `supabase db push`.

This creates all tables, the flat `category` enum, and Row Level Security scoped
to `auth.uid()` on every table.

---

## 4. Lock down auth (the three signup locks + MFA)

1. **Disable signups (Lock #2)** — Dashboard → **Authentication → Sign In /
   Providers → Email** → turn **off** "Allow new users to sign up". (Leave the
   Email provider itself enabled — it's how password login works.)
2. **Enable TOTP (Lock for the 2nd factor)** — Dashboard → **Authentication →
   Multi-Factor Authentication** → ensure **TOTP (App Authenticator)** is on.
   TOTP is mandatory; without it, enrollment fails.
3. **No email config needed** — because nothing is ever emailed, you don't need
   custom SMTP or email templates. (You may also turn off "Confirm email"; the
   seed creates the owner already confirmed.)

> Lock #1 (no in-app signup) and Lock #3 (server-side allowlist on `OWNER_EMAIL`)
> are already enforced in code.

---

## 5. Seed the owner

With `SUPABASE_SECRET_KEY`, `OWNER_EMAIL`, and `OWNER_PASSWORD` set in `.env.local`
(and the schema applied):

```bash
npm run seed:owner
```

This creates the owner user (email confirmed, with your password) and ensures a
`settings` row. Re-running is safe — it won't reset an existing password.

---

## 6. Run it

```bash
npm run dev
```

Open <http://localhost:3000>:

- The landing page shows only an **Enter** button — nothing else pre-auth.
- Enter → **email + password**. First login: scan the QR into your authenticator,
  enter the 6-digit code → you land on `/today`. Every login after: email +
  password + TOTP code.
- A wrong email or password gets a neutral "Invalid credentials" — nothing leaks.
- Protected routes require a fully stepped-up (`aal2`) session, so you can't reach
  `/today` on the password alone. **Lock** on `/today` signs out.

---

## What you have after Phase 0–2

- Supabase SSR clients (browser / server / proxy) on httpOnly cookies; secret-key
  admin client behind `server-only`. Publishable/secret keys.
- `proxy.ts` (Next 16's renamed middleware) refreshes the session, enforces TOTP
  step-up (`aal2`), and gates every route except `/`.
- Enter gate: password + mandatory TOTP, allowlist-of-one, three signup locks,
  owner seed script. No email anywhere.
- Full schema: `income_events`, `commitments`, `cycles`, `transactions`,
  `merchant_aliases`, `settings`, the `category` enum, and RLS on all tables.
- shadcn/ui (Button, Input, InputOTP, Label) on Tailwind v4.
