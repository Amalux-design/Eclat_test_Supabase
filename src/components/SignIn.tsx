import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Wordmark } from "./Wordmark";

// Full-screen sign-in: email → 6-digit code. After one sign-in the phone
// stays signed in, so this is rare.
export function SignIn() {
  const { sendCode, verifyCode } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setMessage("Enter the email address you were invited with.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await sendCode(email);
      setStep("code");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setMessage("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await verifyCode(email, code);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "That code didn't work.");
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <Wordmark size="lg" saving={busy} />
      {step === "email" ? (
        <form className="gate-form" onSubmit={submitEmail}>
          <h1 className="gate-title">Sign in</h1>
          <p className="gate-text">We'll email you a 6-digit code.</p>
          <input
            className="field-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email"
            autoFocus
          />
          {message && <p className="gate-message" role="alert">{message}</p>}
          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form className="gate-form" onSubmit={submitCode}>
          <h1 className="gate-title">Enter code</h1>
          <p className="gate-text">Sent to {email.trim().toLowerCase()}.</p>
          <input
            className="field-input gate-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            aria-label="6-digit code"
            autoFocus
          />
          {message && <p className="gate-message" role="alert">{message}</p>}
          <button type="submit" className="primary-btn" disabled={busy || code.length !== 6}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setStep("email");
              setCode("");
              setMessage(null);
            }}
          >
            Use a different email
          </button>
        </form>
      )}
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
