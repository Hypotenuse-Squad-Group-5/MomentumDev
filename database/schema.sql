-- =====================================================================
-- Momentum: database schema (Supabase / PostgreSQL)
--
-- HOW TO USE
--   Supabase dashboard > SQL Editor > New query > paste this whole file > Run.
--   Safe to re-run: it drops and recreates everything in the app's tables.
--
-- WHAT'S IN HERE
--   1. Tables (this is what the ERD shows)
--   2. Business-rule triggers (things the database enforces itself)
--   3. Row Level Security (who can read/write what)
--   4. Seed data (the demo users, activities, and lessons)
--
-- Table groups, matching the PRD:
--   People ........ profiles, user_settings, interests, profile_interests, friendships
--   Activities .... activity_types, activities, activity_addresses, rsvps, rsvp_guests, activity_reports
--   Social ........ posts, post_photos, encouragements
--   Messaging ..... conversations, conversation_members, messages
--   Growth ........ lessons, lesson_stats, lesson_completions, habits, habit_checkins, point_events
--   System ........ notifications
-- =====================================================================

-- ---------- 0. Clean slate (re-runnable) ----------
drop table if exists
  notifications, point_events, habit_checkins, habits, lesson_completions,
  lesson_stats, lessons, messages, conversation_members, conversations,
  encouragements, post_photos, posts, activity_reports, rsvp_guests, rsvps,
  activity_addresses, activities, activity_types, friendships,
  profile_interests, interests, user_settings, profiles
  cascade;
drop function if exists momentum_seed_time(int, time) cascade;
drop function if exists momentum_check_activity_not_past() cascade;
drop function if exists momentum_check_rsvp_rules() cascade;
drop function if exists momentum_check_cancellation_rules() cascade;

-- =====================================================================
-- 1. TABLES
-- =====================================================================

-- ---------- People ----------

-- One row per person. auth_user_id links to Supabase's built-in login table.
-- It is nullable only so the demo accounts below can exist before login is built.
create table profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete cascade,
  username      text not null unique,
  first_name    text not null,
  last_name     text,
  email         text unique,
  phone         text,
  home_address  text,                 -- private; only used to sort activities by distance
  city          text,
  latitude      numeric(8,5),         -- city-level, for distance + map
  longitude     numeric(8,5),
  birthday      date,
  gender        text,
  bio           text check (char_length(bio) <= 160),
  avatar_url    text,
  created_at    timestamptz not null default now()
);

-- One row per profile (1-to-1). Privacy defaults + notification preferences.
create table user_settings (
  profile_id                  uuid primary key references profiles (id) on delete cascade,
  post_visibility             text not null default 'friends'
    check (post_visibility in ('public','friends_of_friends','friends','private')),
  activity_visibility         text not null default 'public'
    check (activity_visibility in ('public','friends_of_friends','friends','private')),
  friends_list_visibility     text not null default 'friends'
    check (friends_list_visibility in ('public','friends_of_friends','friends','private')),
  attendee_display            text not null default 'first_name'   -- how non-friends see you on "Who's going"
    check (attendee_display in ('first_name','hidden')),
  message_requests_from       text not null default 'anyone'
    check (message_requests_from in ('anyone','shared_activities','nobody')),
  notify_activity_reminders   boolean not null default true,       -- PL-13: 30 min before
  notify_habit_reminders      boolean not null default true,
  notify_friend_requests      boolean not null default true,
  notify_messages             boolean not null default true,
  reminders_by_email          boolean not null default false,
  daily_checkin_time          time not null default '21:30',
  pause_before_open           boolean not null default false,      -- "Could have": sign-in friction
  weekly_summary              boolean not null default true
);

create table interests (
  id    smallint generated always as identity primary key,
  name  text not null unique
);

-- Many-to-many: profiles <-> interests (used for filtering/suggestions)
create table profile_interests (
  profile_id   uuid not null references profiles (id) on delete cascade,
  interest_id  smallint not null references interests (id) on delete cascade,
  primary key (profile_id, interest_id)
);

