import { ChatList } from "@/components/chat/ChatList";
import { ChatThread } from "@/components/chat/ChatThread";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";

export default function ChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);

  return (
    <div className="h-[calc(100vh-80px)] flex gap-4">
      {/* Left: Conversation List */}
      <Card className="w-80 flex flex-col overflow-hidden border-border/50 shadow-sm bg-background/50 backdrop-blur-sm">
        <div className="p-4 border-b border-border/50 bg-muted/30">
          <h2 className="font-semibold mb-3 tracking-tight">Mensajes</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar chats..."
              className="pl-9 bg-background/50 h-9"
            />
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatList
            onSelect={setSelectedConversationId}
            selectedId={selectedConversationId}
          />
        </div>
      </Card>

      {/* Center: Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden border-border/50 shadow-sm bg-background/50 backdrop-blur-sm">
        {selectedConversationId ? (
          <>
            <div className="h-14 border-b border-border/50 bg-muted/30 flex items-center px-4 justify-between shrink-0">
              <div className="flex items-center gap-3">
                {/* Header info could go here (Avatar, Name, Status) - currently simplified */}
                <span className="font-medium text-sm">Conversación Activa</span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden relative">
              <ChatThread conversationId={selectedConversationId} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 bg-muted/5">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-8 h-8 text-primary"
              >
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                <path d="M8 12h.01" />
                <path d="M12 12h.01" />
                <path d="M16 12h.01" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">Tu Bandeja de Entrada</h3>
            <p className="text-sm max-w-md text-center">
              Selecciona una conversación de la lista para ver el historial y responder a tus leads.
            </p>
          </div>
        )}
      </Card>

      {/* Right: Lead Details (Collapsible) - Placeholder for Phase 3 */}
      {selectedConversationId && (
        <div className="w-72 hidden xl:block animate-in fade-in slide-in-from-right-4 duration-300">
          <Card className="h-full border-border/50 shadow-sm p-4 bg-background/50 backdrop-blur-sm">
            <h3 className="font-semibold text-sm mb-4">Detalles del Lead</h3>
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground bg-muted/10 rounded-lg text-sm border border-dashed border-border">
              Info del Contacto
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-8 bg-muted/20 rounded w-full"></div>
              <div className="h-24 bg-muted/20 rounded w-full"></div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
