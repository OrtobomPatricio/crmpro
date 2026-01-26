import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MessageCircle, Phone, User } from "lucide-react";

interface ChatListProps {
    onSelect: (conversationId: number) => void;
    selectedId: number | null;
}

export function ChatList({ onSelect, selectedId }: ChatListProps) {
    const { data: conversations, isLoading } = trpc.chat.listConversations.useQuery({});

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground bg-muted/10 m-2 rounded-lg">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
                <span className="text-xs">Cargando chats...</span>
            </div>
        );
    }

    if (!conversations || conversations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center p-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <MessageCircle className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-sm">No hay conversaciones</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-[180px]">
                    Cuando recibas mensajes de WhatsApp, aparecerán aquí.
                </p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-full">
            <div className="flex flex-col gap-1 p-2">
                {conversations.map((conv) => {
                    const isSelected = selectedId === conv.id;
                    return (
                        <button
                            key={conv.id}
                            onClick={() => onSelect(conv.id)}
                            className={cn(
                                "flex items-start gap-3 p-3 rounded-lg transition-all text-left group",
                                isSelected
                                    ? "bg-primary/10 hover:bg-primary/15"
                                    : "hover:bg-muted/50 border border-transparent"
                            )}
                        >
                            <div className="relative shrink-0">
                                <Avatar className="h-10 w-10 border border-border">
                                    <AvatarFallback className={cn(
                                        "text-xs font-medium",
                                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                    )}>
                                        {(conv.contactName?.[0] || conv.contactPhone?.[0] || "?").toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                {conv.channel === 'whatsapp' && (
                                    <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5 border-2 border-background">
                                        <Phone className="h-2 w-2 text-white" />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className={cn(
                                        "font-medium text-sm truncate",
                                        isSelected ? "text-primary" : "text-foreground"
                                    )}>
                                        {conv.contactName || conv.contactPhone}
                                    </span>
                                    {conv.lastMessageAt && (
                                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                                            {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false, locale: es, includeSeconds: false })
                                                .replace('alrededor de ', '')
                                                .replace('hace ', '')}
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs text-muted-foreground truncate leading-relaxed">
                                    {conv.contactPhone}
                                </p>
                            </div>

                            {conv.unreadCount > 0 && (
                                <Badge
                                    variant="default"
                                    className="shrink-0 h-5 min-w-5 flex items-center justify-center p-0 rounded-full text-[10px]"
                                >
                                    {conv.unreadCount}
                                </Badge>
                            )}
                        </button>
                    );
                })}
            </div>
        </ScrollArea>
    );
}