-- SN-1: a request becomes a friendship when accepted. Removing a friend deletes the row.
create table friendships (
  id                  uuid primary key default gen_random_uuid(),
  requester_id        uuid not null references profiles (id) on delete cascade,
  addressee_id        uuid not null references profiles (id) on delete cascade,
  status              text not null default 'pending' check (status in ('pending','accepted')),
  met_at_activity_id  uuid,               -- FK added after activities exists ("Met at Board Game Night")
  created_at          timestamptz not null default now(),
  accepted_at         timestamptz,
  check (requester_id <> addressee_id)
);
-- Only one friendship per pair, whichever direction it was sent.
create unique index friendships_one_per_pair
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- ---------- Activities ----------

create table activity_types (
  id    smallint generated always as identity primary key,
  name  text not null unique
);

-- PL-0..PL-9. Exact address deliberately lives in a separate table (PL-2).
create table activities (
  id                uuid primary key default gen_random_uuid(),
  host_id           uuid not null references profiles (id) on delete cascade,
  type_id           smallint not null references activity_types (id),
  title             text not null check (char_length(title) between 1 and 60),
  activity_name     text not null,        -- the actual activity, e.g. "board games" (filterable)
  description       text not null check (char_length(description) <= 1000),
  what_to_bring     text,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  general_location  text not null,        -- public, e.g. "Kiwanis Park, Provo"
  city              text not null,
  latitude          numeric(8,5),         -- city-level pin for the map (PL-8)
  longitude         numeric(8,5),
  min_participants  smallint not null default 3,
  max_participants  smallint not null,
  visibility        text not null default 'public'   -- PL-3 / PL-4
    check (visibility in ('public','friends_of_friends','friends','private')),
  cover_photo_url   text,
  created_at        timestamptz not null default now(),
  check (ends_at > starts_at),
  check (min_participants >= 3),                       -- PL-1
  check (max_participants <= 20),
  check (min_participants <= max_participants)
);
create index activities_starts_at on activities (starts_at);

alter table friendships
  add constraint friendships_met_at_activity_fk
  foreign key (met_at_activity_id) references activities (id) on delete set null;

-- PL-2: the exact address. 1-to-1 with activities, locked down by RLS so only the
-- host and committed attendees can ever read it.
create table activity_addresses (
  activity_id    uuid primary key references activities (id) on delete cascade,
  exact_address  text not null
);

-- PL-10..PL-14. One RSVP per person per activity.
-- Cancelling is allowed (2 per month, not within 24h of start) and enforced by trigger.
create table rsvps (
  id             uuid primary key default gen_random_uuid(),
  activity_id    uuid not null references activities (id) on delete cascade,
  profile_id     uuid not null references profiles (id) on delete cascade,
  status         text not null default 'committed' check (status in ('committed','cancelled')),
  created_at     timestamptz not null default now(),
  cancelled_at   timestamptz,
  attended       boolean,               -- "Did you go?" check-in after the activity; null = not answered
  checked_in_at  timestamptz,
  unique (activity_id, profile_id)
);

-- The +1. One guest per RSVP: either a friend with an account (must accept, doesn't
-- hold a spot until they do) or a name-only guest (counts immediately).
create table rsvp_guests (
  id                uuid primary key default gen_random_uuid(),
  rsvp_id           uuid not null unique references rsvps (id) on delete cascade,
  guest_profile_id  uuid references profiles (id) on delete cascade,
  guest_first_name  text,
  status            text not null default 'pending'
    check (status in ('pending','accepted','declined','expired')),
  created_at        timestamptz not null default now(),
  responded_at      timestamptz,
  -- exactly one of: an account, or a typed first name
  check ((guest_profile_id is null) <> (guest_first_name is null))
);

-- Optional write-up shown on a past ("inactive") activity.
create table activity_reports (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references activities (id) on delete cascade,
  author_id    uuid not null references profiles (id) on delete cascade,
  body         text not null check (char_length(body) <= 1000),
  created_at   timestamptz not null default now(),
  unique (activity_id, author_id)
);

-- ---------- Social ----------

-- SN-3: photo + text posts on your own page. Optionally linked to an activity.
create table posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references profiles (id) on delete cascade,
  caption      text not null check (char_length(caption) <= 500),
  activity_id  uuid references activities (id) on delete set null,
  visibility   text not null default 'friends'
    check (visibility in ('public','friends_of_friends','friends','private')),
  created_at   timestamptz not null default now()
);
create index posts_author_created on posts (author_id, created_at desc);

-- 1 to 5 photos per post (the "at least 1" part is checked by the app on submit).
create table post_photos (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts (id) on delete cascade,
  photo_url  text not null,
  position   smallint not null check (position between 1 and 5),
  unique (post_id, position)
);

