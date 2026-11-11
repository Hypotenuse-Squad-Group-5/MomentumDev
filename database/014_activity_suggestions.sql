-- =====================================================================
-- Migration 014: starter suggestions for the "Activity" box
--
-- WHY: on "Post an activity", the Activity box shows a dropdown of ideas
-- (Board games, Pickleball, Hiking...). That list was typed into the JavaScript.
--
-- HOW THE DROPDOWN WORKS NOW (up to 10 ideas):
--   1. First, the most-used activity names on Momentum. A name only counts once
--      2+ different people have posted it (so one person can't spam it in), and
--      capitals/spaces are ignored ("Board games" = "board  games").
--   2. Then it fills the remaining spots from THIS table, lowest sort_order first.
--   Early on you'll mostly see these starters; as people post, popular names
--   push them down automatically. The popular part needs no table: the page
--   counts the activities it has already loaded.
--
-- TO EDIT the starters: Supabase > Table Editor > activity_suggestions.
-- Add, delete, or change sort_order. No code change needed.
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see the starter list at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again. Re-running is safe.
-- =====================================================================

begin;

create table if not exists public.activity_suggestions (
  id          smallint generated always as identity primary key,
  name        text not null unique check (char_length(name) between 1 and 40), -- same 40 limit as the Activity box
  sort_order  smallint
);

-- Signed-in members can read the starters; nobody can change them from the website
alter table public.activity_suggestions enable row level security;
drop policy if exists "signed-in users read activity suggestions" on public.activity_suggestions;
create policy "signed-in users read activity suggestions" on public.activity_suggestions
  for select to authenticated
  using (true);
revoke all on public.activity_suggestions from anon;
revoke insert, update, delete on public.activity_suggestions from authenticated;
grant select on public.activity_suggestions to authenticated;

-- The 11 ideas the page used to have typed in
insert into public.activity_suggestions (name, sort_order) values
  ('Board games',             1),
  ('Pickup volleyball',       2),
  ('Pickleball',              3),
  ('Sunset picnic',           4),
  ('Hiking',                  5),
  ('Potluck & snacks',        6),
  ('Mindfulness meditation',  7),
  ('Park cleanup',            8),
  ('Smash Bros & Mario Kart', 9),
  ('Co-working & study',     10),
  ('Sketching & art',        11)
on conflict (name) do nothing;

-- PREVIEW: the starters, in the order the dropdown uses them
select sort_order, name from public.activity_suggestions order by sort_order nulls last, name;

-- commit;
