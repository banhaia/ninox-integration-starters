import { DatabaseZap, PackageSearch } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/cn";

export function LayoutShell(): JSX.Element {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 md:px-6">
      <header className="surface mb-6 flex flex-col gap-4 rounded-[28px] px-5 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <DatabaseZap className="h-6 w-6" />
          </div>
          <div>
            <Link to="/" className="text-xl font-bold tracking-tight">
              Ninox Stock Console
            </Link>
            <p className="text-sm text-muted-foreground">
              Snapshot local del catalogo con sync programado y consulta rapida.
            </p>
          </div>
        </div>

        <nav className="flex gap-2 rounded-2xl bg-white/70 p-1">
          {[
            { to: "/", label: "Home" },
            { to: "/stock", label: "Stock" },
            { to: "/preventas", label: "Preventas" },
            { to: "/historial", label: "Historial" }
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "rounded-xl px-4 py-2 text-sm font-medium transition",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-6 flex items-center justify-between border-t border-border/70 py-4 text-sm text-muted-foreground">
        <span>Catalogo local como fuente de lectura</span>
        <span className="inline-flex items-center gap-2">
          <PackageSearch className="h-4 w-4" />
          preparado para sumar otros sources
        </span>
      </footer>
    </div>
  );
}