-- "Encourage": one tap per person per post. No public counts, no comments.
create table encouragements (
  post_id     uuid not null references posts (id) on delete cascade,
  profile_id  uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, profile_id)
);

-- ---------- Messaging (SN-4) ----------

-- kind = 'direct' (1-on-1) or 'activity_group' (max 20 people).
-- activity_id is set for group chats AND for direct chats started from an activity
-- page ("Message host"); those skip the message-request step.
create table conversations (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('direct','activity_group')),
  activity_id  uuid references activities (id) on delete set null,
  created_at   timestamptz not null default now(),
  archived_at  timestamptz,       -- direct: 6 months idle; group: 3 months idle
  check (kind = 'direct' or activity_id is not null)
);

-- status = 'requested' means the recipient hasn't accepted a message from a non-friend yet.
create table conversation_members (
  conversation_id  uuid not null references conversations (id) on delete cascade,
  profile_id       uuid not null references profiles (id) on delete cascade,
  status           text not null default 'active' check (status in ('active','requested','declined')),
  joined_at        timestamptz not null default now(),
  last_read_at     timestamptz,
  primary key (conversation_id, profile_id)
);

create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations (id) on delete cascade,
  sender_id        uuid not null references profiles (id) on delete cascade,
  body             text not null check (char_length(body) between 1 and 2000),
  created_at       timestamptz not null default now()
);
create index messages_conversation_created on messages (conversation_id, created_at);

-- ---------- Growth: lessons, habits, streaks & points ----------

-- ED-0 / ED-1. Lesson n unlocks when lesson n-1 is in lesson_completions.
create table lessons (
  id                smallint generated always as identity primary key,
  number            smallint not null unique,
  title             text not null,
  duration_minutes  smallint not null,
  body_markdown     text,
  goal_prompt       text not null,
  min_goal_words    smallint not null default 30
);

-- The big-number stat cards shown inside a lesson ("96 / average daily checks").
create table lesson_stats (
  id        smallint generated always as identity primary key,
  lesson_id smallint not null references lessons (id) on delete cascade,
  value     text not null,
  caption   text not null,
  source    text,                -- citation; required before launch
  position  smallint not null,
  unique (lesson_id, position)
);

create table lesson_completions (
  profile_id    uuid not null references profiles (id) on delete cascade,
  lesson_id     smallint not null references lessons (id) on delete cascade,
  user_goal_response text, --Add a text column to store what the user typed into the lesson goal prompt--
  habit_title text, --This makes sure the habit that the user enters in to the lesson will be stored--
  completed_at  timestamptz not null default now(),
  primary key (profile_id, lesson_id)
);


-- A daily habit. Habits created from a lesson keep the lesson link + the 30-word goal.
create table habits (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references profiles (id) on delete cascade,
  title            text not null check (char_length(title) <= 80),
  goal_text        text,                       -- the lesson reflection (30+ words)
  source_lesson_id smallint references lessons (id) on delete set null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- One row per habit per day completed. The streak = consecutive days with >= 1 row.
create table habit_checkins (
  habit_id    uuid not null references habits (id) on delete cascade,
  check_date  date not null,
  created_at  timestamptz not null default now(),
  primary key (habit_id, check_date)
);

-- THE single tracking unit. Every point-earning action writes one row here; the
-- points total is just sum(points). Cancelling an RSVP writes a negative row.
--   habit +10 · lesson +25 · rsvp +15 · attended +25 · first post of the day +5 · rsvp_cancelled -15
create table point_events (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles (id) on delete cascade,
  kind         text not null
    check (kind in ('habit','lesson','rsvp','attended','post','rsvp_cancelled')),
  points       smallint not null,
  habit_id     uuid references habits (id) on delete set null,
  lesson_id    smallint references lessons (id) on delete set null,
  rsvp_id      uuid references rsvps (id) on delete set null,
  post_id      uuid references posts (id) on delete set null,
  occurred_on  date not null default current_date,
  created_at   timestamptz not null default now()
);
-- Posts only earn points once per day (so the app never rewards posting volume).
create unique index point_events_one_post_per_day on point_events (profile_id, occurred_on) where kind = 'post';
create unique index point_events_one_per_habit_day on point_events (habit_id, occurred_on) where kind = 'habit';

-- ---------- System ----------

-- PL-13 reminders, friend requests, +1 invites, etc.
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles (id) on delete cascade,
  kind        text not null
    check (kind in ('activity_reminder','plus_one_invite','friend_request','message','streak')),
  title       text not null,
  body        text,
  link        text,
  send_at     timestamptz not null default now(),
  sent_at     timestamptz,
  read_at     timestamptz
);

