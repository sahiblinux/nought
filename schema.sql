-- ============================================================
--  Nought — Database Schema
--
--  Run this entire file once in your Supabase SQL Editor
--  to create all tables, indexes, and RLS policies.
-- ============================================================

-- ── Course content ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.languages (
  id          serial PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  tagline     text NOT NULL,
  blurb       text NOT NULL,
  glyph       text NOT NULL,
  accent      text NOT NULL,
  judge0_id   integer NOT NULL,
  filename    text NOT NULL,
  difficulty  text NOT NULL,
  born        text NOT NULL,
  paradigm    text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.modules (
  id             serial PRIMARY KEY,
  language_slug  text NOT NULL,
  slug           text NOT NULL,
  title          text NOT NULL,
  summary        text NOT NULL,
  sort_order     integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.curriculum_modules (
  id             serial PRIMARY KEY,
  language_slug  text NOT NULL,
  slug           text NOT NULL,
  title          text NOT NULL,
  summary        text NOT NULL,
  tier           text NOT NULL DEFAULT 'foundation',
  sort_order     integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.lessons (
  id              serial PRIMARY KEY,
  language_slug   text NOT NULL,
  module_slug     text NOT NULL,
  slug            text NOT NULL,
  title           text NOT NULL,
  subtitle        text NOT NULL,
  kind            text NOT NULL DEFAULT 'lesson',
  concept         text NOT NULL DEFAULT '',
  example_code    text NOT NULL DEFAULT '',
  example_note    text NOT NULL DEFAULT '',
  task            text NOT NULL DEFAULT '',
  starter_code    text NOT NULL DEFAULT '',
  solution_code   text NOT NULL DEFAULT '',
  expected_output text NOT NULL DEFAULT '',
  check_mode      text NOT NULL DEFAULT 'exact',
  hints           jsonb,
  quiz            jsonb,
  xp              integer NOT NULL DEFAULT 10,
  sort_order      integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.achievements (
  id         serial PRIMARY KEY,
  slug       text NOT NULL UNIQUE,
  title      text NOT NULL,
  description text NOT NULL,
  glyph      text NOT NULL,
  xp         integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);

-- ── User data ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id           serial PRIMARY KEY,
  user_key     text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT 'Learner',
  email        text,
  xp           integer NOT NULL DEFAULT 0,
  streak       integer NOT NULL DEFAULT 0,
  hearts       integer NOT NULL DEFAULT 5,
  lessons_done integer NOT NULL DEFAULT 0,
  last_active  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.progress (
  id           serial PRIMARY KEY,
  user_key     text NOT NULL,
  lesson_id    integer NOT NULL,
  language_slug text NOT NULL,
  status       text NOT NULL DEFAULT 'attempted',
  attempts     integer NOT NULL DEFAULT 0,
  best_code    text,
  xp_earned    integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  updated_at   timestamptz
);

CREATE TABLE IF NOT EXISTS public.submissions (
  id            serial PRIMARY KEY,
  user_key      text NOT NULL,
  lesson_id     integer NOT NULL,
  language_slug text NOT NULL,
  code          text NOT NULL DEFAULT '',
  output        text NOT NULL DEFAULT '',
  passed        boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id        serial PRIMARY KEY,
  user_key  text NOT NULL,
  slug      text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now()
);

-- ── Rate limiter ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.run_events (
  id         serial PRIMARY KEY,
  user_key   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Auth (username-based) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accounts (
  id             serial PRIMARY KEY,
  username       text NOT NULL UNIQUE,
  email          text NOT NULL UNIQUE,
  user_key       text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.otps (
  id         serial PRIMARY KEY,
  email      text NOT NULL,
  code       text NOT NULL,
  purpose    text NOT NULL,
  expires_at timestamptz NOT NULL,
  used       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_user_key     ON public.profiles (user_key);
CREATE INDEX IF NOT EXISTS idx_progress_user_key     ON public.progress (user_key);
CREATE INDEX IF NOT EXISTS idx_progress_lesson       ON public.progress (lesson_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_key  ON public.submissions (user_key);
CREATE INDEX IF NOT EXISTS idx_user_ach_user_key     ON public.user_achievements (user_key);
CREATE INDEX IF NOT EXISTS idx_run_events_user_key   ON public.run_events (user_key);
CREATE INDEX IF NOT EXISTS idx_run_events_created    ON public.run_events (created_at);
CREATE INDEX IF NOT EXISTS idx_accounts_username     ON public.accounts (username);
CREATE INDEX IF NOT EXISTS idx_accounts_email        ON public.accounts (email);
CREATE INDEX IF NOT EXISTS idx_accounts_user_key     ON public.accounts (user_key);
CREATE INDEX IF NOT EXISTS idx_otps_email_purpose    ON public.otps (email, purpose);
CREATE INDEX IF NOT EXISTS idx_otps_expires          ON public.otps (expires_at);
CREATE INDEX IF NOT EXISTS idx_lessons_lang_module   ON public.lessons (language_slug, module_slug);
CREATE INDEX IF NOT EXISTS idx_modules_lang          ON public.modules (language_slug);

-- ── Row Level Security ─────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE public.languages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_modules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otps                ENABLE ROW LEVEL SECURITY;

-- Course content: anyone can read, nobody can write via anon key
CREATE POLICY "languages_public_read"           ON public.languages           FOR SELECT USING (true);
CREATE POLICY "modules_public_read"             ON public.modules             FOR SELECT USING (true);
CREATE POLICY "curriculum_modules_public_read"  ON public.curriculum_modules  FOR SELECT USING (true);
CREATE POLICY "lessons_public_read"             ON public.lessons             FOR SELECT USING (true);
CREATE POLICY "achievements_public_read"        ON public.achievements        FOR SELECT USING (true);

-- User data: locked to the owning account
CREATE POLICY "profiles_owner_select"  ON public.profiles          FOR SELECT USING (auth.uid()::text = user_key);
CREATE POLICY "profiles_owner_all"     ON public.profiles          FOR ALL    USING (auth.uid()::text = user_key) WITH CHECK (auth.uid()::text = user_key);
CREATE POLICY "progress_owner_all"     ON public.progress          FOR ALL    USING (auth.uid()::text = user_key) WITH CHECK (auth.uid()::text = user_key);
CREATE POLICY "submissions_owner_all"  ON public.submissions       FOR ALL    USING (auth.uid()::text = user_key) WITH CHECK (auth.uid()::text = user_key);
CREATE POLICY "user_ach_owner_all"     ON public.user_achievements FOR ALL    USING (auth.uid()::text = user_key) WITH CHECK (auth.uid()::text = user_key);

-- Rate limiter + auth tables: no public access at all
CREATE POLICY "run_events_no_public"   ON public.run_events  FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "accounts_no_public"     ON public.accounts    FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "otps_no_public"        ON public.otps         FOR ALL USING (false) WITH CHECK (false);

-- ── Verification ───────────────────────────────────────────
-- Run this query separately to confirm all tables have RLS on:
-- SELECT tablename, rowsecurity AS rls_enabled
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
