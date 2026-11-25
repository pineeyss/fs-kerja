import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { tokenStore } from "@/lib/token";
import { normalizeRole } from "@/lib/constants";
import * as authApi from "@/services/api/auth.api";

const AuthContext = createContext(null);

const withRole = (u) => (u ? { ...u, role: normalizeRole(u.role) } : null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  // Pulihkan sesi saat halaman dimuat ulang
  useEffect(() => {
    if (!tokenStore.get()) return;
    let active = true;
    authApi
      .getMe()
      .then((u) => active && setUser(withRole(u)))
      .catch(() => tokenStore.clear())
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const { token, user: u } = await authApi.login(credentials);
    tokenStore.set(token);
    const next = withRole(u);
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return ctx;
}
