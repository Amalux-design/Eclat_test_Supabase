import { Sparkles } from "lucide-react";

export function AppHeader() {
  return (
    <div className="app-header">
      <Sparkles size={18} strokeWidth={2.2} className="app-header-icon" />
      <span className="app-header-title">
        Aparna<span className="app-header-apostrophe">'s</span> Works
      </span>
    </div>
  );
}
