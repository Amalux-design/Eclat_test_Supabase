import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/** Password field with an eye button to show or hide what's typed. */
export function PasswordInput({ className = "field-input", ...rest }: Props) {
  const [shown, setShown] = useState(false);
  return (
    <div className="password-field">
      <input {...rest} className={className} type={shown ? "text" : "password"} />
      <button
        type="button"
        className="password-eye"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
      >
        {shown ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
      </button>
    </div>
  );
}
