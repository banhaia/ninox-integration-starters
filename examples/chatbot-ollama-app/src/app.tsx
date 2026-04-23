import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LayoutShell } from "@/components/layout-shell";
import { HomePage } from "@/routes/home-page";
import { KnowledgeBasePage } from "@/routes/knowledge-base-page";
import { ChatPage } from "@/routes/chat-page";
import { ConversationsPage } from "@/routes/conversations-page";

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<LayoutShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:conversationId" element={<ChatPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
