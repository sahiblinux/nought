# Deploying Nought to GitHub Pages or Cloudflare Pages

This guide covers everything: what to set up, step-by-step deploy
instructions for both platforms, and how to add features later
without breaking your database.

---

## First: Understand the Architecture

The app has **three separate pieces**:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   FRONTEND       │────▶│   API ROUTES      │────▶│   DATABASE       │
│  (React app)     │     │  (serverless)     │     │  (Supabase)      │
│  static files    │     │  17 route files   │     │  hosted by       │
│  HTML/CSS/JS     │     │  in /api/         │     │  Supabase, not   │
│                  │     │                   │     │  by you          │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

- **Frontend**: The React app. Builds to static files (`dist/`).
  Can be hosted anywhere.

- **API routes**: 17 serverless functions in `/api/`. They handle
  login, signup, code execution, progress tracking, etc.
  Need a serverless platform to run.

- **Database**: Lives on Supabase's servers. You don't host it.
  It has its own URL and keys. **It is completely independent
  of where you deploy your code.**

### Why this matters

- **GitHub Pages** can only serve static files. It CANNOT run the
  API routes. You'd need to host the API somewhere else.

- **Cloudflare Pages** can serve static files AND run serverless
  functions (Workers). It CAN host everything in one place.

---

## Option A: Cloudflare Pages (Recommended)

Hosts both frontend AND API on one platform. Free tier is generous.

### Step 1: Create your own Supabase project

The current database is on a Supabase project managed by this
platform. For your own deployment, create your own so you fully
own the data.

1. Go to **supabase.com** → Sign up → **New Project**
2. Pick a name (e.g. "nought") and a strong database password
3. Wait ~2 min for it to provision
4. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public key** (`sb_publishable_...`)
   - **service_role key** (`sb_secret_...`) — keep this secret!

### Step 2: Create the database tables

1. In Supabase dashboard → **SQL Editor** → **New query**
2. You need to recreate all the tables. Run the schema SQL
   (see `schema.sql` in the project root if it exists, or
   export from the current Supabase project).
3. Also run `ENABLE_RLS.sql` from the project root.
4. Seed the curriculum data by running `node gen/seed.mjs`
   with your new Supabase credentials in `.env`.

### Step 3: Prepare your .env file

Create a `.env` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Step 4: Push to GitHub

1. Create a new GitHub repository (e.g. `nought`)
2. Push the entire project:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourname/nought.git
   git push -u origin main
   ```

### Step 5: Deploy to Cloudflare Pages

1. Go to **dash.cloudflare.com** → **Workers & Pages** → **Create**
2. Choose **Connect to Git**
3. Select your GitHub repository
4. Configure the build:
   - **Framework preset**: None
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (leave as default)
5. Under **Environment variables**, add:
   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
   | `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | your anon key |
6. Under **Settings → Functions → Compatibility flags**,
   add `nodejs_compat` to both Production and Preview.
   **This is critical** — without it, the API routes will crash
   because they use Node.js built-ins like `Buffer` and `crypto`.
7. Click **Save and Deploy**
8. Wait 2–3 minutes for the build to finish

Your app will be live at `https://your-project.pages.dev`.

### Step 6: (Optional) Add a custom domain

In Cloudflare dashboard → your Pages project → **Custom domains**
→ **Set up a custom domain**. Cloudflare handles SSL automatically.

---

## Option B: GitHub Pages (Frontend Only)

GitHub Pages serves static files only. The API routes need to
run somewhere else. The simplest approach: keep the API on
Vercel (free), host only the frontend on GitHub Pages.

### Step 1: Keep the API on Vercel

The API is already deployed on Vercel. Note its URL:
`https://nought-code.vercel.app` (or whatever your slug is).

### Step 2: Configure the frontend to call the Vercel API

In your `.env` file, add:
```
VITE_API_BASE=https://nought-code.vercel.app
```

This makes all `/api/*` calls go to Vercel instead of the
gitHub Pages origin (which has no API).

### Step 3: Enable CORS on Vercel

In `vercel.json`, the API already sets
`Access-Control-Allow-Origin: *`, so cross-origin requests
from GitHub Pages will work.

### Step 4: Build and deploy

1. Build the static site:
   ```bash
   npm run build
   ```
