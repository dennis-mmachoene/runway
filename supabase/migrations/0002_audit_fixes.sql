-- Runway — audit fixes: rolled-buffer + emergency fund, and an ATOMIC cycle
-- transition (close + sinking accrual/payout + leftover + open) in one tx.
-- Apply after 0001. SQL Editor or `supabase db push`.

alter table cycles add column if not exists opening_buffer numeric(14, 2) not null default 0;
alter table settings add column if not exists emergency_fund numeric(14, 2) not null default 0;

-- Close the current cycle and open the next one as a single transaction.
-- The financial math (leftover, per-fund accrual/payout) is computed by the
-- engine in TypeScript and passed in, so there is one source of truth; this
-- function only applies the writes atomically. Runs as the caller (RLS applies).
create or replace function transition_cycle(
  p_income_id uuid,
  p_event_at timestamptz,
  p_floor numeric,
  p_opening_buffer numeric,
  p_emergency_add numeric,
  p_sinking jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  e jsonb;
begin
  update cycles
    set status = 'closed', end_event_id = p_income_id, end_at = p_event_at
    where status = 'open';

  if p_sinking is not null then
    for e in select * from jsonb_array_elements(p_sinking) loop
      update commitments
        set reserved_balance = (e ->> 'reserved_balance')::numeric,
            due_date = nullif(e ->> 'due_date', '')::date
        where id = (e ->> 'id')::uuid;
    end loop;
  end if;

  if coalesce(p_emergency_add, 0) <> 0 then
    update settings set emergency_fund = emergency_fund + p_emergency_add
      where user_id = auth.uid();
  end if;

  insert into cycles (start_event_id, start_at, status, floor_amount, opening_buffer)
    values (p_income_id, p_event_at, 'open', coalesce(p_floor, 0), coalesce(p_opening_buffer, 0));
end;
$$;
