-- Runway — RESET TO A CLEAN SLATE
-- ─────────────────────────────────────────────────────────────────────────────
-- Wipes ALL owner data and uploaded files, leaving the schema and the owner
-- login intact, so the next sign-in lands on a fresh onboarding.
--
-- ⚠️  DESTRUCTIVE. There is no undo. Intended for a single-user instance you
--     want to start fresh — NOT for live data you need to keep.
--
-- HOW TO RUN: paste into the Supabase SQL Editor for the CORRECT project and
-- run. Confirm the project name in the dashboard header before executing.
--
-- Does NOT touch: tables/migrations (schema) or auth.users (the owner login).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- All owner data, FK-safe in one statement. `cascade` handles dependencies;
-- `restart identity` is harmless here (PKs are uuids, not sequences).
truncate table
  extraction_proposals,
  documents,
  transactions,
  income_events,
  commitments,
  cycles,
  merchant_aliases,
  settings
restart identity cascade;

-- Empty the private 'documents' storage bucket (the stored originals).
delete from storage.objects where bucket_id = 'documents';

commit;

-- ─── Verify (optional): every count below should be 0 ────────────────────────
-- select
--   (select count(*) from settings)             as settings,
--   (select count(*) from cycles)               as cycles,
--   (select count(*) from income_events)        as income,
--   (select count(*) from transactions)         as transactions,
--   (select count(*) from commitments)          as commitments,
--   (select count(*) from documents)            as documents,
--   (select count(*) from extraction_proposals) as proposals,
--   (select count(*) from merchant_aliases)     as aliases,
--   (select count(*) from storage.objects where bucket_id = 'documents') as files;