-- =====================================================================
-- 2. BUSINESS-RULE TRIGGERS
-- =====================================================================

-- PL-6: can't post an activity that starts in the past.
create function momentum_check_activity_not_past() returns trigger
language plpgsql as $$
begin
  if new.starts_at < now() then
    raise exception 'Activity must start in the future.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- PL-14: no committed RSVPs within 30 minutes of each other. Also enforces max size.
create function momentum_check_rsvp_rules() returns trigger
language plpgsql as $$
declare
  a activities%rowtype;
  taken int;
begin
  if new.status <> 'committed' then return new; end if;
  select * into a from activities where id = new.activity_id;

  if exists (
    select 1
    from rsvps r join activities o on o.id = r.activity_id
    where r.profile_id = new.profile_id
      and r.status = 'committed'
      and r.activity_id <> new.activity_id
      and tstzrange(o.starts_at - interval '30 minutes', o.ends_at + interval '30 minutes')
          && tstzrange(a.starts_at, a.ends_at)
  ) then
    raise exception 'This overlaps or is within 30 minutes of another activity you committed to.'
      using errcode = 'check_violation';
  end if;

  select count(*) into taken from rsvps
   where activity_id = new.activity_id and status = 'committed' and id <> new.id;
  if taken >= a.max_participants then
    raise exception 'This activity is full.' using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- Cancellations: max 2 per calendar month, never within 24 hours of the start.
create function momentum_check_cancellation_rules() returns trigger
language plpgsql as $$
declare
  starts timestamptz;
  used int;
begin
  if new.status = 'cancelled' and old.status = 'committed' then
    select starts_at into starts from activities where id = new.activity_id;
    if starts - now() < interval '24 hours' then
      raise exception 'Commitments can''t be cancelled within 24 hours of the start.'
        using errcode = 'check_violation';
    end if;
    select count(*) into used from rsvps
     where profile_id = new.profile_id and status = 'cancelled'
       and date_trunc('month', cancelled_at) = date_trunc('month', now());
    if used >= 2 then
      raise exception 'You''ve used both cancellations for this month.' using errcode = 'check_violation';
    end if;
    new.cancelled_at := now();
  end if;
  return new;
end $$;

-- (Triggers are attached after the seed data so past demo activities can be inserted.)

-- =====================================================================
-- 3. ROW LEVEL SECURITY
-- RLS on everywhere = locked by default. The policies below open ONLY what the
-- vertical slice needs.
-- !! DEMO POLICIES: "anyone can insert activities" exists because login isn't
-- !! built yet. Replace with auth.uid()-based policies once it is.
-- =====================================================================
alter table profiles             enable row level security;
alter table user_settings        enable row level security;
alter table interests            enable row level security;
alter table profile_interests    enable row level security;
alter table friendships          enable row level security;
alter table activity_types       enable row level security;
alter table activities           enable row level security;
alter table activity_addresses   enable row level security;
alter table rsvps                enable row level security;
alter table rsvp_guests          enable row level security;
alter table activity_reports     enable row level security;
alter table posts                enable row level security;
alter table post_photos          enable row level security;
alter table encouragements       enable row level security;
alter table conversations        enable row level security;
alter table conversation_members enable row level security;
alter table messages             enable row level security;
alter table lessons              enable row level security;
alter table lesson_stats         enable row level security;
alter table lesson_completions   enable row level security;
alter table habits               enable row level security;
alter table habit_checkins       enable row level security;
alter table point_events         enable row level security;
alter table notifications        enable row level security;

-- Public reference data
create policy "read activity types" on activity_types for select to anon, authenticated using (true);
create policy "read interests"      on interests      for select to anon, authenticated using (true);
create policy "read lessons"        on lessons        for select to anon, authenticated using (true);
create policy "read lesson stats"   on lesson_stats   for select to anon, authenticated using (true);

