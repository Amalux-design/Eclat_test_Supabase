import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { api } from "../api/client";
import { clearAdminCache } from "../utils/localCache";
import type { Role } from "../types";

// Everyone signs in with their email and a 6-digit code. What they can see
// comes from the members table (owner / admin / team), checked by the
// database on every request — so removing someone takes effect immediately.

type Status = "loading" | "signed-out" | "no-access" | "ready";

interface AuthContextValue {
  status: Status;
  email: string | null;
  name: string;
  role: Role | null;
  isAdmin: boolean; // owner or admin: sees contacts, money, edits
  isOwner: boolean; // can manage the team
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-check access, e.g. after the database refuses a request. */
  recheck: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");

  const resolve = useCallback(async (s: Session | null) => {
    setSession(s);
    const email = s?.user.email;
    if (!email) {
      setRole(null);
      setStatus("signed-out");
      return;
    }
    try {
      const m = await api.myMembership(email);
      setRole(m?.role ?? null);
      setName(m?.name ?? "");
      setStatus(m ? "ready" : "no-access");
    } catch {
      // Offline at launch: keep whatever role we had so cached bookings show.
      setStatus((prev) => (prev === "loading" ? "ready" : prev));
    }
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void resolve(s);
      else setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, [resolve]);

  const sendCode = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    if (error) {
      if (/rate limit|too many/i.test(error.message)) throw new Error("Too many codes requested. Please wait a few minutes and try again.");
      throw new Error("Couldn't send the code. Check the email address and your connection.");
    }
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: "email" });
    if (error) throw new Error("That code didn't work. Check it, or request a new one.");
  }, []);

  const signOut = useCallback(async () => {
    clearAdminCache();
    await supabase.auth.signOut();
  }, []);

  const recheck = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await resolve(data.session);
  }, [resolve]);

  const value = useMemo(
    () => ({
      status,
      email: session?.user.email ?? null,
      name,
      role,
      isAdmin: role === "owner" || role === "admin",
      isOwner: role === "owner",
      sendCode,
      verifyCode,
      signOut,
      recheck,
    }),
    [status, session, name, role, sendCode, verifyCode, signOut, recheck]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
