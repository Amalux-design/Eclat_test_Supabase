import { HashRouter, Route, Routes } from "react-router-dom";
import { LogsProvider } from "./context/LogsContext";
import { BottomNav } from "./components/BottomNav";
import { AppHeader } from "./components/AppHeader";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LogsPage } from "./pages/LogsPage";
import { CalendarPage } from "./pages/CalendarPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { USING_MOCK } from "./api/client";

function App() {
  return (
    <ErrorBoundary>
      <LogsProvider>
        <HashRouter>
          <div className="app-shell">
            {USING_MOCK && (
              <div className="mock-banner">Demo mode — using local mock data (no Apps Script URL configured)</div>
            )}
            <AppHeader />
            <Routes>
              <Route path="/" element={<CalendarPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
            </Routes>
            <BottomNav />
          </div>
        </HashRouter>
      </LogsProvider>
    </ErrorBoundary>
  );
}

export default App;
