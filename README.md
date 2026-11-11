# Momentum

Momentum helps students build intentional phone habits, practice six short lessons, and plan time together offline. The app uses buildless HTML/CSS/JavaScript, GitHub Pages, and Supabase Auth/Postgres.

## Lessons and habits

The site includes curriculum version 2:

1. Habits & Goals
2. Your Phone’s Pull
3. Scroll Less, Sleep Better
4. Find Your Offline
5. Build Real Connection
6. Make Plans That Stick

Each unfinished lesson ends with a reflection (no word minimum, 1,000 characters maximum; a nonblank response is required), a daily habit name (1–80 characters), and Finish lesson. Finishing while signed in saves the reflection, completion, linked habit, and lesson points in one database transaction. Retrying does not create another habit or award points twice. The app waits for confirmation and preserves typed answers on failure.

Lesson 1 is available first. Each later lesson unlocks after the previous lesson is completed; Supabase independently rejects completion if any earlier lesson is unfinished.

Home and the completed lesson display the same habit record. Renaming or archiving it on Home is reflected when the lesson is reopened. Habits and completion records are scoped to the authenticated user's profile, and reload/sign-in restores progress from Supabase. Practice quizzes and planner fields are not individually stored; a plan is included in the saved reflection only when the learner chooses to add it.

Old five-lesson database records and existing habits are preserved as curriculum version 1. They are not automatically marked as completions of the reordered six-lesson curriculum. Lesson numbers in URLs are curriculum positions, not database IDs.

## Running locally

From this directory run `python3 -m http.server 8765`, then open `http://localhost:8765/`.

- With configured publishable credentials in `js/config.js`, sign in with a real Supabase account. Actions can write real database records.
- For an isolated demo, use a separate copy of the site and set `window.MOMENTUM_CONFIG = {};` in that copy's config. Demo data stays in that browser and does not test database sync.
- Reload with Cmd+Shift+R after source changes. A fresh private window gives a fresh demo session.
- Never put a Supabase service-role/secret key in frontend files.

## Account creation and recovery

The public landing page is `index.html`. Sign-in lives at `login.html`; `login.html#signup` opens account creation. The landing page links to both.

The current signup form requires first name, last name, email, password, sex, and an explicit 18-or-older confirmation on the signup form. The live schema no longer stores profile city/state, address, phone, or birthdate; account reads and updates must not request these deleted columns. The signup metadata must include `age_confirmed: true` only after the user checks the age-confirmation box.

Supabase Auth accounts and application profiles are separate records. Deleting a `profile_private` or `profiles` row does not free the login email or rerun the signup trigger. A deliberate account reset should be handled by an authorized operator through Auth account removal and verified cascading app-data cleanup, including Storage API cleanup if files exist. This is permanent; do not use it merely to test lesson UI. Sign out of old sessions and use a fresh private window when recreating a removed account.

## Database deployment

Read [database/README.md](database/README.md) before applying anything. The lesson integration is `database/007_lesson_sync.sql`; it must be applied before deploying the sync code. Apply `database/008_reflection_character_limit.sql` afterward for the current paragraph-length limit. It adds versioned lesson metadata and a restricted completion function while preserving existing rows.

**Do not re-run `database/schema.sql` or historical account cleanup scripts on a live project.** `schema.sql` drops tables; older files describe historical setup, not a safe production reset or an exact snapshot of today's database. Use reviewed, incremental migrations for an existing project.

The SQL in this repository follows the team's numbered-file convention. Supabase migration history records production applications separately; do not blindly replay numbered files already installed on a project.

## Verification

- `node --test tests/*.test.cjs`: offline progression and mocked live integration/error handling.
- `database/internal/verify_lesson_sync.sql`: authorized-operator test of real database functions, account isolation, all six lessons, and retries. It rolls back test writes; use accounts without v2 completions as described in the file.
- Manual: finish lesson 1, check Home, rename/archive the habit, reopen the lesson, then sign in from another browser and verify restoration. Test a second account for isolation. A temporary offline preview does not establish that live sync works.

## Other existing features

The merged site preserves the public landing and About & Privacy pages, current account forms, profile-photo upload/removal, activities, text posts, interests, habit check-ins and points, and habit ordering/archiving. Other screens still include browser-local behavior; do not assume messaging, RSVP flows, or all social features are fully synchronized. Posts and activity features have their own migrations and permissions. Their behavior is outside this lesson migration.

## Team handoff

- [Lesson integration notes](docs/interactive-lessons-handoff.md)
- [Database operations and rollback](database/README.md)
- [Internal reporting](database/internal/README.md)

The interactive lesson slice is integrated into `main` while preserving its newer landing, account, and profile-photo work. `lesson/progress-sync` remains a separate historical branch; coordinate with its owner before merging overlapping Store changes.

## Level 0 Diagram
<img width="2337" height="1528" alt="Sprint Retrospective (Team 2-5)" src="https://github.com/user-attachments/assets/1e953dd6-277e-478c-8f67-e3c58d4461ae" />

## Level 1 Diagram
<img width="2555" height="1774" alt="Sprint Retrospective (Team 2-5) (1)" src="https://github.com/user-attachments/assets/c736f8a3-dc73-46a6-ab38-5f302c60eac0" />
