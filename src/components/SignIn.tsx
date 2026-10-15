import { useState } from "react";
import { PasswordInput } from "./PasswordInput";
import { useAuth } from "../context/AuthContext";
import { Wordmark } from "./Wordmark";

// Full-screen sign-in with email + password. First-timers create their
// password here (only for emails Harsha has added). After one sign-in the
// phone stays signed in.
export function SignIn() {
  const { signIn, createAccount } = useAuth();
  const [mode, setMode] = useState<"signin" | "create" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function switchTo(next: typeof mode) {
    setMode(next);
    setMessage(null);
    setPassword("");
    setConfirmPw("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setMessage("Enter the email address Harsha added you with.");
      return;
    }
    if (mode === "create") {
      if (password.length < 8) {
        setMessage("Choose a password of at least 8 characters.");
        return;
      }
      if (password !== confirmPw) {
        setMessage("The two passwords don't match.");
        return;
      }
    } else if (!password) {
      setMessage("Enter your password.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "create") await createAccount(email, password);
      else await signIn(email, password);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't sign in.");
      setBusy(false);
    }
  }

  if (mode === "forgot") {
    return (
      <div className="gate">
        <Wordmark size="lg" />
        <div className="gate-form">
          <h1 className="gate-title">Forgot password</h1>
          <p className="gate-text">
            Ask Harsha to reset it. She can set a new one for you in a minute, then you sign in with it and
            change it from Account → Change password.
          </p>
          <button className="primary-btn" onClick={() => switchTo("signin")}>Back to sign in</button>
        </div>
      </div>
    );
  }

  const creating = mode === "create";
  return (
    <div className="gate">
      <Wordmark size="lg" saving={busy} />
      <form className="gate-form" onSubmit={submit}>
        <h1 className="gate-title">{creating ? "Create password" : "Sign in"}</h1>
        <p className="gate-text">
          {creating ? "First time? Use the email Harsha added you with." : "Welcome back."}
        </p>
        <input
          className="field-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
        />
        <PasswordInput
          autoComplete={creating ? "new-password" : "current-password"}
          placeholder={creating ? "New password (8+ characters)" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Password"
        />
        {creating && (
          <PasswordInput
            autoComplete="new-password"
            placeholder="Repeat password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            aria-label="Repeat password"
          />
        )}
        {message && <p className="gate-message" role="alert">{message}</p>}
        <button type="submit" className="primary-btn" disabled={busy}>
          {busy ? (creating ? "Creating…" : "Signing in…") : creating ? "Create password" : "Sign in"}
        </button>
        <button type="button" className="text-btn" onClick={() => switchTo(creating ? "signin" : "create")}>
          {creating ? "Already have a password? Sign in" : "First time? Create password"}
        </button>
        {!creating && (
          <button type="button" className="text-btn gate-quiet" onClick={() => switchTo("forgot")}>
            Forgot password?
          </button>
        )}
      </form>
    </div>
  );
}

/** Signed in, but not on the team (or access was removed). */
export function NoAccess() {
  const { email, signOut, recheck } = useAuth();
  return (
    <div className="gate">
      <Wordmark size="lg" />
      <div className="gate-form">
        <h1 className="gate-title">No access</h1>
        <p className="gate-text">
          {email} isn't on the Éclat team, or access was removed. Ask Harsha to add you, then tap Check again.
        </p>
        <button className="primary-btn" onClick={() => void recheck()}>Check again</button>
        <button className="text-btn" onClick={() => void signOut()}>Sign out</button>
      </div>
    </div>
  );
}
