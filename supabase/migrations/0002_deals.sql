-- Slice 2: deal records.
-- A deal captures one property + one confirmed legal description + the
-- ask-every-time terms + any per-deal overrides to the standing defaults.
-- Apply to STAGING first (project aggwvdaakdduzsgztdsz), verify, then production.

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'draft',

  -- from the legal-description lookup (slice 1)
  property_address text not null,
  county_id text not null,
  legal_description jsonb not null,

  -- snapshot of DEFAULT_PREFERENCES at creation time (slice 4 makes these editable)
  defaults jsonb not null default '{}'::jsonb,

  -- ask-every-time fields (DealTerms)
  terms jsonb not null default '{}'::jsonb,

  -- natural-language "anything different about this deal" box + the accepted,
  -- structured interpretation of it
  override_note text not null default '',
  overrides jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_user_id_created_at_idx
  on public.deals (user_id, created_at desc);

alter table public.deals enable row level security;

drop policy if exists "deals_select_own" on public.deals;
create policy "deals_select_own" on public.deals
  for select using (auth.uid() = user_id);

drop policy if exists "deals_insert_own" on public.deals;
create policy "deals_insert_own" on public.deals
  for insert with check (auth.uid() = user_id);

drop policy if exists "deals_update_own" on public.deals;
create policy "deals_update_own" on public.deals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "deals_delete_own" on public.deals;
create policy "deals_delete_own" on public.deals
  for delete using (auth.uid() = user_id);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists deals_set_updated_at on public.deals;
create trigger deals_set_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();
