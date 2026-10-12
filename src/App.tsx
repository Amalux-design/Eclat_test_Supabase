import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LogsProvider } from "./context/LogsContext";
import { BottomNav } from "./components/BottomNav";
import { AppHeader } from "./components/AppHeader";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LogsPage } from "./pages/LogsPage";
import { CalendarPage } from "./pages/CalendarPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { USING_MOCK } from "./api/client";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { BusyOverlay } from "./components/Loader";
import { useEffect } from "react";
import { useLogs } from "./context/LogsContext";
import { hideSplash } from "./utils/splash";

// Lifts the splash only when the app is truly ready: fresh bookings from the
// sheet (now cached on the device) and fonts loaded. Capped at 8 s so a slow
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

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConfirmProvider>
        <LogsProvider>
          <HashRouter>
            <SplashGate />
            <BusyOverlay />
            <div className="app-shell">
              {USING_MOCK && <div className="mock-banner">Demo mode with sample bookings. No sheet connected.</div>}
              <AppHeader />
              <main>
                <AppRoutes />
              </main>
              <BottomNav />
            </div>
          </HashRouter>
        </LogsProvider>
        </ConfirmProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
