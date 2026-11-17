-- The equivalent host-only policies are already defined in
-- 20261117031922_edit_hosted_activities.sql. Remove the redundant copies.
drop policy if exists "hosts update upcoming activities" on public.activities;
drop policy if exists "hosts update upcoming activity addresses" on public.activity_addresses;