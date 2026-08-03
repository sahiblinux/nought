import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, User, KeyRound } from 'lucide-react';
import { postJson } from '../lib/api';
import supabase from '../lib/supabase';

export default function Signup() {
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
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
      const res = await postJson<{ ok: boolean; email: string; dev_otp?: string }>(
        '/api/auth/signup',
        { username: username.toLowerCase(), email: email.toLowerCase(), password }
      );
      if (res.dev_otp) setDevOtp(res.dev_otp);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const code = otp.join('');
    if (code.length !== 6) { setError('Enter the 6-digit code.'); return; }
    setBusy(true);
    try {
      await postJson('/api/auth/verify-otp', { email: email.toLowerCase(), code });
      // Auto sign-in after verification
      const loginRes = await postJson<{
        access_token: string;
        refresh_token: string;
      }>('/api/auth/login', { username: username.toLowerCase(), password });
      await supabase.auth.setSession({
        access_token: loginRes.access_token,
        refresh_token: loginRes.refresh_token,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify your code.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await postJson<{ ok: boolean; dev_otp?: string }>(
        '/api/auth/resend-otp',
        { email: email.toLowerCase() }
      );
      if (res.dev_otp) setDevOtp(res.dev_otp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.');
    } finally {
      setBusy(false);
    }
  };

  const setOtpDigit = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) {
      document.getElementById(`otp-${i + 1}`)?.focus();
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

      {step === 1 ? (
        <>
          <h1 className="mt-8 font-serif text-[2rem] leading-[1.1] tracking-tight text-ink">
            Create your account
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
            Pick a username, give us your email, and set a password. We'll send a
            verification code to your email.
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
              <label htmlFor="password" className={labelCls}>Password</label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3.5 top-[14px] text-faint" />
                <input
                  id="password"
                  type="password"
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
        </>
      ) : (
        <>
          <h1 className="mt-8 font-serif text-[2rem] leading-[1.1] tracking-tight text-ink">
            Verify your email
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
            We sent a 6-digit code to <span className="text-ink">{email}</span>.
            Enter it below to finish creating your account.
          </p>

          {devOtp && (
            <div className="mt-4 rounded-lg border border-moss/20 bg-moss/5 px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-moss">
                Dev mode — your code
              </p>
              <p className="mt-1 font-mono text-[20px] tracking-[4px] text-moss">{devOtp}</p>
            </div>
          )}

          <form onSubmit={handleVerify} className="mt-8" noValidate>
            <div className="flex justify-center gap-2">
              {otp.map((d, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => setOtpDigit(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !d && i > 0) {
                      document.getElementById(`otp-${i - 1}`)?.focus();
                    }
                  }}
                  className="h-14 w-12 rounded-lg border border-line bg-paper text-center font-mono text-[20px] text-ink focus:border-ink/35"
                />
              ))}
            </div>

            {error && <p className="mt-4 text-center text-[12.5px] text-clay">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-2.5 text-[13.5px] text-paper transition-opacity hover:opacity-88 disabled:opacity-50"
            >
              {busy && <Loader2 size={13} className="animate-spin" />}
              Verify
            </button>
          </form>

          <button
            onClick={handleResend}
            disabled={busy}
            className="mt-4 w-full text-center text-[12.5px] text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            Didn't get it? Resend code
          </button>
        </>
      )}
    </div>
  );
}
