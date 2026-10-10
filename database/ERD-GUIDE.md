# Momentum: database + ERD guide

## 1. Create the database (5 minutes)

1. Go to supabase.com, sign in, and click **New project**. Pick a name (e.g. `momentum`), a database password (save it somewhere), and the closest region (West US).
2. Wait for it to finish setting up (about 2 minutes).
3. Left sidebar: **SQL Editor** > **New query**.
4. Open `schema.sql`, copy all of it, paste it in, and click **Run**.
   It should end with "Success. No rows returned." The notices about things "not existing, skipping" are normal the first time.
5. Left sidebar: **Table Editor**. You should see 24 tables, and `activities` should have 10 demo rows.

`schema.sql` is safe to re-run. It wipes and rebuilds the app's tables, which also resets the demo data.

## 2. Make the ERD in Lucidchart

Lucidchart builds the ERD from your real database, so the diagram and the database can't disagree.

1. In a Lucidchart document: **File > Import Data > Entity Relationship (ERD)**.
   (Menu wording can shift slightly between Lucid versions. Look for "Import your database".)
2. Choose **PostgreSQL** as the source. Lucid shows you a SQL query. Copy it.
3. Back in Supabase: **SQL Editor > New query**, paste Lucid's query, and click **Run**.
4. In the results panel, use the export/download button to save the results as **CSV**.
5. Back in Lucid, upload that CSV.
6. The tables appear in the left shape panel. Drag in **only the `public` schema tables**.
   Lucid's query also picks up Supabase's internal schemas (`auth`, `storage`, etc.). Leave those out.
   One exception: `auth.users` is worth including, because `profiles.auth_user_id` points at it.
7. Relationship lines draw themselves from the foreign keys. Arrange the tables in the six groups below.

**Backup view:** Supabase has its own auto-diagram under **Database > Schema Visualizer**. Use it to double-check that Lucid picked up every relationship.

## 3. How to explain the design (for the write-up / presentation)

24 tables in 6 groups:

| Group | Tables | PRD items |
|---|---|---|
| People | profiles, user_settings, interests, profile_interests, friendships | SN-0, SN-1, settings |
| Activities | activity_types, activities, activity_addresses, rsvps, rsvp_guests, activity_reports | PL-0 to PL-15, +1s, cancellations |
| Social | posts, post_photos, encouragements | SN-2, SN-3, Encourage |
| Messaging | conversations, conversation_members, messages | SN-4, Message host |
| Growth | lessons, lesson_stats, lesson_completions, habits, habit_checkins, point_events | ED-0, ED-1, streaks + points |
| System | notifications | PL-13 reminders |

Design decisions worth calling out:

- **The exact address has its own table (`activity_addresses`)** so the database itself can lock it down (PL-2). The public feed literally cannot read it, even if the website code had a bug.
- **`point_events` is the single tracking unit** for streaks and points. Every action (habit, lesson, RSVP, "I went", first post of the day) adds one row, and cancelling an RSVP adds a negative row. The total is a sum, and the history is auditable.
- **The streak is calculated, not stored:** consecutive days with at least one `habit_checkins` row. Nothing can get out of sync.
- **Cancellations are counted from `rsvps`**: rows with `status = 'cancelled'` this month. No extra table needed.
- **A +1 (`rsvp_guests`) is either a friend's account or a typed first name, never both.** A database check enforces this.
- **Rules the database enforces on its own** (triggers and constraints), tested:
  - activities can't start in the past
  - 3 to 20 participants
  - no RSVPs within 30 minutes of each other
  - activities can't overfill
  - max 2 cancellations a month, none within 24 hours of the start
  - one friendship per pair
  - post points only once a day

## 4. Security note (read before you demo)

Row Level Security is on for every table, so everything is locked by default.
For the vertical slice, four "demo" policies open just enough:
- anyone can read profiles, activity types, lessons, and public activities
- anyone can post an activity and its address

That's fine for a class demo. **Once login exists, replace the policies whose names start with `demo:`** with ones based on `auth.uid()`.

Supabase gives you two keys:
- **anon / publishable**: goes in the website's `js/config.js`. It's designed to be public; RLS is what protects the data.
- **service_role / secret**: never put it in the website, a repo, or a chat. It bypasses all security.
