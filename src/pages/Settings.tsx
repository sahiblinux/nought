import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  KeyRound,
  Sun,
  Moon,
  Trash2,
  Shield,
  Palette,
  AlertTriangle,
  Check,
} from 'lucide-react';
import PasswordInput from '../components/PasswordInput';
import { api, postJson } from '../lib/api';
import supabase from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLearner } from '../contexts/LearnerContext';
import { useTheme } from '../contexts/ThemeContext';
import Footer from '../components/Footer';

type AccountInfo = {
  username: string | null;
  email: string | null;
  email_verified: boolean;
  created_at: string | null;
  is_google?: boolean;
};

export default function Settings() {
  const { user } = useAuth();
  const { profile, refresh } = useLearner();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Change password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  // Delete account
  const [deletePw, setDeletePw] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    (async () => {
      try {
        const info = await api<AccountInfo>('/api/auth/me');
        setAccount(info);
      } catch {
        /* non-critical */
      } finally {
        setLoading(false);
      }
    })();
  }, [user, navigate]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (newPw.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { setPwError("Passwords don't match."); return; }
    setPwBusy(true);
    try {
      await postJson('/api/auth/change-password', {
        current_password: currentPw,
        new_password: newPw,
      });
      setPwSuccess(true);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setPwBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    if (!confirmDelete) { setConfirmDelete(true); return; }
    if (!deletePw) { setDeleteError('Enter your password to confirm.'); return; }
    setDeleteBusy(true);
    try {
      await postJson('/api/auth/delete-account', { password: deletePw });
      await supabase.auth.signOut();
      navigate('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete account.');
      setConfirmDelete(false);
    } finally {
      setDeleteBusy(false);
    }
  };

  const inputCls =
    'mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-ink/35';
  const labelCls = 'font-mono text-[10px] uppercase tracking-[0.16em] text-muted';
  const sectionCls = 'rounded-xl border border-line bg-surface p-6';

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <div className="h-8 w-48 animate-pulse rounded bg-sunk" />
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={11} /> Back to profile
        </Link>

        <h1 className="mt-8 font-serif text-[2rem] leading-[1.1] tracking-tight text-ink">
          Settings
        </h1>

        {/* Account info */}
        <section className={`mt-10 ${sectionCls}`}>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-muted" />
            <h2 className="font-serif text-lg text-ink">Account</h2>
          </div>
          <dl className="mt-5 space-y-3">
            <div>
              <dt className={labelCls}>Username</dt>
              <dd className="mt-1 text-[14px] text-ink">
                {account?.username || (
                  <span className="text-muted italic">Not set</span>
                )}
              </dd>
            </div>
            <div>
              <dt className={labelCls}>Email</dt>
              <dd className="mt-1 text-[14px] text-ink">
                {account?.email || user?.email || (
                  <span className="text-muted italic">Not set</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        {/* Change password */}
        <section className={`mt-6 ${sectionCls}`}>
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-muted" />
            <h2 className="font-serif text-lg text-ink">Change password</h2>
          </div>
          <form onSubmit={handleChangePassword} className="mt-5 space-y-3" noValidate>
            <div>
              <label htmlFor="current-pw" className={labelCls}>Current password</label>
              <PasswordInput
                id="current-pw"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="new-pw" className={labelCls}>New password</label>
              <PasswordInput
                id="new-pw"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="At least 6 characters"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="confirm-pw" className={labelCls}>Confirm new password</label>
              <PasswordInput
                id="confirm-pw"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className={inputCls}
              />
            </div>
            {pwError && <p className="text-[12.5px] text-clay">{pwError}</p>}
            {pwSuccess && (
              <p className="flex items-center gap-1.5 text-[12.5px] text-moss">
                <Check size={13} /> Password updated
              </p>
            )}
            <button
              type="submit"
              disabled={pwBusy}
              className="flex items-center justify-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-[13px] text-paper transition-opacity hover:opacity-88 disabled:opacity-50"
            >
              {pwBusy && <Loader2 size={13} className="animate-spin" />}
              Update password
            </button>
          </form>
        </section>

        {/* Appearance */}
        <section className={`mt-6 ${sectionCls}`}>
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-muted" />
            <h2 className="font-serif text-lg text-ink">Appearance</h2>
          </div>
          <div className="mt-5 flex items-center justify-between">
            <div>
              <p className="text-[14px] text-ink">Theme</p>
              <p className="mt-0.5 text-[12.5px] text-muted">
                {theme === 'light' ? 'Light mode' : 'Dark mode'}
              </p>
            </div>
            <button
              onClick={toggle}
              className="relative flex h-8 w-14 items-center rounded-full border border-line bg-sunk px-1 transition-colors"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              <motion.div
                className="flex h-6 w-6 items-center justify-center rounded-full bg-paper shadow-sm"
                animate={{ x: theme === 'dark' ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                {theme === 'light' ? <Sun size={13} className="text-amber" /> : <Moon size={13} className="text-slate" />}
              </motion.div>
            </button>
          </div>
        </section>

        {/* Delete account */}
        <section className="mt-6 rounded-xl border border-clay/20 bg-clay/5 p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-clay" />
            <h2 className="font-serif text-lg text-clay">Danger zone</h2>
          </div>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
            Deleting your account is permanent. All your progress, XP, streaks, and badges will be
            erased and cannot be recovered.
          </p>
          {confirmDelete ? (
            <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="delete-pw" className={labelCls}>Your password</label>
              <PasswordInput
                id="delete-pw"
                value={deletePw}
                onChange={(e) => setDeletePw(e.target.value)}
                placeholder="Confirm with your password"
                className={inputCls}
              />
            </div>
              {deleteError && <p className="text-[12.5px] text-clay">{deleteError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteBusy}
                  className="flex items-center gap-2 rounded-lg bg-clay px-4 py-2 text-[13px] text-paper transition-opacity hover:opacity-88 disabled:opacity-50"
                >
                  {deleteBusy && <Loader2 size={13} className="animate-spin" />}
                  <Trash2 size={13} /> Delete everything
                </button>
                <button
                  onClick={() => { setConfirmDelete(false); setDeletePw(''); setDeleteError(null); }}
                  className="rounded-lg border border-line px-4 py-2 text-[13px] text-ink-soft transition-colors hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleDeleteAccount}
              className="mt-4 flex items-center gap-2 rounded-lg border border-clay/25 px-4 py-2 text-[13px] text-clay transition-colors hover:bg-clay/5"
            >
              <Trash2 size={13} /> Delete my account
            </button>
          )}
        </section>
      </div>
      <Footer />
    </div>
  );
}
