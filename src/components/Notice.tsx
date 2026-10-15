import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// Small branded toast above the tab bar for sync messages ("changed on
// another device", "couldn't save"…). Auto-hides; tap to dismiss early.

type Tone = "info" | "error";
type Show = (message: string, tone?: Tone) => void;

const NoticeContext = createContext<Show | null>(null);

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ message: string; tone: Tone; key: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback<Show>((message, tone = "info") => {
    window.clearTimeout(timer.current);
    setNotice({ message, tone, key: Date.now() });
    timer.current = window.setTimeout(() => setNotice(null), tone === "error" ? 6500 : 4500);
  }, []);

  return (
    <NoticeContext.Provider value={show}>
      {children}
      {notice &&
        createPortal(
          <div
            key={notice.key}
            className={`notice notice-${notice.tone}`}
            role={notice.tone === "error" ? "alert" : "status"}
            onClick={() => setNotice(null)}
          >
            {notice.message}
          </div>,
          document.body
        )}
    </NoticeContext.Provider>
  );
}

export function useNotice(): Show {
  const ctx = useContext(NoticeContext);
  if (!ctx) throw new Error("useNotice must be used within NoticeProvider");
  return ctx;
}
