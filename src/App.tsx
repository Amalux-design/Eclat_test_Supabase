import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LogsProvider } from "./context/LogsContext";
import { BottomNav, TABS } from "./components/BottomNav";
import { useSwipeTabs } from "./utils/useSwipeTabs";
import { AppHeader } from "./components/AppHeader";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LogsPage } from "./pages/LogsPage";
import { CalendarPage } from "./pages/CalendarPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { BusyOverlay } from "./components/Loader";
import { InstallHint } from "./components/InstallHint";
import { NoticeProvider } from "./components/Notice";
import { NoAccess, SignIn } from "./components/SignIn";
import { useEffect, useMemo, useRef } from "react";
import { useLogs } from "./context/LogsContext";
import { hideSplash } from "./utils/splash";

// Lifts the splash only when the app is truly ready: fresh bookings from the
// database (now cached on the device) and fonts loaded. Capped at 8 s so a slow
// or offline start opens on the cached copy instead of waiting forever.
function SplashGate() {
  const { settled } = useLogs();
  useEffect(() => {
    const cap = setTimeout(hideSplash, 8000);
    return () => clearTimeout(cap);
  }, []);
  useEffect(() => {
    if (!settled) return;
    let cancelled = false;
    const fonts = document.fonts?.ready ?? Promise.resolve();
    void fonts.then(() => {
      if (!cancelled) hideSplash();
    });
    return () => {
      cancelled = true;
    };
  }, [settled]);
  return null;
}

function AppRoutes() {
  const { isAdmin } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<CalendarPage />} />
      <Route path="/logs" element={<LogsPage />} />
      <Route path="/payments" element={isAdmin ? <PaymentsPage /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Lives inside the signed-in shell, so <main> exists when it attaches. */
function SwipeTabs({ main }: { main: React.RefObject<HTMLElement | null> }) {
  const { isAdmin } = useAuth();
  const paths = useMemo(() => TABS.filter((t) => isAdmin || !t.adminOnly).map((t) => t.to), [isAdmin]);
  useSwipeTabs(main, paths);
  return null;
}

/** Signed-out and removed people see only the sign-in / no-access screens. */
function Shell() {
  const { status } = useAuth();
  const mainRef = useRef<HTMLElement>(null);
  if (status === "signed-out") return <SignIn />;
  if (status === "no-access") return <NoAccess />;
  return (
    <div className="app-shell">
      <AppHeader />
      <main ref={mainRef}>
        <AppRoutes />
      </main>
      <BottomNav />
      <SwipeTabs main={mainRef} />
      <InstallHint />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConfirmProvider>
        <NoticeProvider>
        <LogsProvider>
          <HashRouter>
            <SplashGate />
            <BusyOverlay />
            <Shell />
          </HashRouter>
        </LogsProvider>
        </NoticeProvider>
        </ConfirmProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
