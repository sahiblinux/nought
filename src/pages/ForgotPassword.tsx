import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { postJson } from '../lib/api';

export default function ForgotPassword() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devPassword, setDevPassword] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username || !email) {
      setError('Enter your username and the email you signed up with.');
      return;
    }
    setBusy(true);
    try {
      const res = await postJson<{ ok: boolean; dev_password?: string }>(
        '/api/auth/forgot-password',
        { username: username.toLowerCase(), email: email.toLowerCase() }
      );
      if (res.dev_password) setDevPassword(res.dev_password);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password.');
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
        Forgot password?
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
        Enter your username and the email you used to sign up. We'll send a
        temporary password you can sign in with, then change in Settings.
      </p>

      {sent ? (
        <div className="mt-8 rounded-lg border border-moss/20 bg-moss/5 px-5 py-4">
          <p className="text-[14px] font-medium text-moss">Temporary password sent</p>
          <p className="mt-1 text-[13px] text-moss/80">
            Check your inbox at <span className="font-medium">{email}</span>. Sign in with
            it, then go to Settings to set a new password.
          </p>
          {devPassword && (
            <div className="mt-3 rounded border border-moss/15 bg-paper px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                Email delivery unavailable — temp password
              </p>
              <p className="mt-0.5 font-mono text-[16px] text-moss">{devPassword}</p>
            </div>
          )}
          <button
            onClick={() => navigate('/login')}
            className="mt-4 rounded-full bg-ink px-5 py-2 text-[13px] text-paper transition-opacity hover:opacity-88"
          >
            Go to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          <div>
            <label htmlFor="username" className={labelCls}>Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              autoComplete="username"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="email" className={labelCls}>Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={inputCls}
            />
          </div>

          {error && <p className="text-[12.5px] text-clay">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-2.5 text-[13.5px] text-paper transition-opacity hover:opacity-88 disabled:opacity-50"
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            Send temporary password
          </button>
        </form>
      )}
    </div>
  );
}
