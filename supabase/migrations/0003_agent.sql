-- Runway — agent & ingestion. Upload-only: every fact comes from a document
-- Dennis hands the agent. Nothing is auto-pulled. Apply after 0002.

alter table settings add column if not exists display_name text default 'Dennis';

-- The original uploaded files (metadata; bytes live in the private bucket).
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  kind text not null, -- payslip | receipt | invoice | statement | other
  storage_path text,
  mime text,
  original_name text,
  uploaded_at timestamptz not null default now(),
  status text not null default 'received' -- received | extracted | filed | discarded
);

-- What Gemini read, awaiting the ask-rule / Dennis. NEVER a financial record itself.
create table if not exists extraction_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  document_id uuid references documents (id) on delete cascade,
  doc_type text not null,
  payload jsonb not null, -- {amount, date, merchant, category, kind, ...}
  confidence jsonb, -- per-field 0..1
  status text not null default 'pending', -- pending | auto_filed | confirmed | rejected
  committed_ref uuid, -- the income/transaction it became
  question text, -- the clarification asked, if any
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_user on documents (user_id, uploaded_at);
create index if not exists idx_proposals_user_status on extraction_proposals (user_id, status);

alter table documents enable row level security;
alter table extraction_proposals enable row level security;

create policy "own rows" on documents
  for all using (user_id = auth.uid ()) with check (user_id = auth.uid ());
create policy "own rows" on extraction_proposals
  for all using (user_id = auth.uid ()) with check (user_id = auth.uid ());

-- Private, owner-only Storage bucket for the original files.
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

create policy "own files" on storage.objects
  for all
  using (bucket_id = 'documents' and owner = auth.uid ())
  with check (bucket_id = 'documents' and owner = auth.uid ());
