# Momentum (Hypotenuse-Squad--Group-5)

## App Summary
Young, isolated college students in Provo spend too much time on their phones rather than forming real connections and do not have effective resources to help them develop better habits and find long-term satisfaction. This increased amount of screen time frequently leads them to feeling alone, worsens their mental health, and makes it more difficult to form real-life social support networks during challenging college years. They need to find meaningful ways to spend their free time, especially in the evenings, to avoid doom scrolling. This website should motivate them to have less desire to unintentionally waste time throughout down time each day. They will be able to RSVP to various activities, post their own, communicate with others who are attending events in Provo, learn more about the effects of social media, and create and apply realistic goals or habits.

---

## Tech Stack
We decided to use **HTML/CSS/JavaScript** for our frontend. Our hosting service is **GitHub Pages**, and as our backend database and authentication service we are using **Supabase** (PostgreSQL). We decided to go this route for several reasons:
- **Simplicity & Maintainability**: HTML, CSS, and modern JavaScript require no complex build systems, transpilers, or bundlers, making team collaboration and direct editing seamless.
- **Robust Backend**: Supabase gives us real-time PostgreSQL database features, Row Level Security (RLS) to enforce data privacy at the database layer, secure Supabase Auth, and Storage buckets for user uploads.
- **Cost-Effective**: We wanted to avoid recurring paid infrastructure or consuming expensive AI service tokens quickly, though we leveraged AI assistance (like Claude) to help organize and refine our code with the resources provided.
- **Ease of Colaboration**: Hosting the site live through GitHub Pages makes it very easy for our team members to access and edit the code, as well as test the live site.

---

## Key Features
- **Interactive Habit Curriculum**: 6 structured interactive lessons covering phone habits, cues, screen reduction, and offline connections with reflection prompts and habit formation.
- **Habit & Momentum Tracking**: Set daily habits and maintain daily check-in streaks tracked dynamically through Supabase.
- **In-Person Activities & Commitments**: Browse, filter, host, and RSVP to local activities (supporting up to 100 participants) with host address privacy controls and capacity limits.
- **Social Connection & Friends**: Send and accept friend requests, discover mutual connections, and filter activity visibility between Public and Friends-Only.
- **Friends-Only Feed**: Share and view text posts with friends.
- **Direct Messaging**: Direct 1-on-1 private messaging with integrated user blocking for safety.
- **User Profiles & Avatars**: Customizable user profiles with interests and profile picture uploads stored in Supabase Storage.

---

## How to Get It Running

### Deploying to GitHub Pages
To host the frontend live on GitHub Pages:
1. Push or fork the repository to your GitHub account.
2. In your GitHub repository, navigate to **Settings** > **Pages** (in the left sidebar).
3. Under **Build and deployment** > **Source**, choose **"Deploy from a branch"**.
4. Under **Branch**, select `main` (or default branch) and `/ (root)` directory, then click **Save**.
5. Wait 1–2 minutes; GitHub will provide your live URL (e.g., `https://<your-username>.github.io/<repo-name>/`).

---

### Setting Up a New Supabase Backend (From Scratch)
If you wish to host and run Momentum against your own independent Supabase project rather than the shared team database:

