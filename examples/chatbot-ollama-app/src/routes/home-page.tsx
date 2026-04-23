import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, BookOpen, MessageSquare, History, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStatus, type StatusResponse } from "@/lib/api";

export function HomePage(): JSX.Element {
  const [status, setStatus] = useState<StatusResponse | null>(null);

  useEffect(() => {
    getStatus()
      .then(setStatus)
      .catch(() => null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-primary/10 p-4 text-primary">
            <Bot className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Chatbot Ollama</h1>
            <p className="text-muted-foreground">
              Asistente conversacional personalizable con base de conocimiento de tu empresa.
            </p>
          </div>
        </div>
        <Link to="/chat">
          <Button>
            <MessageSquare className="mr-2 h-4 w-4" />
            Iniciar chat
          </Button>
        </Link>
      </Card>

      {/* Status */}
      {status && (
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-green-100 p-2 text-green-700">
            <Zap className="h-4 w-4" />
          </div>
          <div className="flex flex-1 flex-wrap gap-2">
            <Badge variant="success">Servidor activo</Badge>
            <Badge>Ollama: {status.ollama.baseUrl}</Badge>
            <Badge variant="accent">Modelo: {status.ollama.model}</Badge>
          </div>
        </Card>
      )}

      {/* Feature cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="space-y-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary w-fit">
            <BookOpen className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold">Base de conocimiento</h2>
          <p className="text-sm text-muted-foreground">
            Configurá la información de tu empresa: nombre, rubros, productos, quiénes somos,
            ubicaciones y el system prompt del agente.
          </p>
          <Link to="/knowledge-base">
            <Button variant="secondary" size="sm">
              Editar
            </Button>
          </Link>
        </Card>

        <Card className="space-y-3">
          <div className="rounded-xl bg-accent/15 p-3 text-accent w-fit">
            <MessageSquare className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold">Chat con el bot</h2>
          <p className="text-sm text-muted-foreground">
            Chateá con el asistente en tiempo real. El bot usa tu base de conocimiento
            para responder preguntas sobre tu empresa y productos.
          </p>
          <Link to="/chat">
            <Button variant="secondary" size="sm">
              Abrir chat
            </Button>
          </Link>
        </Card>

        <Card className="space-y-3">
          <div className="rounded-xl bg-secondary p-3 text-secondary-foreground w-fit">
            <History className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold">Historial</h2>
          <p className="text-sm text-muted-foreground">
            Todas las conversaciones se guardan automáticamente en JSON local.
            Podés revisar, retomar o eliminar cualquier conversación.
          </p>
          <Link to="/conversations">
            <Button variant="secondary" size="sm">
              Ver historial
            </Button>
          </Link>
        </Card>
      </div>

      {/* How it works */}
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">¿Cómo funciona?</h2>
        <div className="grid gap-3 md:grid-cols-2 text-sm text-muted-foreground">
          <p>1. Configurá la base de conocimiento con la info de tu empresa.</p>
          <p>2. El sistema genera un prompt con esa información.</p>
          <p>3. Al chatear, el modelo recibe el contexto completo de tu empresa.</p>
          <p>4. El historial de conversaciones se guarda en archivos JSON locales.</p>
          <p>5. Ollama puede correr localmente o apuntar a un servidor en la nube.</p>
          <p>6. El modelo y la URL de Ollama son configurables por variables de entorno.</p>
        </div>
      </Card>
    </div>
  );
}
