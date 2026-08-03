import { createContext, useContext, useState, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import supabase from '../lib/supabase';

type AuthValue = { user: User | null; session: Session | null; loading: boolean };

const AuthContext = createContext<AuthValue>({ user: null, session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
