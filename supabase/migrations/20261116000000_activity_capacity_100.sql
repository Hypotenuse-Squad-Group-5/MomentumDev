-- Allow activities to host up to 100 people by default.
-- Existing activity rows and their configured participant limits are preserved.
alter table public.activities
  alter column max_participants set default 100;

alter table public.activities
  drop constraint if exists activities_max_participants_check;

alter table public.activities
  add constraint activities_max_participants_check
  check (max_participants <= 100);
