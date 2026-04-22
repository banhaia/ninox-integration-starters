import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Trash2, Clock, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listConversations, deleteConversation, type ConversationSummary } from "@/lib/api";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function ConversationsPage(): JSX.Element {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const list = await listConversations();
      setConversations(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleDelete(id: string): Promise<void> {
    if (!confirm("¿Eliminar esta conversación?")) return;
    setDeleting(id);
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-muted-foreground">Cargando historial...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Historial de conversaciones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {conversations.length} conversación{conversations.length !== 1 ? "es" : ""} guardada{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link to="/chat">
          <Button>
            <MessageSquare className="mr-2 h-4 w-4" />
            Nueva conversación
          </Button>
        </Link>
      </div>

      {conversations.length === 0 ? (
        <Card className="py-12 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Todavía no hay conversaciones guardadas.</p>
          <Link to="/chat" className="mt-4 inline-block">
            <Button variant="secondary">Iniciar primera conversación</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <Card key={conv.id} className="flex items-center gap-4 p-4">
              <div className="rounded-xl bg-primary/10 p-2 text-primary flex-shrink-0">
                <MessageSquare className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm truncate">{conv.title}</span>
                  <Badge className="flex-shrink-0 text-xs">{conv.messageCount} mensajes</Badge>
                </div>
                {conv.lastMessage && (
                  <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                )}
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(conv.updatedAt)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Link to={`/chat/${conv.id}`}>
                  <Button variant="secondary" size="sm">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { void handleDelete(conv.id); }}
                  disabled={deleting === conv.id}
                  className="text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
