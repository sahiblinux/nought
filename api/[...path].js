/**
 * Vercel catch-all API handler for single-segment /api/* routes.
 *
 * Vercel's plain-functions filesystem routing matches this file to ONE
 * segment under /api (e.g. /api/me, /api/languages) but NOT deeper paths
 * like /api/auth/me. The deeper auth routes are served by real per-route
 * files in api/auth/*.js. This catch-all keeps the full route table so the
 * Vite dev server (which dispatches all /api/* paths here directly) keeps
 * working for every route.
 */
import { makeRouter } from '../lib/vercel-handler.js';
import * as languages from '../functions/api/languages.js';
import * as curriculum from '../functions/api/curriculum.js';
import * as lesson from '../functions/api/lesson.js';
import * as progress from '../functions/api/progress.js';
import * as me from '../functions/api/me.js';
import * as run from '../functions/api/run.js';
import * as stats from '../functions/api/stats.js';
import * as submissions from '../functions/api/submissions.js';
import * as leaderboard from '../functions/api/leaderboard.js';
import * as authMe from '../functions/api/auth/me.js';
import * as signup from '../functions/api/auth/signup.js';
import * as login from '../functions/api/auth/login.js';
import * as verifyOtp from '../functions/api/auth/verify-otp.js';
import * as resendOtp from '../functions/api/auth/resend-otp.js';
import * as forgotPassword from '../functions/api/auth/forgot-password.js';
import * as changePassword from '../functions/api/auth/change-password.js';
import * as deleteAccount from '../functions/api/auth/delete-account.js';

const ROUTES = {
  'GET languages': languages,
  'GET curriculum': curriculum,
  'GET lesson': lesson,
  'GET progress': progress,
  'POST progress': progress,
  'GET me': me,
  'POST run': run,
  'GET stats': stats,
  'GET submissions': submissions,
  'GET leaderboard': leaderboard,
  'GET auth/me': authMe,
  'POST auth/signup': signup,
  'POST auth/login': login,
  'POST auth/verify-otp': verifyOtp,
  'POST auth/resend-otp': resendOtp,
  'POST auth/forgot-password': forgotPassword,
  'POST auth/change-password': changePassword,
  'POST auth/delete-account': deleteAccount,
};

export default makeRouter(ROUTES);