2. The `dist/` folder is your static site.
3. Push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourname/nought.git
   git push -u origin main
   ```
4. In your GitHub repo → **Settings → Pages**
5. Under **Build and deployment**:
   - Source: **GitHub Actions** (recommended) or **Deploy from
     a branch**
   - If using branch: select `main` and `/dist` folder
6. Your site will be at
   `https://yourname.github.io/nought/`

### ⚠️ Important: Base path for GitHub Pages

GitHub Pages serves from `https://user.github.io/repo-name/`,
not from the root. You need to set the base path in
`vite.config.ts`:

```typescript
export default defineConfig({
  base: '/nought/',  // your repo name with slashes
  // ... rest of config
});
```

---

## Adding Features Later

### Do you need to replace the whole code? **NO.**

You add or modify individual files and redeploy. The deployment
platform rebuilds from your latest code. Think of it like updating
any website — you change a file, push, and the site updates.

### Will it affect your database? **NO.**

The database lives on Supabase's servers. Deploying new code does
NOT touch the database. Your users, their progress, their accounts
— everything stays exactly as it was.

The ONLY time the database changes is when YOU explicitly:
- Run SQL to create/alter tables (in Supabase SQL Editor)
- Run the seeder to add curriculum content
- Users interact with the app (which writes through the API)

### How to add a feature — step by step

Let's say you want to add a "Bookmarks" feature:

1. **Create the database table** (one-time, in Supabase SQL Editor):
   ```sql
   CREATE TABLE bookmarks (
     id serial PRIMARY KEY,
     user_key text NOT NULL,
     lesson_id integer NOT NULL,
     created_at timestamptz DEFAULT now()
   );
   ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
   -- Add RLS policy (see ENABLE_RLS.sql for patterns)
   ```

2. **Create an API route** (new file `api/bookmarks.js`):
   ```javascript
   import supabase from './db-client.js';
   import { applyCors, requireIdentity, sendError } from './_auth.js';

   export default async function handler(req, res) {
     if (applyCors(req, res, 'GET, POST, DELETE, OPTIONS')) return;
     const { userKey } = await requireIdentity(req);
     // ... your logic ...
   }
   ```

3. **Add the route to the Cloudflare catch-all** (if using CF Pages):
   Open `functions/api/[[path]].js` and add one line to the routes map:
   ```javascript
   'bookmarks': () => import('../../api/bookmarks.js'),
   ```

4. **Add frontend code** (new component or page):
   - Create `src/pages/Bookmarks.tsx`
   - Add a route in `src/App.tsx`
   - Add a link in `src/components/Nav.tsx`

5. **Push and redeploy**:
   ```bash
   git add .
   git commit -m "Add bookmarks feature"
   git push
   ```
   Cloudflare Pages / GitHub Actions will automatically rebuild
   and deploy.

### That's it. The existing data is untouched.

---

## Quick Reference: What Lives Where

| Thing | Where | Affected by code deploy? |
|-------|-------|--------------------------|
| User accounts | Supabase Auth | No |
| User progress | Supabase `profiles`, `progress` tables | No |
| Curriculum content | Supabase `languages`, `lessons` tables | No |
| OTPs | Supabase `otps` table | No |
| Frontend code | Your GitHub repo → Cloudflare/GitHub Pages | Yes (that's the point) |
| API route code | Your GitHub repo → Cloudflare Workers/Vercel | Yes |
| Environment variables | Cloudflare dashboard / Vercel dashboard | No (unless you change them) |

---

## Troubleshooting

### API routes return 500 on Cloudflare
Make sure `nodejs_compat` is enabled under Settings → Functions →
Compatibility flags. Without it, `Buffer`, `crypto`, and `process`
are unavailable.

### CORS errors on GitHub Pages
The API sets `Access-Control-Allow-Origin: *`. If you still see
CORS errors, make sure `VITE_API_BASE` is set correctly and has
no trailing slash.

### Blank page on GitHub Pages
You probably forgot to set `base` in `vite.config.ts`. GitHub Pages
serves from a subpath (`/repo-name/`), so assets need the prefix.

### Database connection errors
Check that `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are set correctly in your deployment
platform's environment variables. The URL should not have a
trailing slash.

### Google sign-in doesn't work
Google sign-in requires `VITE_GOOGLE_CLIENT_ID` and
`VITE_GOOGLE_AUTH_PROXY`. These are specific to the Design Arena
platform. For your own deployment, either set up your own Google
OAuth credentials or remove the Google sign-in button.
