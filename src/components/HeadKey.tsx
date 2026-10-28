import { KeyRound } from "lucide-react";

/** Account / team button beside a page title (phones held upright, where the header bar is hidden). */
export function HeadKey() {
  return (
    <button
      type="button"
      className="head-key"
      onClick={() => window.dispatchEvent(new Event("eclat:account"))}
      aria-label="Account and team"
    >
      <KeyRound size={21} strokeWidth={1.6} />
    </button>
  );
}
