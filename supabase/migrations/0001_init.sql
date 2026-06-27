-- Runway — Phase 2 schema: tables, enums, and Row Level Security.
-- Single owner, but every table is RLS-scoped to auth.uid() (defense in depth).
-- Apply via the Supabase SQL Editor or `supabase db push`.
-- ─── Enums ──────────────────────────────────────────────────────────────────
-- Flat category vocabulary (~9, NOT a tree).
create type category as enum(
  'groceries',
  'eating_out',
  'transport',
  'bills',
  'shopping',
  'health',
  'entertainment',
  'cash',
  'other'
);

create type commitment_cadence as enum('monthly', 'weekly', 'annual', 'custom');

create type commitment_type as enum('fixed', 'variable');

create type transaction_kind as enum('flow', 'lump', 'commitment');

create type transaction_source as enum('manual', 'import');

create type cycle_status as enum('open', 'closed');

create type savings_mode as enum('automatic', 'best_effort');

create type leftover_mode as enum('sweep_emergency', 'roll_buffer');

-- ─── income_events ──────────────────────────────────────────────────────────
create table income_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  amount numeric(14, 2) not null,
  event_at timestamptz not null,
  is_confirmed boolean not null default false, -- confirmed = cash in hand
  source text,
  created_at timestamptz not null default now()
);

-- ─── commitments ────────────────────────────────────────────────────────────
create table commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(14, 2) not null,
  cadence commitment_cadence not null,
  due_day int, -- for monthly/weekly cadence
  due_date date, -- for annual/custom cadence
  type commitment_type not null default 'fixed',
  variable_high numeric(14, 2), -- pessimistic reserve for variable bills
  reserved_balance numeric(14, 2) not null default 0, -- sinking pot for non-monthly bills
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── cycles ─────────────────────────────────────────────────────────────────
create table cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  start_event_id uuid references income_events (id) on delete set null,
  end_event_id uuid references income_events (id) on delete set null,
  start_at timestamptz,
  end_at timestamptz, -- null while open
  status cycle_status not null default 'open',
  floor_amount numeric(14, 2) not null default 0,
  tag text, -- e.g. "family visiting" (baseline exclusion, later)
  created_at timestamptz not null default now()
);

-- ─── transactions ───────────────────────────────────────────────────────────
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  raw_text text,
  amount numeric(14, 2) not null,
  merchant text,
  category category not null default 'other',
  kind transaction_kind not null default 'flow',
  commitment_id uuid references commitments (id) on delete set null, -- set when kind='commitment'
  logged_at timestamptz not null default now(),
  is_reconciled boolean not null default false,
  source transaction_source not null default 'manual',
  created_at timestamptz not null default now()
);

-- ─── merchant_aliases (parser memory) ───────────────────────────────────────
create table merchant_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  alias text not null,
  category category not null default 'other',
  default_amount numeric(14, 2), -- for "the usual"
  created_at timestamptz not null default now(),
  unique (user_id, alias)
);

-- ─── settings (one row per user) ────────────────────────────────────────────
create table settings (
  user_id uuid primary key default auth.uid () references auth.users (id) on delete cascade,
  floor_default numeric(14, 2) not null default 0,
  lump_threshold numeric(14, 2) not null default 1000,
  savings_mode savings_mode not null default 'automatic',
  leftover_mode leftover_mode not null default 'sweep_emergency'
);

-- ─── Indexes ────────────────────────────────────────────────────────────────
create index idx_income_events_user on income_events (user_id, event_at);

create index idx_commitments_user on commitments (user_id)
where
  is_active;

create index idx_transactions_user on transactions (user_id, logged_at);

create index idx_transactions_commit on transactions (commitment_id);

create index idx_cycles_user_status on cycles (user_id, status);

-- ─── Row Level Security: owner-only on every table ──────────────────────────
alter table income_events enable row level security;

alter table commitments enable row level security;

alter table cycles enable row level security;

alter table transactions enable row level security;

alter table merchant_aliases enable row level security;

alter table settings enable row level security;

create policy "own rows" on income_events for all using (user_id = auth.uid ())
with
  check (user_id = auth.uid ());

create policy "own rows" on commitments for all using (user_id = auth.uid ())
with
  check (user_id = auth.uid ());

create policy "own rows" on cycles for all using (user_id = auth.uid ())
with
  check (user_id = auth.uid ());

create policy "own rows" on transactions for all using (user_id = auth.uid ())
with
  check (user_id = auth.uid ());

create policy "own rows" on merchant_aliases for all using (user_id = auth.uid ())
with
  check (user_id = auth.uid ());

create policy "own row" on settings for all using (user_id = auth.uid ())
with
  check (user_id = auth.uid ());
