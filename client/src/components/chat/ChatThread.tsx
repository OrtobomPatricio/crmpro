import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Image as ImageIcon, Paperclip, Send, Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface ChatThreadProps {
    conversationId: number;
}

export function ChatThread({ conversationId }: ChatThreadProps) {
    const [inputText, setInputText] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    const { data: messages, isLoading, refetch } = trpc.chat.getMessages.useQuery(
        { conversationId },
        {
            refetchInterval: 5000,
        }
    );

    useEffect(() => {
        if (messages?.length) {
            scrollToBottom();
        }
    }, [messages?.length]);

    const sendMessage = trpc.chat.sendMessage.useMutation({
        onSuccess: () => {
            setInputText("");
            refetch();
            scrollToBottom();
        },
        onError: (err) => {
            toast.error("Error al enviar mensaje: " + err.message);
        }
    });

    const markAsRead = trpc.chat.markAsRead.useMutation();

    useEffect(() => {
        if (conversationId) {
            markAsRead.mutate({ conversationId });
            scrollToBottom();
        }
    }, [conversationId]);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            // Small timeout to allow render
            setTimeout(() => {
                scrollRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        }
    };

    const handleSend = () => {
        if (!inputText.trim()) return;
        sendMessage.mutate({
            conversationId,
            messageType: 'text',
            content: inputText
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-muted/5">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-muted/5">
            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
                <div className="flex flex-col gap-4 min-h-0">
                    {messages?.map((msg, index) => {
                        const isOutbound = msg.direction === 'outbound';
                        const isLast = index === messages.length - 1;

                        return (
                            <div
                                key={msg.id}
                                ref={isLast ? scrollRef : null}
                                className={cn(
                                    "flex items-end gap-2 max-w-[80%]",
                                    isOutbound ? "ml-auto flex-row-reverse" : ""
                                )}
                            >
                                {!isOutbound && (
                                    <Avatar className="h-8 w-8 border border-border">
                                        <AvatarFallback className="text-[10px] bg-muted">
                                            C
                                        </AvatarFallback>
                                    </Avatar>
                                )}

                                <div
                                    className={cn(
                                        "rounded-2xl px-4 py-2.5 shadow-sm text-sm whitespace-pre-wrap break-words",
                                        isOutbound
                                            ? "bg-primary text-primary-foreground rounded-br-none"
                                            : "bg-background border border-border rounded-bl-none"
                                    )}
                                >
                                    {msg.messageType === 'text' && <p>{msg.content}</p>}
                                    {msg.messageType === 'image' && msg.mediaUrl && (
                                        <div className="rounded-lg overflow-hidden my-1">
                                            <img
                                                src={msg.mediaUrl}
                                                alt="Shared image"
                                                className="max-w-[240px] max-h-[200px] object-cover"
                                            />
                                            {msg.content && <p className="mt-2 text-xs opacity-90">{msg.content}</p>}
                                        </div>
                                    )}
                                    {msg.messageType === 'document' && (
                                        <div className="flex items-center gap-2 bg-black/10 rounded p-2">
                                            <Paperclip className="h-4 w-4" />
                                            <a href={msg.mediaUrl || "#"} target="_blank" className="underline text-xs">Ver Documento</a>
                                        </div>
                                    )}

                                    <div className={cn(
                                        "text-[10px] mt-1 text-right opacity-70 flex items-center justify-end gap-1",
                                        isOutbound ? "text-primary-foreground/80" : "text-muted-foreground"
                                    )}>
                                        {format(new Date(msg.createdAt), 'HH:mm')}
                                        {isOutbound && (
                                            <span>
                                                {msg.status === 'sent' && '✓'}
                                                {msg.status === 'delivered' && '✓✓'}
                                                {msg.status === 'read' && <span className="text-blue-200">✓✓</span>}
                                                {msg.status === 'failed' && '⚠️'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {messages?.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground text-sm">
                            Esta conversación está vacía via API.
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
                <div className="flex gap-2 items-center">
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                        <Paperclip className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                    </Button>

                    <div className="flex-1 relative">
                        <Input
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe un mensaje..."
                            className="pr-10 rounded-full bg-muted/50 border-transparent focus:bg-background focus:border-input transition-all"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary"
                        >
                            <Smile className="h-5 w-5" />
                        </Button>
                    </div>

                    <Button
                        onClick={handleSend}
                        disabled={!inputText.trim() || sendMessage.isPending}
                        size="icon"
                        className="rounded-full h-11 w-11 shadow-md"
                    >
                        <Send className="h-5 w-5 -ml-0.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