-- Slice: read host names, read public activities, post new activities.
create policy "demo: read profiles"          on profiles   for select to anon, authenticated using (true);
create policy "read public activities"       on activities for select to anon, authenticated using (visibility = 'public');
create policy "demo: anyone posts activities" on activities for insert to anon, authenticated with check (true);

-- PL-2 in action: the address can be WRITTEN by the form, but there is no select
-- policy, so the public feed can never read it.
create policy "demo: anyone saves an address" on activity_addresses for insert to anon, authenticated with check (true);

-- =====================================================================
-- 4. SEED DATA (demo content; delete this section for a clean database)
-- Fixed IDs so the website's local demo data lines up with these rows.
-- =====================================================================

-- Helper: "N days from today at HH:MM, Provo time"
create function momentum_seed_time(days int, at time) returns timestamptz
language sql as $$
  select ((date_trunc('day', now() at time zone 'America/Denver') + make_interval(days => days) + at)
          at time zone 'America/Denver')
$$;

insert into activity_types (name) values
  ('Outdoors · Relaxed'), ('Outdoors · Active'), ('Indoors · Relaxed'),
  ('Indoors · Active'), ('Food & social'), ('Learning & creative');

insert into interests (name) values
  ('Pickleball'), ('Reading'), ('Hiking'), ('Board games'), ('Cooking'),
  ('Music'), ('Climbing'), ('Art'), ('Volleyball'), ('Puzzles');

insert into profiles (id, username, first_name, last_name, email, city, latitude, longitude, bio) values
  ('aaaaaaaa-0000-4000-8000-000000000001','chase','Chase','Example','chase@example.com','Provo, UT',40.23380,-111.65850,'Student in Provo. Trying to swap scrolling for actually doing things.'),
  ('aaaaaaaa-0000-4000-8000-000000000002','mia','Mia','Thompson','mia@example.com','Provo, UT',40.24500,-111.66200,'Board game collector, amateur puzzle champion, always hosting something.'),
  ('aaaaaaaa-0000-4000-8000-000000000003','jake','Jake','Rivera','jake@example.com','Provo, UT',40.22100,-111.64400,'Trying to spend more weekends outside than on my couch.'),
  ('aaaaaaaa-0000-4000-8000-000000000004','taylor','Taylor','Brooks','taylor@example.com','Orem, UT',40.29690,-111.69460,'Climber. Will teach you to fall safely.'),
  ('aaaaaaaa-0000-4000-8000-000000000005','alex','Alex','Park','alex@example.com','Provo, UT',40.22800,-111.67300,null),
  ('aaaaaaaa-0000-4000-8000-000000000006','jordan','Jordan','Kim','jordan@example.com','Provo, UT',40.25100,-111.64900,null),
  ('aaaaaaaa-0000-4000-8000-000000000007','riley','Riley','Shaw','riley@example.com','Springville, UT',40.16520,-111.61070,null),
  ('aaaaaaaa-0000-4000-8000-000000000008','sam','Sam','Lee','sam@example.com','Provo, UT',40.23900,-111.66900,null);

insert into user_settings (profile_id)
  select id from profiles;

insert into profile_interests (profile_id, interest_id)
  select 'aaaaaaaa-0000-4000-8000-000000000001', id from interests where name in ('Pickleball','Reading','Hiking');

