import { ChatList } from "@/components/chat/ChatList";
import { ChatThread } from "@/components/chat/ChatThread";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import {
  Filter,
  ArrowUpDown,
  Check,
  ChevronDown,
  Globe,
  Tag,
  Flag,
  Calendar,
  Clock,
  Users,
  MessageSquare,
  Briefcase,
  Hash,
  Layers,
  AlertCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
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

export default function ChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);

  return (
    <div className="h-[calc(100vh-80px)] flex gap-4">
      {/* Left: Conversation List */}
      <Card className="w-96 flex flex-col overflow-hidden border-border/50 shadow-sm bg-background/50 backdrop-blur-sm">
        <div className="p-3 border-b border-border/50 bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold tracking-tight">Mensajes</h2>
            {/* Channel Selector */}
            <ChannelSelector />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar chats..."
                className="pl-8 bg-background/50 h-8 text-xs"
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

function ChannelSelector() {
  const { data: channels } = trpc.whatsappNumbers.list.useQuery();
  // Default to 'all' or first channel
  const [selectedChannel, setSelectedChannel] = useState("all");

  return (
    <Select value={selectedChannel} onValueChange={setSelectedChannel}>
      <SelectTrigger className="w-[180px] h-8 text-xs bg-background/50 border-input/50">
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
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 bg-background/50">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
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
  const filters = [
    { id: "status", label: "Estado", icon: AlertCircle },
    { id: "priority", label: "Prioridad", icon: Flag },
    { id: "assigned", label: "Nombre Asignado", icon: Users },
    { id: "inbox", label: "Bandeja de entrada", icon: Layers },
    { id: "team", label: "Nombre del equipo", icon: Briefcase },
    { id: "conv_id", label: "ID Conversación", icon: Hash },
    { id: "campaign", label: "Campaña", icon: MessageSquare },
    { id: "tags", label: "Etiquetas", icon: Tag },
    { id: "browser_lang", label: "Idioma navegador", icon: Globe },
    { id: "country", label: "País", icon: Globe }, // Reusing globe for country
    { id: "referral", label: "Referencia", icon: Layers },
    { id: "created_at", label: "Creado el", icon: Calendar },
    { id: "last_activity", label: "Última actividad", icon: Clock },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 bg-background/50">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="p-3 border-b bg-muted/20">
          <h4 className="font-medium text-sm">Filtrar vista</h4>
          <p className="text-xs text-muted-foreground">Selecciona los campos visibles</p>
        </div>
        <ScrollArea className="h-72">
          <div className="p-2 space-y-1">
            {filters.map((filter) => (
              <div key={filter.id} className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer">
                <Checkbox id={filter.id} />
                <Label htmlFor={filter.id} className="flex items-center gap-2 text-sm font-normal cursor-pointer flex-1">
                  <filter.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {filter.label}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-2 border-t bg-muted/20 flex justify-end">
          <Button size="sm" variant="ghost" className="h-7 text-xs">Limpiar</Button>
          <Button size="sm" className="h-7 text-xs ml-2">Aplicar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
