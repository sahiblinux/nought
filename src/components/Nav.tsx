import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Flame, LogOut, Menu, X, Sun, Moon, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLearner } from '../contexts/LearnerContext';
import { useTheme } from '../contexts/ThemeContext';
import supabase from '../lib/supabase';
import { levelOf } from '../lib/format';

const LINKS = [
  { to: '/', label: 'Languages' },
  { to: '/playground', label: 'Playground' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/profile', label: 'Progress' },
];

export default function Nav() {
  const { user } = useAuth();
  const { profile } = useLearner();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isLesson = /^\/learn\/[^/]+\/[^/]+/.test(pathname);
  if (isLesson) return null;

  const signOut = async () => {
    await supabase.auth.signOut();
    setOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="group flex items-baseline gap-2">
          <span className="font-serif text-[22px] leading-none tracking-tight text-ink">
            nought
          </span>
          <span className="h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-clay transition-transform duration-300 group-hover:scale-125" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `text-[13.5px] transition-colors ${
                  isActive ? 'text-ink' : 'text-muted hover:text-ink-soft'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          {profile && (
            <div className="hidden items-center gap-3 sm:flex">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                Lv{levelOf(profile.xp)} · {profile.xp} xp
              </span>
              {profile.streak > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-clay">
                  <Flame size={12} /> {profile.streak}
                </span>
              )}
            </div>
          )}

          <button
            onClick={toggle}
            className="rounded-full p-2 text-muted transition-colors hover:text-ink"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {user ? (
            <>
              <Link
                to="/settings"
                className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12.5px] text-ink-soft transition-colors hover:border-ink/25 hover:text-ink md:flex"
              >
                <SettingsIcon size={12} /> Settings
              </Link>
              <button
                onClick={signOut}
                className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12.5px] text-ink-soft transition-colors hover:border-ink/25 hover:text-ink md:flex"
              >
                <LogOut size={12} /> Sign out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="hidden rounded-full border border-ink/15 bg-ink px-4 py-1.5 text-[12.5px] text-paper transition-opacity hover:opacity-85 md:block"
            >
              Sign in
            </Link>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded p-1.5 text-ink-soft transition-colors hover:text-ink md:hidden"
            aria-label="Menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-surface md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-5 py-2 sm:px-8">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `border-b border-line-soft py-3 text-sm last:border-0 ${
                    isActive ? 'text-ink' : 'text-muted'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            {user ? (
              <>
                <Link
                  to="/settings"
                  onClick={() => setOpen(false)}
                  className="border-b border-line-soft py-3 text-sm text-ink-soft"
                >
                  Settings
                </Link>
                <button onClick={signOut} className="py-3 text-left text-sm text-clay">
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setOpen(false)} className="py-3 text-sm text-clay">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
