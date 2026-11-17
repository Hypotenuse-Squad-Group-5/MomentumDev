-- NOTE (2026-11-16): renumbered from 022 to 024 when merging with main, because main's
-- 022_friends_only_posts and 023_okr_views took those numbers. Same contents.
-- Already run in the live database: no need to run it again.
-- Allow activities to host up to 100 people by default.
-- Existing activity rows and their configured participant limits are preserved.
alter table public.activities
  alter column max_participants set default 100;

alter table public.activities
  drop constraint if exists activities_max_participants_check;

alter table public.activities
  add constraint activities_max_participants_check
  check (max_participants <= 100);
