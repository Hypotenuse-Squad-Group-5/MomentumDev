-- =====================================================================
-- Migration 023: OKR Reporting Views (Read-Only Metrics Display)
--
-- PURPOSE:
--   Read-only database views that report ACTUAL user data and track 
--   progress toward team OKRs. 
--
-- IMPORTANT:
--   - 100% Read-Only: These views DO NOT insert, modify, or delete any data.
--   - No data fabrication: All numbers and percentages represent actual 
--     recorded database rows.
--   - Restricted access: Revoked from anon/authenticated so data is not 
--     exposed on the frontend; accessible only to database admins.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Helper View: Actual Monthly Active Users
-- A user is counted as active in a calendar month if they signed in 
-- during that month OR recorded any activity (habit check-in, lesson, 
-- event RSVP, or post) in that month.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW okr_monthly_active_users AS
WITH user_activity_months AS (
  -- 1. Sign-ins recorded in auth.users
  SELECT 
    p.id AS profile_id,
    date_trunc('month', u.last_sign_in_at AT TIME ZONE 'America/Denver')::date AS month_start
  FROM auth.users u
  JOIN profiles p ON p.auth_user_id = u.id
  WHERE u.last_sign_in_at IS NOT NULL

  UNION

  -- 2. Habit check-ins
  SELECT 
    h.profile_id,
    date_trunc('month', c.check_date::timestamp)::date AS month_start
  FROM habit_checkins c
  JOIN habits h ON h.id = c.habit_id

  UNION

  -- 3. Lesson completions
  SELECT 
    lc.profile_id,
    date_trunc('month', lc.completed_at AT TIME ZONE 'America/Denver')::date AS month_start
  FROM lesson_completions lc

  UNION

  -- 4. Event commitments (RSVPs)
  SELECT 
    r.profile_id,
    date_trunc('month', r.created_at AT TIME ZONE 'America/Denver')::date AS month_start
  FROM rsvps r

  UNION

  -- 5. Social posts
  SELECT 
    po.author_id AS profile_id,
    date_trunc('month', po.created_at AT TIME ZONE 'America/Denver')::date AS month_start
  FROM posts po
)
SELECT 
  month_start,
  COUNT(DISTINCT profile_id) AS actual_monthly_active_users
FROM user_activity_months
GROUP BY month_start;

COMMENT ON VIEW okr_monthly_active_users IS 
  'Helper view: Displays actual count of distinct active users per month based on sign-in or recorded in-app action.';


-- ---------------------------------------------------------------------
-- View 1: OKR 1
-- Title: OKR 1: (Number of goals completed per week per user)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW okr_1_goals_completed_per_week AS
WITH weekly_completions AS (
  SELECT 
    date_trunc('week', c.check_date::timestamp)::date AS week_of,
    COUNT(c.habit_id) AS actual_goals_completed
  FROM habit_checkins c
  GROUP BY 1
)
SELECT 
  wc.week_of,
  wc.actual_goals_completed,
  COALESCE(mau.actual_monthly_active_users, 1) AS actual_monthly_active_users,
  ROUND(wc.actual_goals_completed::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2) AS actual_avg_goals_per_user,
  LAG(ROUND(wc.actual_goals_completed::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)) 
    OVER (ORDER BY wc.week_of) AS actual_prior_week_avg,
  ROUND(
    ((ROUND(wc.actual_goals_completed::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)
      - LAG(ROUND(wc.actual_goals_completed::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)) OVER (ORDER BY wc.week_of))
      / NULLIF(LAG(ROUND(wc.actual_goals_completed::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)) OVER (ORDER BY wc.week_of), 0)) * 100, 1
  ) AS actual_wow_pct_change,
  CASE 
    WHEN LAG(ROUND(wc.actual_goals_completed::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)) OVER (ORDER BY wc.week_of) IS NULL 
      THEN 'Baseline week (no prior week to compare)'
    WHEN ROUND(
      ((ROUND(wc.actual_goals_completed::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)
        - LAG(ROUND(wc.actual_goals_completed::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)) OVER (ORDER BY wc.week_of))
        / NULLIF(LAG(ROUND(wc.actual_goals_completed::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)) OVER (ORDER BY wc.week_of), 0)) * 100, 1
    ) >= 20.0 THEN 'Target met (+20% or higher increase)'
    ELSE 'Target not met (below +20% increase)'
  END AS target_status
FROM weekly_completions wc
LEFT JOIN okr_monthly_active_users mau ON mau.month_start = date_trunc('month', wc.week_of::timestamp)::date
ORDER BY wc.week_of DESC;

COMMENT ON VIEW okr_1_goals_completed_per_week IS 
  'OKR 1: (Number of goals completed per week per user) - Read-only reporting view displaying actual recorded data only.';