insert into activities (id, host_id, type_id, title, activity_name, description, what_to_bring,
                        starts_at, ends_at, general_location, city, latitude, longitude,
                        min_participants, max_participants) values
  ('bbbbbbbb-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002',
   (select id from activity_types where name='Indoors · Relaxed'),'Board Game Night','board games',
   'Codenames, Ticket to Ride, and whatever you bring. Snacks provided, competitiveness optional.','A snack to share',
   momentum_seed_time(2,'19:00'), momentum_seed_time(2,'21:30'),'Downtown Provo','Provo',40.23500,-111.65900,4,12),
  ('bbbbbbbb-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000005',
   (select id from activity_types where name='Outdoors · Relaxed'),'Sunset picnic at Kiwanis Park','picnic',
   'Blankets, sandwiches, and watching the sun go down over the lake. Come hungry.','Something to sit on',
   momentum_seed_time(1,'18:30'), momentum_seed_time(1,'20:00'),'Kiwanis Park, Provo','Provo',40.24800,-111.64300,3,10),
  ('bbbbbbbb-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000006',
   (select id from activity_types where name='Outdoors · Active'),'Pickup volleyball','volleyball',
   'Sand courts, rotating teams, all skill levels. We keep score loosely.',null,
   momentum_seed_time(7,'20:00'), momentum_seed_time(7,'22:00'),'Provo sand courts','Provo',40.25600,-111.65000,6,20),
  ('bbbbbbbb-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-000000000004',
   (select id from activity_types where name='Indoors · Active'),'Beginner rock climbing','rock climbing',
   'Never climbed before? Good, neither have most of us. We''ll rent shoes, learn the basics from the front desk, and spend a couple hours on the easy walls.','About $15 for a day pass',
   momentum_seed_time(5,'19:00'), momentum_seed_time(5,'21:00'),'Climbing gym, Orem','Orem',40.29700,-111.69500,4,8),
  ('bbbbbbbb-0000-4000-8000-000000000005','aaaaaaaa-0000-4000-8000-000000000003',
   (select id from activity_types where name='Outdoors · Active'),'Bridal Veil Falls hike','hiking',
   'Easy to moderate hike, then breakfast burritos after. Beginners welcome. We go at the slowest person''s pace.','Water, good shoes, a jacket',
   momentum_seed_time(9,'09:00'), momentum_seed_time(9,'12:00'),'Provo Canyon','Provo Canyon',40.33500,-111.60100,3,15),
  ('bbbbbbbb-0000-4000-8000-000000000006','aaaaaaaa-0000-4000-8000-000000000007',
   (select id from activity_types where name='Indoors · Relaxed'),'Journaling & hot cocoa','journaling',
   'Quiet hour of writing with a few prompts if you want them, then cocoa and conversation.','A notebook',
   momentum_seed_time(4,'19:00'), momentum_seed_time(4,'20:30'),'Springville library area','Springville',40.16500,-111.61100,3,8),
  ('bbbbbbbb-0000-4000-8000-000000000007','aaaaaaaa-0000-4000-8000-000000000008',
   (select id from activity_types where name='Learning & creative'),'Coffee & sketching','sketching',
   'Bring a notebook or borrow supplies. No talent required, just show up and draw what''s in front of you.',null,
   momentum_seed_time(6,'11:00'), momentum_seed_time(6,'12:30'),'Cafe near Center Street','Provo',40.23400,-111.66100,3,6),
  ('bbbbbbbb-0000-4000-8000-000000000008','aaaaaaaa-0000-4000-8000-000000000006',
   (select id from activity_types where name='Food & social'),'Late-night ice cream run','ice cream',
   'Quick ice cream run after the evening winds down. In and out in 45 minutes.',null,
   momentum_seed_time(2,'21:45'), momentum_seed_time(2,'22:30'),'University Ave, Provo','Provo',40.24200,-111.65800,3,10),
  -- Past activities (calendar history + "Did you go?")
  ('bbbbbbbb-0000-4000-8000-000000000009','aaaaaaaa-0000-4000-8000-000000000002',
   (select id from activity_types where name='Food & social'),'Potluck & card games','potluck',
   'Bring a dish, stay for cards.','A dish to share',
   momentum_seed_time(-5,'18:00'), momentum_seed_time(-5,'21:00'),'North Provo','Provo',40.25800,-111.66000,3,15),
  ('bbbbbbbb-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000001',
   (select id from activity_types where name='Outdoors · Active'),'Pickleball in the park','pickleball',
   'Casual doubles. Extra paddles available.','Paddle if you have one',
   momentum_seed_time(-12,'10:00'), momentum_seed_time(-12,'12:00'),'Provo city park','Provo',40.23000,-111.65200,4,8);

insert into activity_addresses (activity_id, exact_address)
  select id, '123 Example St, ' || city || ', UT' from activities;

