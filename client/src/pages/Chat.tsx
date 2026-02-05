import { ChatList } from "@/components/chat/ChatList";
import { ChatThread } from "@/components/chat/ChatThread";

import { ChatLeadDetails } from "@/components/chat/ChatLeadDetails";
import { ChatActionsMenu } from "@/components/chat/ChatActionsMenu";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Filter,
  ArrowUpDown,
  AlertCircle,
  Flag,
  Users,
  Layers,
  Briefcase,
  Hash,
  MessageSquare,
  Tag,
  Globe,
  Calendar,
  Clock,
  Phone
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const [location, setLocation] = useLocation();
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);

  const getOrCreateMutation = trpc.chat.getOrCreateByLeadId.useMutation({
    onSuccess: (data) => {
      setSelectedConversationId(data.id);
      window.history.replaceState({}, "", "/chat");
    },
    onError: (e) => {
      console.error("Failed to open chat for lead", e);
    }
  });

  const { data: selectedConversation } = trpc.chat.getById.useQuery(
    { id: selectedConversationId! },
    { enabled: !!selectedConversationId }
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const leadIdParam = params.get("leadId");
    if (leadIdParam) {
      const leadId = parseInt(leadIdParam);
      if (!isNaN(leadId)) {
        getOrCreateMutation.mutate({ leadId });
      }
    }
  }, []);

  return (
    <div className="h-[calc(100vh-80px)] flex gap-4 relative">
      {/* Left: Conversation List */}
      <Card className={cn(
        "w-full md:w-80 lg:w-96 flex flex-col overflow-hidden border-border/50 shadow-sm bg-background/50 backdrop-blur-sm transition-all duration-300",
        selectedConversationId ? "hidden md:flex" : "flex"
      )}>
        <div className="p-3 border-b border-border/50 bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold tracking-tight">Mensajes</h2>
            <ChannelSelector />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar chats..."
                className="pl-8 bg-background/50 h-8 text-xs focus-visible:ring-offset-0"
              />
            </div>

            <SortMenu />
            <FilterMenu />
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
      <Card className={cn(
        "flex-1 flex flex-col overflow-hidden border-border/50 shadow-sm bg-background/50 backdrop-blur-sm transition-all duration-300",
        !selectedConversationId ? "hidden md:flex" : "flex"
      )}>
        {selectedConversationId ? (
          <>
            <div className="h-14 border-b border-border/50 bg-muted/30 flex items-center px-4 justify-between shrink-0">
              <div className="flex items-center gap-3">
                {/* Mobile Back Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden -ml-2 h-8 w-8"
                  onClick={() => setSelectedConversationId(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="font-medium text-sm">Conversación Activa</span>
                </div>

                {selectedConversation && (
                  <ChatActionsMenu
                    conversationId={selectedConversation.id}
                    currentAssignedId={selectedConversation.assignedToId}
                  />
                )}
              </div>
            </div>
            <div className="flex-1 overflow-hidden relative">
              <ChatThread conversationId={selectedConversationId} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 bg-muted/5">
            <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center mb-6">
              <MessageSquare className="w-10 h-10 text-primary/40" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Tu Bandeja de Entrada</h3>
            <p className="text-sm max-w-md text-center text-muted-foreground/80">
              Selecciona una conversación de la izquierda para ver el historial, responder a tus leads y gestionar tus ventas.
            </p>
          </div>
        )}
      </Card>

      {/* Right: Lead Details (Collapsible) */}
      {selectedConversationId && (
        <div className="hidden xl:block animate-in fade-in slide-in-from-right-4 duration-500 h-[calc(100vh-4rem)]">
          {selectedConversation && selectedConversation.leadId ? (
            <ChatLeadDetails leadId={selectedConversation.leadId} />
          ) : (
            <div className="w-80 h-full border-l p-4 flex flex-col items-center justify-center text-muted-foreground bg-background">
              <Users className="h-8 w-8 mb-2 opacity-20" />
              <p>Este chat no tiene un lead asociado.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChannelSelector() {
  const { data: channels } = trpc.whatsappNumbers.list.useQuery();
  const [selectedChannel, setSelectedChannel] = useState("all");

  return (
    <Select value={selectedChannel} onValueChange={setSelectedChannel}>
      <SelectTrigger className="w-[160px] h-8 text-xs bg-muted/50 border-transparent hover:bg-muted/80 focus:ring-0 gap-1 rounded-full px-3">
        <Phone className="h-3 w-3 opacity-70" />
        <SelectValue placeholder="Todos los canales" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos los canales</SelectItem>
        {channels?.map((channel) => (
          <SelectItem key={channel.id} value={channel.phoneNumber} className="text-xs">
            {channel.displayName || channel.phoneNumber}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SortMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted/50 rounded-full">
          <ArrowUpDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Más recientes</DropdownMenuItem>
        <DropdownMenuItem>Más antiguos</DropdownMenuItem>
        <DropdownMenuItem>No leídos primero</DropdownMenuItem>
        <DropdownMenuItem>Prioridad Alta</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterMenu() {
  // Icons fixed in import
  const filters = [
    { id: "status", label: "Estado", icon: AlertCircle },
    { id: "priority", label: "Prioridad", icon: Flag },
    { id: "assigned", label: "Asignado", icon: Users },
    { id: "inbox", label: "Bandeja", icon: Layers },
    { id: "team", label: "Equipo", icon: Briefcase },
    { id: "conv_id", label: "ID Conv.", icon: Hash },
    { id: "campaign", label: "Campaña", icon: MessageSquare },
    { id: "tags", label: "Etiquetas", icon: Tag },
    { id: "browser_lang", label: "Idioma", icon: Globe },
    { id: "created_at", label: "Fecha creación", icon: Calendar },
    { id: "last_activity", label: "Actividad", icon: Clock },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted/50 rounded-full">
          <Filter className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="p-3 border-b bg-muted/20">
          <h4 className="font-medium text-sm">Filtrar vista</h4>
          <p className="text-xs text-muted-foreground">Selecciona filtro</p>
        </div>
        <ScrollArea className="h-72">
          <div className="p-2 space-y-1">
            {filters.map((filter) => (
              <div key={filter.id} className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer transition-colors">
                <Checkbox id={filter.id} />
                <Label htmlFor={filter.id} className="flex items-center gap-2 text-xs font-normal cursor-pointer flex-1">
                  <filter.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {filter.label}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-2 border-t bg-muted/20 flex justify-end gap-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs">Limpiar</Button>
          <Button size="sm" className="h-7 text-xs">Aplicar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