-- ---------------------------------------------------------------------
-- View 2: OKR 2
-- Title: OKR 2: (Increase number of lessons completed per week per active user from 1 to 2 lessons)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW okr_2_lessons_completed_per_week AS
WITH weekly_lessons AS (
  SELECT 
    date_trunc('week', lc.completed_at AT TIME ZONE 'America/Denver')::date AS week_of,
    COUNT(*) AS actual_lessons_completed
  FROM lesson_completions lc
  GROUP BY 1
)
SELECT 
  wl.week_of,
  wl.actual_lessons_completed,
  COALESCE(mau.actual_monthly_active_users, 1) AS actual_monthly_active_users,
  ROUND(wl.actual_lessons_completed::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2) AS actual_avg_lessons_per_user,
  2.0 AS target_lessons_per_user,
  CASE 
    WHEN ROUND(wl.actual_lessons_completed::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2) >= 2.0 
      THEN 'Target met (>= 2.0 lessons per user)'
    ELSE 'Target not met (< 2.0 lessons per user)'
  END AS target_status
FROM weekly_lessons wl
LEFT JOIN okr_monthly_active_users mau ON mau.month_start = date_trunc('month', wl.week_of::timestamp)::date
ORDER BY wl.week_of DESC;

COMMENT ON VIEW okr_2_lessons_completed_per_week IS 
  'OKR 2: (Increase number of lessons completed per week per active user from 1 to 2 lessons) - Read-only reporting view displaying actual recorded data only.';


-- ---------------------------------------------------------------------
-- View 3: OKR 3
-- Title: OKR 3: (Track average number of events signed up for and increase by 20% per month per active user)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW okr_3_event_signups_per_month AS
WITH monthly_signups AS (
  SELECT 
    date_trunc('month', r.created_at AT TIME ZONE 'America/Denver')::date AS month_of,
    COUNT(*) AS actual_event_signups
  FROM rsvps r
  WHERE r.status = 'committed'
  GROUP BY 1
)
SELECT 
  ms.month_of,
  ms.actual_event_signups,
  COALESCE(mau.actual_monthly_active_users, 1) AS actual_monthly_active_users,
  ROUND(ms.actual_event_signups::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2) AS actual_avg_signups_per_user,
  LAG(ROUND(ms.actual_event_signups::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)) 
    OVER (ORDER BY ms.month_of) AS actual_prior_month_avg,
  ROUND(
    ((ROUND(ms.actual_event_signups::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)
      - LAG(ROUND(ms.actual_event_signups::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)) OVER (ORDER BY ms.month_of))
      / NULLIF(LAG(ROUND(ms.actual_event_signups::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)) OVER (ORDER BY ms.month_of), 0)) * 100, 1
  ) AS actual_mom_pct_change,
  CASE 
    WHEN LAG(ROUND(ms.actual_event_signups::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)) OVER (ORDER BY ms.month_of) IS NULL 
      THEN 'Baseline month (no prior month to compare)'
    WHEN ROUND(
      ((ROUND(ms.actual_event_signups::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)
        - LAG(ROUND(ms.actual_event_signups::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)) OVER (ORDER BY ms.month_of))
        / NULLIF(LAG(ROUND(ms.actual_event_signups::numeric / NULLIF(mau.actual_monthly_active_users, 0), 2)) OVER (ORDER BY ms.month_of), 0)) * 100, 1
    ) >= 20.0 THEN 'Target met (+20% or higher increase)'
    ELSE 'Target not met (below +20% increase)'
  END AS target_status
FROM monthly_signups ms
LEFT JOIN okr_monthly_active_users mau ON mau.month_start = ms.month_of
ORDER BY ms.month_of DESC;

COMMENT ON VIEW okr_3_event_signups_per_month IS 
  'OKR 3: (Track average number of events signed up for and increase by 20% per month per active user) - Read-only reporting view displaying actual recorded data only.';


-- ---------------------------------------------------------------------
-- View 4: OKR 4
-- Title: OKR 4: (Track number of events posted site-wide & increase from 1 to 7 each week)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW okr_4_events_posted_site_wide AS
WITH weekly_events AS (
  SELECT 
    date_trunc('week', a.created_at AT TIME ZONE 'America/Denver')::date AS week_of,
    COUNT(*) AS actual_events_posted
  FROM activities a
  GROUP BY 1
)
SELECT 
  we.week_of,
  we.actual_events_posted,
  7 AS target_events_per_week,
  CASE 
    WHEN we.actual_events_posted >= 7 
      THEN 'Target met (>= 7 events)'
    ELSE 'Target not met (< 7 events)'
  END AS target_status
FROM weekly_events we
ORDER BY we.week_of DESC;

COMMENT ON VIEW okr_4_events_posted_site_wide IS 
  'OKR 4: (Track number of events posted site-wide & increase from 1 to 7 each week) - Read-only reporting view displaying actual recorded data only.';


-- ---------------------------------------------------------------------
-- Security & Access Permissions
-- Lock down views: only postgres and service_role can view them
-- ---------------------------------------------------------------------
REVOKE ALL ON 
  okr_monthly_active_users,
  okr_1_goals_completed_per_week,
  okr_2_lessons_completed_per_week,
  okr_3_event_signups_per_month,
  okr_4_events_posted_site_wide
FROM anon, authenticated;

GRANT SELECT ON 
  okr_monthly_active_users,
  okr_1_goals_completed_per_week,
  okr_2_lessons_completed_per_week,
  okr_3_event_signups_per_month,
  okr_4_events_posted_site_wide
TO postgres, service_role;

COMMIT;
