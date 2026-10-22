import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getBackend } from "@/lib/backend";
import type { SessionUser } from "@/lib/types";

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getBackend()
      .getSession()
      .then((u) => {
        if (alive) setUser(u);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await getBackend().signIn(email, password);
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    await getBackend().signOut();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    setUser(await getBackend().getSession());
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, refresh }),
    [user, loading, signIn, signOut, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
