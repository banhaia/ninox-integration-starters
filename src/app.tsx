import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LayoutShell } from "@/components/layout-shell";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { HomePage } from "@/routes/home-page";
import { StockPage } from "@/routes/stock-page";
import { PreventaPage } from "@/routes/preventa-page";
import { OrdersPage } from "@/routes/orders-page";
import { IngestPage } from "@/routes/ingest-page";
import { SettingsPage } from "@/routes/settings-page";
import { LoginPage } from "@/routes/login-page";

// Recharts pesa: la página de reportes se carga recién cuando se abre.
const ReportsPage = lazy(() => import("@/routes/reports-page").then((m) => ({ default: m.ReportsPage })));

function AuthenticatedApp() {
  const { loading, user } = useAuth();

  if (loading) {
    return <div className="py-24 text-center text-muted-foreground">Cargando...</div>;
  }

  if (!user) return <LoginPage />;

  return (
    <Routes>
      <Route element={<LayoutShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/operaciones/nueva" element={<PreventaPage />} />
        <Route path="/operaciones" element={<OrdersPage />} />
        <Route path="/ingesta" element={<IngestPage />} />
        <Route
          path="/reportes"
          element={
            <Suspense fallback={<div className="py-16 text-center text-muted-foreground">Cargando reportes...</div>}>
              <ReportsPage />
            </Suspense>
          }
        />
        <Route path="/configuracion" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </BrowserRouter>
  );
}
