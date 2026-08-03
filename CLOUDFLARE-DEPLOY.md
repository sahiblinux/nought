# ╔════════════════════════════════════════════════════════════════════╗
# ║  NOUGHT — CLOUDFLARE PAGES DEPLOYMENT GUIDE                       ║
# ║  Your Supabase project: nulcaofuybdxzuhkrmee.supabase.co          ║
# ╚════════════════════════════════════════════════════════════════════╝

You already ran schema.sql and created the tables. Here's everything else.

══════════════════════════════════════════════════════════════════════
  STEP 1 — GET YOUR SUPABASE KEYS
══════════════════════════════════════════════════════════════════════

Go to:  https://supabase.com/dashboard
Click your project (nulcaofuybdxzuhkrmee)
Click ⚙ Settings (bottom of left sidebar)
Click "API" in the settings menu

You'll see three things on this page:

  ┌──────────────────────────────────────────────────────────────┐
  │  Project URL                                                 │
  │  https://nulcaofuybdxzuhkrmee.supabase.co                   │
  │                                                               │
  │  anon  public   ████████████████████████  [Reveal] [Copy]    │
  │  service_role   ████████████████████████  [Reveal] [Copy]    │
  └──────────────────────────────────────────────────────────────┘

COPY all three values. You'll need them in Steps 2 and 4.

  NEXT_PUBLIC_SUPABASE_URL  =  the Project URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY  =  the anon public key
  SUPABASE_SERVICE_ROLE_KEY  =  the service_role key
                                  ⚠️ NEVER share this one publicly


══════════════════════════════════════════════════════════════════════
  STEP 2 — SEED YOUR DATABASE
══════════════════════════════════════════════════════════════════════

Your tables exist but are empty. You need to fill them with curriculum
data (5 languages, 17 achievements, ~150 lessons).

  2a. Make sure you have Node.js installed (v18+).
      Check:  node --version
      If you don't have it: https://nodejs.org → download LTS

  2b. Download the project code (from the Design Arena download button)

  2c. Open a terminal in the project folder

  2d. Install dependencies:
      npm install

  2e. Create a .env file in the project root with YOUR keys:

      NEXT_PUBLIC_SUPABASE_URL=https://nulcaofuybdxzuhkrmee.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...(paste your anon key here)
      SUPABASE_SERVICE_ROLE_KEY=eyJ...(paste your service role key here)
      VITE_SUPABASE_URL=https://nulcaofuybdxzuhkrmee.supabase.co
      VITE_SUPABASE_ANON_KEY=eyJ...(same anon key as above)

  2f. Run the seed script:
      node seed-everything.mjs

      This takes 2-3 minutes. You'll see output like:
        📤 Inserting languages...
           ✅ 5 languages inserted
        📤 Inserting achievements...
           ✅ 17 achievements inserted
        📤 Inserting modules and lessons...
          python/py-output: 4 lessons
          python/py-values: 5 lessons
          ... (many more)
        ✅ DATABASE SEEDED SUCCESSFULLY!

  2g. Verify in Supabase dashboard:
      Go to Table Editor → click "languages" → you should see 5 rows
      Click "lessons" → you should see ~150 rows


══════════════════════════════════════════════════════════════════════
  STEP 3 — PUSH TO GITHUB
