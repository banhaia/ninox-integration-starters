import { useState } from "react";
import {
  BarChart3,
  Boxes,
  DatabaseZap,
  DownloadCloud,
  Home,
  ListChecks,
  LogOut,
  Menu,
  Settings,
  ShoppingCart
} from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/stock", label: "Stock", icon: Boxes },
  { to: "/operaciones/nueva", label: "Nueva operación", icon: ShoppingCart },
  { to: "/operaciones", label: "Reservas y ventas", icon: ListChecks, end: true },
  { to: "/ingesta", label: "Ingesta", icon: DownloadCloud },
  { to: "/reportes", label: "Reportes", icon: BarChart3 },
  { to: "/configuracion", label: "Configuración", icon: Settings }
];

export function LayoutShell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 md:px-6">
      <header className="surface mb-6 rounded-[28px] px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
              <DatabaseZap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">Ninox Integration Starter</p>
              <p className="hidden text-xs text-muted-foreground sm:block">Integración de terceros · SQLite local</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">{user?.username}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-white/70 hover:text-foreground"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="rounded-xl p-2 text-muted-foreground hover:bg-white/70 lg:hidden"
              aria-label="Menú"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className={cn("mt-4 flex-wrap gap-1 rounded-2xl bg-white/70 p-1 lg:flex", open ? "flex" : "hidden")}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 py-4 text-xs text-muted-foreground">
        <span>Los datos se guardan en una base SQLite local. El token de Ninox nunca sale del backend.</span>
        <a
          className="underline-offset-2 hover:underline"
          href="https://docs.ninox.com.ar/docs/terceros"
          target="_blank"
          rel="noreferrer"
        >
          Documentación de la API
        </a>
      </footer>
    </div>
  );
}