1. **Create a Supabase Project:**
   - Go to [supabase.com](https://supabase.com), log in, and click **New Project**.
   - Select your organization, choose a database password, and pick a nearby region.

2. **Initialize Database Schema & Tables:**
   - In your Supabase dashboard, open the **SQL Editor** from the left sidebar.
   - Click **New query**, paste the entire contents of [`database/schema.sql`], and click **Run**.
   - This sets up the base tables, security policies, and initial seed data.

3. **Apply Database Migrations:**
   - Run the migration files located in [`database/`] in sequential order (`001_accounts.sql` through `022_friends_only_posts.sql`), along with [`supabase/migrations/20261116000000_activity_capacity_100.sql`].
   - Key migrations include:
     - `001_accounts.sql`: Links Supabase Auth to profile records and configures per-user RLS.
     - `007_lesson_sync.sql` & `008_reflection_character_limit.sql`: Version-2 interactive curriculum with atomic habit completion and reflection limits.
     - `007_profile_photos.sql`: Sets up the `avatars` storage bucket and photo permissions.
     - `010_friendships.sql`, `011_messaging.sql`, `015_user_blocks.sql`: Social graph, real-time messaging, and blocking.
     - `018_commitments.sql`, `019_friends_activity_visibility.sql`, `020_fix_friends_activity_rls.sql`: Activity RSVPs, guest attendance, and Friends-Only visibility.
     - `022_friends_only_posts.sql`: Enforces friends-only post security.

4. **Verify Storage Bucket:**
   - Go to **Storage** in the Supabase dashboard.
   - Ensure an `avatars` bucket exists, is set to **Public**, and has a 1MB file size limit for profile photos (configured by migration 007).

5. **Configure Supabase Authentication Settings:**
   - Go to **Authentication** > **URL Configuration**:
     - **Site URL**: Enter your local server or GitHub Pages URL (e.g., `http://localhost:8000` or `https://<your-username>.github.io/<repo-name>/`).
     - **Redirect URLs**: Add `http://localhost:*/**`, `http://127.0.0.1:*/**`, and your GitHub Pages domain.
   - *(Optional for frictionless grading/testing)*: Under **Authentication** > **Providers** > **Email**, toggle **"Confirm email"** to **Off** so new accounts can log in immediately without waiting for confirmation emails.

6. **Connect the Frontend (`js/config.js`):**
   - In Supabase, go to **Project Settings** > **API** (or Data API).
   - Copy your **Project URL** and the **anon / public** key (`sb_publishable_...` or JWT).
   - Open [`js/config.js`] in your repository and update:
     ```javascript
     window.MOMENTUM_CONFIG = {
       SUPABASE_URL: "https://your-project-id.supabase.co",
       SUPABASE_ANON_KEY: "your-anon-publishable-key",
     };
     ```
   > [CAUTION]
   > Never place the `service_role` (secret) key in `config.js` or frontend files. The `anon` key is designed to be public because data security is enforced through PostgreSQL Row Level Security (RLS).

---

## Running Automated Tests
The repository includes unit and integration tests covering lesson progression, friend requests, visibility rules, and store methods using Node.js's built-in test runner:

```bash
# Run all test suites
node --test

# Or run a specific test suite
node --test tests/lessons.test.cjs
node --test tests/activity-visibility.test.cjs
node --test tests/friendships.test.cjs
```

---

## Generating / Viewing the ERD in Lucidchart
Lucidchart can import your database schema directly to generate the exact ERD:
1. In a Lucidchart document, select **File** > **Import Data** > **Entity Relationship (ERD)**.
2. Select **PostgreSQL** as the source. Lucidchart displays an SQL query.
3. In Supabase, go to **SQL Editor** > **New query**, paste Lucidchart's query, and click **Run**.
4. In the query results panel, export the result as **CSV**.
5. Back in Lucidchart, upload the CSV and drag the `public` schema tables onto your canvas. Foreign key relationship lines will draw themselves automatically.
*(Alternatively, view the live database visualizer inside Supabase under **Database** > **Schema Visualizer**).*

---

## ERD
<img width="1652" height="1277" alt="Momentum_ERD_FInal_page-0001" src="https://github.com/user-attachments/assets/324e5491-9231-4aa4-bef9-58fdee511903" />

---

## Level 0 Diagram
<img width="2337" height="1528" alt="Sprint Retrospective (Team 2-5)" src="https://github.com/user-attachments/assets/1e953dd6-277e-478c-8f67-e3c58d4461ae" />

---

## Level 1 Diagram
<img width="2555" height="1774" alt="Sprint Retrospective (Team 2-5) (1)" src="https://github.com/user-attachments/assets/c736f8a3-dc73-46a6-ab38-5f302c60eac0" />
