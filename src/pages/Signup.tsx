import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, User, KeyRound } from 'lucide-react';
import PasswordInput from '../components/PasswordInput';
import { postJson } from '../lib/api';
import supabase from '../lib/supabase';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const validate = () => {
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
      return 'Username must be 3–20 letters, numbers, or underscores.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    return null;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) { setError(v); return; }
    setBusy(true);
    try {
      await postJson('/api/auth/signup', {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
      setBusy(false);
      return;
    }

    // Account is created and confirmed — sign in automatically. If auto-login
    // fails, the account still exists, so send them to the sign-in page.
    try {
      const loginRes = await postJson<{
        access_token: string;
        refresh_token: string;
      }>('/api/auth/login', { username: username.toLowerCase(), password });
      await supabase.auth.setSession({
        access_token: loginRes.access_token,
        refresh_token: loginRes.refresh_token,
      });
      navigate('/');
    } catch {
      navigate('/login');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-ink/35';
  const labelCls = 'font-mono text-[10px] uppercase tracking-[0.16em] text-muted';

  return (
    <div className="mx-auto max-w-md px-5 py-16 sm:px-8">
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={11} /> Back to sign in
      </Link>

      <h1 className="mt-8 font-serif text-[2rem] leading-[1.1] tracking-tight text-ink">
        Create your account
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
        Pick a username, give us your email, and set a password. Your account is
        ready the moment you hit create — no verification needed.
      </p>

      <form onSubmit={handleSignup} className="mt-8 space-y-4" noValidate>
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
          <label htmlFor="email" className={labelCls}>Email</label>
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-[14px] text-faint" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={`${inputCls} pl-10`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="password" className={labelCls}>Password</label>            <div className="relative">
              <KeyRound size={15} className="absolute left-3.5 top-[14px] text-faint" />
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
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
          Create account
        </button>
      </form>
    </div>
  );
}
