-- =====================================================================
-- Migration 009: Add additional activity types
-- Expands category options with Wellness, Service, Gaming, Tech, and Other
-- =====================================================================

insert into activity_types (name) values
  ('Wellness & Mindfulness'),
  ('Volunteering & Service'),
  ('Gaming & Esports'),
  ('Professional & Tech'),
  ('Other')
on conflict (name) do nothing;
