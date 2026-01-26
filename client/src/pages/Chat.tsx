import { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Send,
  Paperclip,
  Image,
  Video,
  FileText,
  MapPin,
  Mic,
  Smile,
  Phone,
  Search,
  MoreVertical,
  Check,
  CheckCheck,
  Clock,
  Plus,
  X
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Emoji picker data
const emojiCategories = {
  "Caras": ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐"],
  "Gestos": ["👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤝", "🙏", "💪", "🦾", "🖕", "✍️", "🤳", "💅"],
  "Corazones": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝"],
  "Objetos": ["📱", "💻", "🖥️", "📷", "📹", "🎥", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "🎚️", "🎛️", "⏱️", "⏲️", "⏰", "🕰️", "💡", "🔦", "🕯️"],
};

type Message = {
  id: number;
  conversationId: number;
  whatsappNumberId: number | null;
  direction: "inbound" | "outbound";
  messageType: "text" | "image" | "video" | "audio" | "document" | "location" | "sticker" | "contact" | "template";
  content: string | null;
  mediaUrl: string | null;
  mediaName: string | null;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  createdAt: Date;
};

type Conversation = {
  id: number;
  whatsappNumberId: number | null;
  contactPhone: string;
  contactName: string | null;
  unreadCount: number;
  lastMessageAt: Date | null;
  status: "active" | "archived" | "blocked";
};

export default function Chat() {
  const [location] = useLocation();
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [pendingConversationId, setPendingConversationId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Allow deep-linking: /chat?conversationId=123&whatsappNumberId=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const conv = url.searchParams.get("conversationId");
    const ch = url.searchParams.get("whatsappNumberId");

    const convId = conv ? Number(conv) : null;
    const chId = ch ? Number(ch) : null;

    if (chId && !Number.isNaN(chId)) {
      setSelectedChannel(chId);
    }

    if (convId && !Number.isNaN(convId)) {
      setPendingConversationId(convId);
    }
  }, [location]);

  // Queries
  const { data: channels = [] } = trpc.whatsappNumbers.list.useQuery();
  const { data: conversations = [], refetch: refetchConversations } = trpc.chat.listConversations.useQuery(
    { whatsappNumberId: selectedChannel ?? undefined },
    { enabled: true }
  );
  const { data: messages = [], refetch: refetchMessages } = trpc.chat.getMessages.useQuery(
    { conversationId: selectedConversation?.id ?? 0 },
    { enabled: !!selectedConversation }
  );

  // When conversations are loaded, auto-select the pending conversation if present
  useEffect(() => {
    if (!pendingConversationId) return;
    const found = conversations.find(c => c.id === pendingConversationId);
    if (found) {
      setSelectedConversation(found as any);
      setPendingConversationId(null);
    }
  }, [pendingConversationId, conversations]);

  // Mutations
  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setMessageText("");
      refetchMessages();
      refetchConversations();
    },
    onError: (error) => {
      toast.error("Error al enviar mensaje: " + error.message);
    },
  });

  const createConversation = trpc.chat.createConversation.useMutation({
    onSuccess: (data) => {
      toast.success("Conversación creada");
      refetchConversations();
      setIsNewChatOpen(false);
      setNewChatPhone("");
      setNewChatName("");
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedConversation || !selectedChannel) return;

    sendMessage.mutate({
      conversationId: selectedConversation.id,
      whatsappNumberId: selectedChannel,
      messageType: "text",
      content: messageText,
    });
  };

  const handleSendMedia = (type: "image" | "video" | "document" | "audio") => {
    if (!selectedConversation || !selectedChannel) return;

    // In a real implementation, this would open a file picker
    toast.info(`Función de envío de ${type} - Próximamente`);
    setIsAttachmentOpen(false);
  };

  const handleSendLocation = () => {
    if (!selectedConversation || !selectedChannel) return;

    // In a real implementation, this would open a location picker
    toast.info("Función de envío de ubicación - Próximamente");
    setIsAttachmentOpen(false);
  };

  const handleCreateConversation = () => {
    if (!newChatPhone || !selectedChannel) {
      toast.error("Selecciona un canal y escribe un número");
      return;
    }

    createConversation.mutate({
      whatsappNumberId: selectedChannel,
      contactPhone: newChatPhone,
      contactName: newChatName || undefined,
    });
  };

  const addEmoji = (emoji: string) => {
    setMessageText((prev) => prev + emoji);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-3 h-3 text-muted-foreground" />;
      case "sent":
        return <Check className="w-3 h-3 text-muted-foreground" />;
      case "delivered":
        return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
      case "read":
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.contactPhone.includes(searchQuery)
  );

  const activeChannels = channels.filter((ch) => ch.isConnected);

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex">
        {/* Sidebar - Conversations */}
        <div className="w-80 border-r border-border flex flex-col bg-card">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-lg">Mensajes</h2>
              <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <Plus className="w-5 h-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nueva Conversación</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Canal</Label>
                      <Select
                        value={selectedChannel?.toString() ?? ""}
                        onValueChange={(v) => setSelectedChannel(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un canal" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeChannels.map((ch: { id: number; displayName: string | null; phoneNumber: string }) => (
                            <SelectItem key={ch.id} value={ch.id.toString()}>
                              {ch.displayName || ch.phoneNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Número de teléfono</Label>
                      <Input
                        value={newChatPhone}
                        onChange={(e) => setNewChatPhone(e.target.value)}
                        placeholder="+507 6999-8888"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nombre (opcional)</Label>
                      <Input
                        value={newChatName}
                        onChange={(e) => setNewChatName(e.target.value)}
                        placeholder="Juan Pérez"
                      />
                    </div>
                    <Button onClick={handleCreateConversation} className="w-full">
                      Crear Conversación
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Channel selector */}
            <Select
              value={selectedChannel?.toString() ?? "all"}
              onValueChange={(v) => setSelectedChannel(v === "all" ? null : parseInt(v))}
            >
              <SelectTrigger className="mb-3">
                <SelectValue placeholder="Todos los canales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los canales</SelectItem>
                {activeChannels.map((ch: { id: number; displayName: string | null; phoneNumber: string }) => (
                  <SelectItem key={ch.id} value={ch.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      {ch.displayName || ch.phoneNumber}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversación..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Conversations list */}
          <ScrollArea className="flex-1">
            {filteredConversations.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`
                      p-3 cursor-pointer transition-colors
                      ${selectedConversation?.id === conv.id
                        ? "bg-primary/10"
                        : "hover:bg-muted/50"
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {(conv.contactName || conv.contactPhone).substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">
                            {conv.contactName || conv.contactPhone}
                          </span>
                          {conv.lastMessageAt && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(conv.lastMessageAt), "HH:mm")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground truncate">
                            {conv.contactPhone}
                          </span>
                          {conv.unreadCount > 0 && (
                            <Badge className="bg-green-500 text-white text-xs">
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay conversaciones</p>
                <p className="text-sm">Crea una nueva para comenzar</p>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-background">
          {selectedConversation ? (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-border flex items-center justify-between bg-card">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {(selectedConversation.contactName || selectedConversation.contactPhone)
                        .substring(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium">
                      {selectedConversation.contactName || selectedConversation.contactPhone}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedConversation.contactPhone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Phone className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Search className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 max-w-3xl mx-auto">
                  {messages.map((msg: Message) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`
                          max-w-[70%] rounded-lg p-3
                          ${msg.direction === "outbound"
                            ? "bg-green-600 text-white rounded-br-none"
                            : "bg-card border border-border rounded-bl-none"
                          }
                        `}
                      >
                        {msg.messageType === "text" && (
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                        {msg.messageType === "image" && msg.mediaUrl && (
                          <img
                            src={msg.mediaUrl}
                            alt="Imagen"
                            className="rounded max-w-full"
                          />
                        )}
                        {msg.messageType === "location" && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            <span>Ubicación compartida</span>
                          </div>
                        )}
                        <div className={`
                          flex items-center justify-end gap-1 mt-1 text-xs
                          ${msg.direction === "outbound" ? "text-green-200" : "text-muted-foreground"}
                        `}>
                          <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
                          {msg.direction === "outbound" && getStatusIcon(msg.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input area */}
              <div className="p-4 border-t border-border bg-card">
                <div className="flex items-center gap-2 max-w-3xl mx-auto">
                  {/* Emoji picker */}
                  <Popover open={isEmojiOpen} onOpenChange={setIsEmojiOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Smile className="w-5 h-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-2" side="top">
                      <ScrollArea className="h-64">
                        {Object.entries(emojiCategories).map(([category, emojis]) => (
                          <div key={category} className="mb-3">
                            <h4 className="text-xs font-medium text-muted-foreground mb-2">
                              {category}
                            </h4>
                            <div className="grid grid-cols-8 gap-1">
                              {emojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => addEmoji(emoji)}
                                  className="p-1 hover:bg-muted rounded text-xl"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>

                  {/* Attachment menu */}
                  <Popover open={isAttachmentOpen} onOpenChange={setIsAttachmentOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Paperclip className="w-5 h-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2" side="top">
                      <div className="space-y-1">
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => handleSendMedia("image")}
                        >
                          <Image className="w-4 h-4 mr-2 text-blue-500" />
                          Imagen
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => handleSendMedia("video")}
                        >
                          <Video className="w-4 h-4 mr-2 text-purple-500" />
                          Video
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => handleSendMedia("document")}
                        >
                          <FileText className="w-4 h-4 mr-2 text-orange-500" />
                          Documento
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={handleSendLocation}
                        >
                          <MapPin className="w-4 h-4 mr-2 text-green-500" />
                          Ubicación
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Message input */}
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />

                  {/* Voice message */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toast.info("Grabación de voz - Próximamente")}
                  >
                    <Mic className="w-5 h-5" />
                  </Button>

                  {/* Send button */}
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sendMessage.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <Phone className="w-12 h-12 opacity-50" />
                </div>
                <h3 className="text-xl font-medium mb-2">Imagine Lab CRM</h3>
                <p>Selecciona una conversación para comenzar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