insert into friendships (requester_id, addressee_id, status, met_at_activity_id, accepted_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','accepted','bbbbbbbb-0000-4000-8000-000000000009', now() - interval '40 days'),
  ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000001','accepted','bbbbbbbb-0000-4000-8000-000000000010', now() - interval '12 days');
insert into friendships (requester_id, addressee_id, status) values
  ('aaaaaaaa-0000-4000-8000-000000000008','aaaaaaaa-0000-4000-8000-000000000001','pending');

insert into rsvps (activity_id, profile_id, attended) values
  ('bbbbbbbb-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001',null),
  ('bbbbbbbb-0000-4000-8000-000000000005','aaaaaaaa-0000-4000-8000-000000000001',null),
  ('bbbbbbbb-0000-4000-8000-000000000009','aaaaaaaa-0000-4000-8000-000000000001',true),
  ('bbbbbbbb-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000001',null),
  ('bbbbbbbb-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000003',null),
  ('bbbbbbbb-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000008',null),
  ('bbbbbbbb-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000007',null),
  ('bbbbbbbb-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-000000000005',null),
  ('bbbbbbbb-0000-4000-8000-000000000005','aaaaaaaa-0000-4000-8000-000000000002',null),
  ('bbbbbbbb-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000008',null);

insert into rsvp_guests (rsvp_id, guest_first_name, status)
  select id, 'Alex', 'accepted' from rsvps
  where activity_id = 'bbbbbbbb-0000-4000-8000-000000000001' and profile_id = 'aaaaaaaa-0000-4000-8000-000000000003';

insert into lessons (number, title, duration_minutes, goal_prompt, body_markdown) values
  (1,'How your phone is engineered to hook you',6,
   'Which hook gets you most? When does it usually happen, and what''s one specific change you''ll make this week to interrupt it?',
   'Most social apps are free because your attention is what they sell... (full lesson text lives in the site for now)'),
  (2,'Notice your attention cues',6,'Write down the one cue you will watch for this week, and what you''ll do instead when you notice it.',null),
  (3,'Comparison and your mood',7,'Who or what do you compare yourself to online, and how will you limit it?',null),
  (4,'Screens, sleep, and focus',6,'What will your phone''s bedtime be, and where will it sleep?',null),
  (5,'Setting up a phone that works for you',8,'List the three changes you''ll make to your phone setup today.',null);

insert into lesson_stats (lesson_id, value, caption, position) values
  (1,'96','times a day a typical person checks their phone (placeholder: cite a source)',1),
  (1,'4.8h','average daily screen time (placeholder: cite a source)',2),
  (1,'23m','to fully refocus after an interruption (placeholder: cite a source)',3);

insert into habits (id, profile_id, title, created_at) values
  ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','Phone charges across the room by 10:30 PM', now() - interval '20 days'),
  ('cccccccc-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','No phone for the first 30 minutes after waking up', now() - interval '20 days');

-- Six days of habit check-ins ending yesterday = a 6-day streak.
insert into habit_checkins (habit_id, check_date)
  select 'cccccccc-0000-4000-8000-000000000001', (current_date - g)::date from generate_series(1,6) g;
insert into point_events (profile_id, kind, points, habit_id, occurred_on)
  select 'aaaaaaaa-0000-4000-8000-000000000001','habit',10,'cccccccc-0000-4000-8000-000000000001',(current_date - g)::date
  from generate_series(1,6) g;

insert into posts (id, author_id, caption, activity_id, created_at) values
  ('dddddddd-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','Finished the 1,000-piece puzzle from game night. Three weeks, zero screens. Weirdly proud of this one.',null, now() - interval '1 day'),
  ('dddddddd-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000003','First time bouldering outdoors. Fell off the same route about fifteen times. Would fall again.',null, now() - interval '4 days'),
  ('dddddddd-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000001','One week of charging my phone in the kitchen overnight. Sleeping better, and I finished my first book in months.',null, now() - interval '2 days');
insert into post_photos (post_id, photo_url, position) values
  ('dddddddd-0000-4000-8000-000000000001','placeholder://photo',1),
  ('dddddddd-0000-4000-8000-000000000002','placeholder://photo',1),
  ('dddddddd-0000-4000-8000-000000000003','placeholder://photo',1);

insert into activity_reports (activity_id, author_id, body) values
  ('bbbbbbbb-0000-4000-8000-000000000009','aaaaaaaa-0000-4000-8000-000000000002',
   'Twelve people showed up, double what I expected. Someone''s homemade salsa started a full debate.');

-- Attach the rule triggers now that the historical seed rows are in.
create trigger activities_not_in_past before insert on activities
  for each row execute function momentum_check_activity_not_past();
create trigger rsvps_rules before insert or update of status on rsvps
  for each row execute function momentum_check_rsvp_rules();
create trigger rsvps_cancellation_rules before update of status on rsvps
  for each row execute function momentum_check_cancellation_rules();

drop function momentum_seed_time(int, time);