══════════════════════════════════════════════════════════════════════

  3a. Create a GitHub repo (don't initialize with README)
      https://github.com/new → name it "nought" → Create repository

  3b. In your terminal (still in the project folder):

      git init
      git add .
      git commit -m "Initial commit"
      git remote add origin https://github.com/YOUR-USERNAME/nought.git
      git branch -M main
      git push -u origin main

  ⚠️  IMPORTANT: Make sure .env is in .gitignore!
      The .env file has your secret keys — it must NEVER be pushed.
      Check:  cat .gitignore | grep .env
      If it's not there:  echo ".env" >> .gitignore


══════════════════════════════════════════════════════════════════════
  STEP 4 — DEPLOY TO CLOUDFLARE PAGES
══════════════════════════════════════════════════════════════════════

  4a. Go to:  https://dash.cloudflare.com
      Sign up or log in (free account works)

  4b. Click "Workers & Pages" in the left sidebar
      Click "Create application" → "Pages" tab → "Connect to Git"

  4c. Connect your GitHub account and select the "nought" repo

  4d. Configure the build:

      ┌─────────────────────────────────────────────────────┐
      │  Project name:       nought                         │
      │  Production branch:  main                           │
      │  Build command:      npm run build                  │
      │  Build output:       dist                           │
      │  Framework preset:   None                           │
      └─────────────────────────────────────────────────────┘

  4e. Add environment variables (click "Add variable" for each):

      Variable name                   Value
      ──────────────────────────────  ────────────────────────
      NEXT_PUBLIC_SUPABASE_URL        https://nulcaofuybdxzuhkrmee.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY   (paste your anon key)
      SUPABASE_SERVICE_ROLE_KEY       (paste your service role key)
      VITE_SUPABASE_URL               https://nulcaofuybdxzuhkrmee.supabase.co
      VITE_SUPABASE_ANON_KEY          (paste your anon key again)

      ⚠️ Mark SUPABASE_SERVICE_ROLE_KEY as "Encrypt" (click the lock icon)

  4f. Click "Save and Deploy"

      Cloudflare will:
      1. Clone your repo
      2. Run npm install
      3. Run npm run build → produces dist/
      4. Deploy dist/ as static files
      5. Deploy functions/ as Pages Functions (your API routes)

      This takes 1-2 minutes. When it's done, you get a URL like:
      https://nought-abc123.pages.dev


══════════════════════════════════════════════════════════════════════
  STEP 5 — ADD A CUSTOM DOMAIN (optional)
══════════════════════════════════════════════════════════════════════

  In Cloudflare Pages → your project → Custom domains → Add domain
  Follow the DNS instructions. Free SSL is included.


══════════════════════════════════════════════════════════════════════
  STEP 6 — ADD EMAIL (optional, for signup verification)
══════════════════════════════════════════════════════════════════════

Without email configured, OTP codes show on-screen (fine for testing).
To send real emails:

  6a. Go to https://resend.com → sign up (free: 100 emails/day)
  6b. Get your API key from the dashboard
  6c. In Cloudflare Pages → your project → Settings → Environment variables:
      Add:  RESEND_API_KEY = (your Resend API key)
      Add:  MAIL_FROM = Nought <onboarding@yourdomain.com>
  6d. Redeploy (push any commit to trigger)


══════════════════════════════════════════════════════════════════════
  HOW IT ALL CONNECTS
══════════════════════════════════════════════════════════════════════

  Browser
    │
    ├── GET / → Cloudflare serves dist/index.html (React app)
    ├── GET /learn/python → SPA routing → dist/index.html
    │
    ├── GET /api/languages → functions/api/languages.js → Supabase DB
    ├── POST /api/run → functions/api/run.js → Judge0 (code runner)
    ├── POST /api/progress → functions/api/progress.js → Supabase DB
    └── ... all other /api/* routes handled by functions/

  Your database lives on Supabase servers. Redeploying code NEVER
  touches the database. User progress, accounts, lessons — all persist.


══════════════════════════════════════════════════════════════════════
  ADDING FEATURES LATER
══════════════════════════════════════════════════════════════════════

  1. Add a feature in Design Arena (or edit code locally)
  2. Download the updated code
  3. git add . && git commit -m "new feature" && git push
  4. Cloudflare auto-rebuilds and redeploys (30-60 seconds)
  5. Database is untouched — nothing breaks

  If the new feature needs a NEW database table:
  - I'll give you SQL to run in Supabase → SQL Editor
  - Run it once, and the feature works
  - Existing tables and data are never affected


══════════════════════════════════════════════════════════════════════
  FILE MAP — WHERE EVERYTHING IS
══════════════════════════════════════════════════════════════════════

  Project root/
  │
  ├── src/                    ← React frontend source
  │   ├── App.tsx             ← Main app component + routes
  │   ├── lib/
  │   │   ├── api.ts          ← Frontend API client (fetch /api/*)
  │   │   └── supabase.ts     ← Frontend Supabase client (auth)
  │   ├── pages/              ← Page components
  │   └── components/         ← UI components
  │
  ├── functions/api/          ← Cloudflare Pages Functions (your API)
  │   ├── _lib.js             ← Shared helpers (Supabase, CORS, auth)
  │   ├── languages.js        ← GET /api/languages
  │   ├── curriculum.js       ← GET /api/curriculum?language=python
  │   ├── lesson.js           ← GET /api/lesson?language=python&slug=...
  │   ├── progress.js         ← GET/POST /api/progress
  │   ├── me.js               ← GET /api/me (user profile + achievements)
  │   ├── run.js              ← POST /api/run (code execution via Judge0)
  │   ├── stats.js            ← GET /api/stats
  │   ├── submissions.js      ← GET /api/submissions
  │   ├── leaderboard.js      ← GET /api/leaderboard
  │   └── auth/               ← Auth routes
  │       ├── signup.js       ← POST /api/auth/signup
  │       ├── login.js        ← POST /api/auth/login
  │       ├── verify-otp.js   ← POST /api/auth/verify-otp
  │       ├── resend-otp.js   ← POST /api/auth/resend-otp
  │       ├── forgot-password.js
  │       ├── change-password.js
  │       ├── delete-account.js
  │       └── me.js           ← GET /api/auth/me
  │
  ├── api/                    ← Vercel API routes (NOT used on Cloudflare)
  │   └── ...                 ← Keep for reference, Cloudflare ignores these
  │
  ├── public/
  │   ├── _redirects          ← SPA routing: /* → /index.html
  │   └── favicon.svg
  │
  ├── schema.sql              ← Run once in Supabase SQL Editor (you did this)
  ├── seed-everything.mjs     ← Run once to fill the database
  └── .env.example            ← Template (copy to .env with your keys)


══════════════════════════════════════════════════════════════════════
  TROUBLESHOOTING
══════════════════════════════════════════════════════════════════════

  Problem: "Could not load the languages" on the site
  Fix:    Your database is empty. Run seed-everything.mjs (Step 2).

  Problem: API routes return 404
  Fix:    Make sure the functions/ directory is in your GitHub repo.
          Cloudflare auto-detects it and deploys the functions.

  Problem: Build fails on Cloudflare
  Fix:    Check the build logs in Cloudflare dashboard.
          Most common: missing env vars. Make sure all 5 are set.

  Problem: Code runner doesn't work
  Fix:    Judge0 CE (the free public runner) has rate limits.
          It works but may be slow during peak times.
          For production, self-host Judge0 or use RapidAPI.

  Problem: Signup emails not sending
  Fix:    Add RESEND_API_KEY env var (Step 6).
          Without it, OTPs show on-screen (dev mode).
