-- Make the "Buyer" standing default (TREC §1) an editable per-user value.
-- A full user_preferences table is still slice 4; this is the one field that
-- blocks generating a usable contract.
-- Apply to STAGING first (aggwvdaakdduzsgztdsz), verify, then production.

alter table public.profiles
  add column if not exists buyer_name_info text not null default '';
