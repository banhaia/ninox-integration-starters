import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, Plus, Bot, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import {
  sendChatMessage,
  getConversation,
  type ChatMessage,
  type Conversation
} from "@/lib/api";

export function ChatPage(): JSX.Element {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeConvId, setActiveConvId] = useState<string | undefined>(conversationId);
  const [convTitle, setConvTitle] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load existing conversation if conversationId param is present
  useEffect(() => {
    if (conversationId) {
      getConversation(conversationId)
        .then((conv: Conversation) => {
          setMessages(conv.messages);
          setConvTitle(conv.title);
          setActiveConvId(conv.id);
        })
        .catch(() => navigate("/chat"));
    } else {
      setMessages([]);
      setActiveConvId(undefined);
      setConvTitle("");
    }
  }, [conversationId, navigate]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleNewChat(): void {
    navigate("/chat");
  }

  async function handleSend(): Promise<void> {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);
    setError(null);

    // Optimistic update
    const optimisticUserMsg: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);

    try {
      const response = await sendChatMessage(text, activeConvId);
      setMessages(response.conversation.messages);
      setActiveConvId(response.conversationId);
      if (!convTitle) {
        setConvTitle(response.conversation.title);
      }
      // Update URL without triggering a re-load
      if (!conversationId || conversationId !== response.conversationId) {
        navigate(`/chat/${response.conversationId}`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar mensaje");
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m !== optimisticUserMsg));
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{convTitle || "Nueva conversación"}</h1>
          {activeConvId && (
            <p className="text-xs text-muted-foreground">{activeConvId}</p>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={handleNewChat}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nueva conversación
        </Button>
      </div>

      {/* Messages area */}
      <Card className="flex flex-1 flex-col overflow-hidden p-0">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center text-muted-foreground">
              <div className="rounded-2xl bg-primary/10 p-4 text-primary">
                <Bot className="h-8 w-8" />
              </div>
              <p className="font-medium text-foreground">¿En qué puedo ayudarte?</p>
              <p className="text-sm max-w-sm">
                Escribí tu consulta y el bot responderá usando la base de conocimiento configurada.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 rounded-xl bg-primary/10 p-1.5 text-primary h-fit mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-[75%] text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"
                )}
              >
                {msg.content}
              </div>

              {msg.role === "user" && (
                <div className="flex-shrink-0 rounded-xl bg-secondary p-1.5 text-secondary-foreground h-fit mt-0.5">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 rounded-xl bg-primary/10 p-1.5 text-primary h-fit mt-0.5">
                <Bot className="h-4 w-4" />
              </div>
              <div className="chat-bubble-assistant text-sm text-muted-foreground italic">
                Escribiendo...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border/60 p-4">
          {error && (
            <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex gap-3 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribí tu mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
              rows={2}
              className="flex-1"
              disabled={sending}
            />
            <Button
              onClick={() => { void handleSend(); }}
              disabled={!input.trim() || sending}
              className="h-11 w-11 p-0 flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
