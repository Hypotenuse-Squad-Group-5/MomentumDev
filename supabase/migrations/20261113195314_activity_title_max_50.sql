alter table public.activities
  drop constraint if exists activities_title_check;

alter table public.activities
  add constraint activities_title_check
  check (char_length(title) between 1 and 50);
