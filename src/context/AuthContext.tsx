import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { api } from "../api/client";
import { clearAdminCache } from "../utils/localCache";
import type { Role } from "../types";

// Everyone signs in with their email and a password. What they can see
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
  signIn: (email: string, password: string) => Promise<void>;
  /** First time only: create a password for an email Harsha has added. */
  createAccount: (email: string, password: string) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
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

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      if (/invalid login credentials/i.test(error.message))
        throw new Error("Email or password is wrong. First time here? Tap \"Create password\".");
      if (/email not confirmed/i.test(error.message))
        throw new Error("This account isn't confirmed yet. Ask Harsha to turn off \"Confirm email\" in Supabase.");
      throw new Error("Couldn't sign in. Check your connection and try again.");
    }
  }, []);

  const createAccount = useCallback(async (email: string, password: string) => {
    const clean = email.trim().toLowerCase();
    const { data: invited, error: checkError } = await supabase.rpc("is_invited", { p_email: clean });
    if (checkError) throw new Error("Couldn't check the email. Check your connection and try again.");
    if (!invited) throw new Error("This email isn't on the Éclat team yet. Ask Harsha to add it first.");
    const { data, error } = await supabase.auth.signUp({ email: clean, password });
    if (error) {
      if (/already registered|already exists/i.test(error.message))
        throw new Error("This email already has a password. Use Sign in instead.");
      if (/password/i.test(error.message)) throw new Error("Choose a longer password (at least 8 characters).");
      throw new Error("Couldn't create the password. Check your connection and try again.");
    }
    if (!data.session)
      throw new Error("Password created, but Supabase is waiting for email confirmation. Ask Harsha to turn off \"Confirm email\".");
  }, []);

  const changePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error("Couldn't change the password. Try again.");
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
      signIn,
      createAccount,
      changePassword,
      signOut,
      recheck,
    }),
    [status, session, name, role, signIn, createAccount, changePassword, signOut, recheck]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
