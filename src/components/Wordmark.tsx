interface WordmarkProps {
  size?: "sm" | "lg";
  /** A gold shimmer sweeps through the logo while changes are being saved. */
  saving?: boolean;
  offline?: boolean;
}

// The supplied Éclat by Harsha logo (public/logo.svg, cropped to its artwork),
// drawn through a CSS mask so it takes the theme's ink colour.
export function Wordmark({ size = "sm", saving = false, offline = false }: WordmarkProps) {
  return (
    <span
      className={`logo logo-${size} ${saving ? "is-saving" : ""} ${offline ? "is-offline" : ""}`}
      role="img"
      aria-label={saving ? "Éclat by Harsha, saving changes" : "Éclat by Harsha"}
      aria-busy={saving}
    />
  );
}
