-- =====================================================================
-- Migration 005: interests saved per profile, list managed in the database
--
-- WHAT THIS CHANGES (plain English):
--   1. The `interests` table gets two admin-friendly columns:
--        sort_order  the order interests appear in Settings (lower = first)
--        is_active   false = retired: hidden from the picker, but anyone who
--                    already picked it keeps it (no broken data)
--   2. Loads the team's 65 interests (from settings.js) into the table, in that order.
--      Old seed names that aren't in the new list ("Reading", "Cooking") are retired.
--   3. `profile_interests` (who picked what) gets "own rows only" security:
--      you can read, add, and remove only your own picks, and only active interests.
--
-- ADMIN: add, rename, reorder, or retire interests in Supabase → Table Editor →
--        interests. The website picks up changes on the next page load.
--
-- HOW TO RUN (preview first):
--   Run as-is: you'll see the summary SELECT at the bottom. Nothing is committed.
--   If it looks right, uncomment `commit;` on the last line and run again.
-- =====================================================================

begin;

-- 1. Admin-friendly columns
alter table interests add column if not exists sort_order smallint not null default 1000;
alter table interests add column if not exists is_active boolean not null default true;

-- 2. The team's list, in the team's order (re-running is safe: existing names are updated)
insert into interests (name, sort_order) values
  ('Pickleball', 1),
  ('Hiking', 2),
  ('Board games', 3),
  ('Music', 4),
  ('Climbing', 5),
  ('Art', 6),
  ('Volleyball', 7),
  ('Puzzles', 8),
  ('Running & Jogging', 9),
  ('Tennis', 10),
  ('Basketball', 11),
  ('Soccer', 12),
  ('Swimming', 13),
  ('Weightlifting & Fitness', 14),
  ('Yoga', 15),
  ('Pilates', 16),
  ('Cycling & Biking', 17),
  ('Skiing & Snowboarding', 18),
  ('Martial Arts', 19),
  ('Dance', 20),
  ('Painting & Drawing', 21),
  ('Photography', 22),
  ('Creative Writing & Journaling', 23),
  ('Crafting & DIY', 24),
  ('Knitting & Crochet', 25),
  ('Pottery & Ceramics', 26),
  ('Graphic Design', 27),
  ('Graphic Novels & Comics', 28),
  ('Woodworking', 29),
  ('Fixing Cars', 30),
  ('Welding', 31),
  ('Movies & Film', 32),
  ('TV Shows & Binge-Watching', 33),
  ('Reading & Literature', 34),
  ('Anime', 35),
  ('Listening to Podcasts', 36),
  ('Live Concerts', 37),
  ('Theater & Performing Arts', 38),
  ('Stand-Up Comedy', 39),
  ('Playing an Instrument', 40),
  ('Video Games', 41),
  ('Coding & Tech Projects', 42),
  ('Cooking & Baking', 43),
  ('Foodie & Restaurant Exploring', 44),
  ('Travel & Exploring', 45),
  ('Gardening & Houseplants', 46),
  ('Camping & Outdoorsy', 47),
  ('Fashion & Style', 48),
  ('Skincare & Beauty', 49),
  ('Interior Design & Decor', 50),
  ('Thrifting & Vintage Shopping', 51),
  ('Volunteering & Community Service', 52),
  ('Meditation & Mindfulness', 53),
  ('Language Learning', 54),
  ('Personal Finance & Investing', 55),
  ('Astronomy & Stargazing', 56),
  ('Meal Prepping', 57),
  ('Content Creation & Streaming', 58),
  ('Entrepreneurship', 59),
  ('Campus Clubs', 60),
  ('Spirituality & Church', 61),
  ('Driving', 62),
  ('Off-roading', 63),
  ('Campus Events', 64),
  ('Sports Games', 65)
on conflict (name) do update set sort_order = excluded.sort_order, is_active = true;

update interests set is_active = false
where name not in (select unnest(array['Pickleball', 'Hiking', 'Board games', 'Music', 'Climbing', 'Art', 'Volleyball', 'Puzzles', 'Running & Jogging', 'Tennis', 'Basketball', 'Soccer', 'Swimming', 'Weightlifting & Fitness', 'Yoga', 'Pilates', 'Cycling & Biking', 'Skiing & Snowboarding', 'Martial Arts', 'Dance', 'Painting & Drawing', 'Photography', 'Creative Writing & Journaling', 'Crafting & DIY', 'Knitting & Crochet', 'Pottery & Ceramics', 'Graphic Design', 'Graphic Novels & Comics', 'Woodworking', 'Fixing Cars', 'Welding', 'Movies & Film', 'TV Shows & Binge-Watching', 'Reading & Literature', 'Anime', 'Listening to Podcasts', 'Live Concerts', 'Theater & Performing Arts', 'Stand-Up Comedy', 'Playing an Instrument', 'Video Games', 'Coding & Tech Projects', 'Cooking & Baking', 'Foodie & Restaurant Exploring', 'Travel & Exploring', 'Gardening & Houseplants', 'Camping & Outdoorsy', 'Fashion & Style', 'Skincare & Beauty', 'Interior Design & Decor', 'Thrifting & Vintage Shopping', 'Volunteering & Community Service', 'Meditation & Mindfulness', 'Language Learning', 'Personal Finance & Investing', 'Astronomy & Stargazing', 'Meal Prepping', 'Content Creation & Streaming', 'Entrepreneurship', 'Campus Clubs', 'Spirituality & Church', 'Driving', 'Off-roading', 'Campus Events', 'Sports Games']));

-- 3. Security: everyone reaches only their own picks
drop policy if exists "read own interests" on profile_interests;
drop policy if exists "add own interests" on profile_interests;
drop policy if exists "remove own interests" on profile_interests;

create policy "read own interests" on profile_interests
  for select to authenticated
  using (profile_id = public.current_profile_id());

create policy "add own interests" on profile_interests
  for insert to authenticated
  with check (
    profile_id = public.current_profile_id()
    and exists (select 1 from interests i where i.id = interest_id and i.is_active)
  );

create policy "remove own interests" on profile_interests
  for delete to authenticated
  using (profile_id = public.current_profile_id());

-- Picks can be added or removed, never edited in place.
revoke update on profile_interests from anon, authenticated;
revoke insert, delete on profile_interests from anon;

-- ---------- Preview: what changed ----------
select
  (select count(*) from interests where is_active)                          as active_interests,
  (select string_agg(name, ', ') from interests where not is_active)        as retired_interests,
  (select string_agg(name, ', ' order by sort_order) from (select name, sort_order from interests where is_active order by sort_order limit 5) t) as first_five,
  (select string_agg(policyname, ', ' order by policyname) from pg_policies where tablename = 'profile_interests') as profile_interest_policies;

-- commit;
