import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, User, KeyRound } from 'lucide-react';
import supabase from '../lib/supabase';
import { postJson } from '../lib/api';
import { signInWithGoogle } from '../lib/googleAuth';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 sm:px-8">
        <h1 className="font-serif text-3xl tracking-tight text-ink">You're signed in</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          Signed in as <span className="text-ink">{user.email}</span>. Your progress syncs
          automatically.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            to="/"
            className="rounded-full bg-ink px-5 py-2.5 text-[13.5px] text-paper transition-opacity hover:opacity-88"
          >
            Keep learning
          </Link>
          <Link
            to="/settings"
            className="rounded-full border border-line px-5 py-2.5 text-[13.5px] text-ink-soft transition-colors hover:border-ink/25 hover:text-ink"
          >
            Settings
          </Link>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    if (!username || !password) {
      setError('Enter your username and password.');
      return;
    }
    setBusy(true);
    try {
      const res = await postJson<{
        access_token: string;
        refresh_token: string;
        user: { id: string; email: string };
        needs_verification?: boolean;
        email?: string;
      }>('/api/auth/login', {
        username: username.toLowerCase(),
        password,
      });

      if (res.needs_verification && res.email) {
        setNeedsVerification(true);
        setVerifyEmail(res.email);
        setBusy(false);
        return;
      }

      await supabase.auth.setSession({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-ink/35';
  const labelCls = 'font-mono text-[10px] uppercase tracking-[0.16em] text-muted';

  return (
    <div className="mx-auto grid max-w-5xl gap-16 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={11} /> Back
        </Link>
        <h1 className="mt-8 font-serif text-[2.4rem] leading-[1.1] tracking-tight text-ink">
          Keep your streak
          <br />
          across devices.
        </h1>
        <p className="mt-5 max-w-md text-[14.5px] leading-relaxed text-ink-soft">
          You can learn without an account — progress is saved to this browser. Sign in and
          everything you've already finished moves over with you, plus you appear on the
          leaderboard.
        </p>
        <ul className="mt-8 space-y-2.5">
          {[
            'Progress, XP, streaks and badges follow your account',
            'Guest progress is migrated on first sign-in',
            'Username + password, or one-tap Google',
          ].map((t) => (
            <li key={t} className="flex gap-3 text-[13.5px] text-ink-soft">
              <span className="mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full bg-clay" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-line bg-surface p-7">
        <h2 className="font-serif text-xl tracking-tight text-ink">Sign in</h2>

        {needsVerification ? (
          <div className="mt-5 rounded-lg border border-clay/20 bg-clay/5 px-4 py-3">
            <p className="text-[13px] text-clay">
              Please verify your email first. We sent a code to{' '}
              <span className="font-medium">{verifyEmail}</span>.
            </p>
            <Link
              to="/signup"
              className="mt-2 inline-block font-mono text-[10.5px] uppercase tracking-[0.14em] text-clay underline decoration-clay/25 underline-offset-4 hover:decoration-clay"
            >
              Go to verification
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <div>
              <label htmlFor="username" className={labelCls}>Username</label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-[14px] text-faint" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                  autoComplete="username"
                  className={`${inputCls} pl-10`}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className={labelCls}>Password</label>
                <Link
                  to="/forgot-password"
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted transition-colors hover:text-clay"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3.5 top-[14px] text-faint" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  className={`${inputCls} pl-10`}
                />
              </div>
            </div>

            {error && <p className="text-[12.5px] text-clay">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-2.5 text-[13.5px] text-paper transition-opacity hover:opacity-88 disabled:opacity-50"
            >
              {busy && <Loader2 size={13} className="animate-spin" />}
              Sign in
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-[12.5px] text-muted">
          No account?{' '}
          <Link
            to="/signup"
            className="font-medium text-clay underline decoration-clay/25 underline-offset-4 hover:decoration-clay"
          >
            Create one
          </Link>
        </p>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <button
          onClick={() => signInWithGoogle('Nought')}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-paper py-2.5 text-[13.5px] text-ink transition-colors hover:border-ink/25"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.29 9.14 5.38 12 5.38z"
            />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
