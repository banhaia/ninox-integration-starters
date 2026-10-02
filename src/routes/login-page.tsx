import { useState, type FormEvent } from "react";
import { DatabaseZap, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const MIN_PASSWORD = 6;

/**
 * Pantalla de acceso. Si todavía no hay usuario, funciona como autosetup:
 * el primer usuario que se crea es el dueño de esta instalación.
 */
export function LoginPage() {
  const { setupRequired, setup, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("Ingresá un usuario");
      return;
    }
    if (setupRequired) {
      if (password.length < MIN_PASSWORD) {
        setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`);
        return;
      }
      if (password !== confirm) {
        setError("Las contraseñas no coinciden");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (setupRequired) await setup(username.trim(), password);
      else await login(username.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md space-y-6 p-8">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <DatabaseZap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Ninox Integration Starter</h1>
            <p className="text-sm text-muted-foreground">
              {setupRequired ? "Configuración inicial" : "Ingresá para continuar"}
            </p>
          </div>
        </div>

        {setupRequired ? (
          <div className="flex gap-3 rounded-2xl bg-secondary/60 p-4 text-sm text-secondary-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Es la primera vez que se abre esta app. Creá el usuario administrador: vas a usarlo para entrar de
              ahora en más.
            </p>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="username">
              Usuario
            </label>
            <Input
              id="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="password">
              Contraseña
            </label>
            <Input
              id="password"
              type="password"
              autoComplete={setupRequired ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {setupRequired ? (
              <p className="text-xs text-muted-foreground">Mínimo {MIN_PASSWORD} caracteres.</p>
            ) : null}
          </div>
          {setupRequired ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="confirm">
                Repetir contraseña
              </label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </div>
          ) : null}

          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <Button type="submit" className="w-full gap-2" disabled={submitting}>
            <KeyRound className="h-4 w-4" />
            {submitting ? "Procesando..." : setupRequired ? "Crear usuario y entrar" : "Ingresar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
