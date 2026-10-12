import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import { clearAdminCache } from "../utils/localCache";
import type { LoginResult } from "../types";

// Admin stays unlocked on this device until "Lock" is tapped, or until the
// PIN is changed on the server (which invalidates every issued token).
const TOKEN_KEY = "eclat:admin-token";

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

interface AuthContextValue {
  token: string | null;
  isAdmin: boolean;
  unlock: (pin: string) => Promise<LoginResult>;
  lock: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readToken);

  const unlock = useCallback(async (pin: string) => {
    const result = await api.login(pin);
    if (result.ok && result.token) {
      try {
        localStorage.setItem(TOKEN_KEY, result.token);
      } catch {
        // stays unlocked for this session only
      }
      setToken(result.token);
    }
    return result;
  }, []);

  const lock = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // nothing stored
    }
    clearAdminCache();
    setToken(null);
  }, []);

  const value = useMemo(() => ({ token, isAdmin: token !== null, unlock, lock }), [token, unlock, lock]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
