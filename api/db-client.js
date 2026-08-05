import { createClient } from '@supabase/supabase-js';

// Shared Supabase client for the Vercel API. Env vars come from
// vercel.json "env" (or the Vercel dashboard).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default supabase;
