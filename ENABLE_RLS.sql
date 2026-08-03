-- ============================================================
--  Nought — enable Row Level Security
--
--  WHY THIS FILE EXISTS
--  The RLS *policies* are already created on your database. But in
--  Postgres a policy does nothing until row level security is switched
--  on for the table. That switch is a DDL statement, and DDL cannot be
--  issued through the Supabase REST API — only through SQL. So this
--  last step has to be run by you, once.
--
--  HOW TO RUN
--  1. Open your Supabase dashboard
--  2. SQL Editor -> New query
--  3. Paste this entire file, press Run
--  4. Re-run VERIFY at the bottom; every row should say true
--
--  IS IT SAFE?
--  Yes. The app's API routes use the service_role key, which bypasses
--  RLS by design. Enabling RLS only affects the public anon key — i.e.
--  anything a browser could do directly. Nothing in the app breaks.
-- ============================================================


-- ---------- 1. User data: locked to the owning account ----------
-- Policies already present: <table>_owner_all / profiles_owner_select
-- These become enforced the moment RLS is enabled.

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;


-- ---------- 2. Rate limiter: no public access at all ----------
ALTER TABLE public.run_events ENABLE ROW LEVEL SECURITY;


-- ---------- 2b. Remove a leftover diagnostic table ----------
-- Created only to test whether RLS could be enabled programmatically.
-- It holds no app data and nothing references it.
DROP TABLE IF EXISTS public.rls_probe;


-- ---------- 3. Course content: readable by anyone, writable by no one ----------
-- The public_read policies allow SELECT. With RLS on and no INSERT/UPDATE/
-- DELETE policy, writes from the anon key are refused automatically.

ALTER TABLE public.languages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_modules  ENABLE ROW LEVEL SECURITY;


-- ---------- 3b. Auth tables: no public access ----------
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otps     ENABLE ROW LEVEL SECURITY;


-- ---------- 4. Guest rows ----------
-- Guest keys ('guest_ab12cd34') are not auth uuids, so auth.uid() never
-- matches them and the anon key cannot read or write guest rows directly.
-- Guests still work fine: their traffic goes through the API routes, which
-- use the service_role key. This is intentional — it means one guest can
-- never read another guest's progress.


-- ---------- 5. Content updates after this point ----------
-- The seeder (gen/seed.mjs) uses SUPABASE_SERVICE_ROLE_KEY, so it keeps
-- working unchanged. Adding or editing lessons needs no policy changes.


-- ============================================================
--  VERIFY — every row below must show rls_enabled = true
-- ============================================================
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'progress', 'submissions', 'user_achievements',
    'run_events', 'languages', 'modules', 'lessons',
    'achievements', 'curriculum_modules',
    'accounts', 'otps'
  )
ORDER BY tablename;


-- ============================================================
--  Optional: confirm the policies are attached
-- ============================================================
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
