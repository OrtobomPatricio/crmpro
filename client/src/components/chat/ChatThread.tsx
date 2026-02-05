import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import { Image as ImageIcon, Paperclip, Send, Smile, Info, X, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import EmojiPicker, { Theme as EmojiTheme } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import axios from "axios";
import { ChatQuickReplies } from "./ChatQuickReplies";

interface ChatThreadProps {
    conversationId: number;
}

export function ChatThread({ conversationId }: ChatThreadProps) {
    const [inputText, setInputText] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

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
            setTimeout(() => {
                scrollRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        }
    };

    const handleSendText = () => {
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
            handleSendText();
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setIsUploading(true);

            // Upload each file
            for (const file of files) {
                const formData = new FormData();
                formData.append('files', file);

                try {
                    // Upload to server
                    const res = await axios.post('/api/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        withCredentials: true
                    });

                    // Server returns Array<{ filename, originalname, mimetype, url, size }>
                    const uploadedFiles = res.data.files || [];
                    if (uploadedFiles.length === 0) throw new Error("No files uploaded");

                    const uploaded = uploadedFiles[0];

                    // Determine type
                    let msgType: 'image' | 'video' | 'audio' | 'document' = 'document';
                    if (file.type.startsWith('image/')) msgType = 'image';
                    else if (file.type.startsWith('video/')) msgType = 'video';
                    else if (file.type.startsWith('audio/')) msgType = 'audio';

                    // Send Message
                    sendMessage.mutate({
                        conversationId,
                        messageType: msgType,
                        mediaUrl: uploaded.url || `/api/uploads/${uploaded.filename}`, // Fallback if url property missing
                        mediaName: uploaded.originalname,
                        mediaMimeType: uploaded.mimetype,
                        content: "" // Optional caption
                    });

                } catch (err: any) {
                    console.error("Upload failed", err);
                    toast.error(`Error subiendo archivo ${file.name}: ${err.message || 'Error desconocido'}`);
                }
            }
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = ""; // Reset
        }
    };

    const openFileSelector = () => {
        fileInputRef.current?.click();
    };

    const handleTemplateSelect = (content: string, attachments?: { url: string; name: string; type: string }[]) => {
        if (content) {
            setInputText(prev => prev + content);
            setTimeout(() => inputRef.current?.focus(), 10);
        }

        if (attachments && attachments.length > 0) {
            attachments.forEach(att => {
                let msgType: 'image' | 'video' | 'audio' | 'document' = 'document';
                if (att.type.startsWith('image/')) msgType = 'image';
                else if (att.type.startsWith('video/')) msgType = 'video';
                else if (att.type.startsWith('audio/')) msgType = 'audio';

                sendMessage.mutate({
                    conversationId,
                    messageType: msgType,
                    mediaUrl: att.url,
                    mediaName: att.name,
                    mediaMimeType: att.type,
                    content: "" // No caption for now to avoid duplication
                });
            });
        }
    };


    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col p-6 gap-4 bg-muted/5">
                {[1, 2, 3].map((i) => (
                    <div key={i} className={cn("flex gap-3 max-w-[80%]", i % 2 === 0 ? "ml-auto flex-row-reverse" : "")}>
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className={cn("h-16 rounded-2xl w-full", i % 2 === 0 ? "rounded-br-none" : "rounded-bl-none")} />
                    </div>
                ))}
            </div>
        );
    }

    // Group messages by date
    const groupedMessages: { date: Date; msgs: typeof messages }[] = [];
    messages?.forEach((msg) => {
        const msgDate = new Date(msg.createdAt);
        const lastGroup = groupedMessages[groupedMessages.length - 1];

        if (lastGroup && isSameDay(lastGroup.date, msgDate)) {
            lastGroup.msgs?.push(msg);
        } else {
            groupedMessages.push({ date: msgDate, msgs: [msg] });
        }
    });

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-zinc-900/30">
            {/* Messages Area */}
            <ScrollArea className="flex-1 h-full min-h-0">
                <div className="px-4 py-2 flex flex-col gap-6 min-h-0 pb-4">
                    {messages?.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-20 text-muted-foreground"
                        >
                            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-4">
                                <Info className="h-10 w-10 text-primary/40" />
                            </div>
                            <p className="text-sm font-medium">Comienza la conversación</p>
                            <p className="text-xs opacity-70 mt-1">Envía un mensaje para iniciar el chat</p>
                        </motion.div>
                    )}

                    {groupedMessages.map((group, groupIndex) => (
                        <div key={groupIndex} className="flex flex-col gap-4">
                            {/* Date Divider */}
                            <div className="flex items-center justify-center">
                                <span className="bg-muted/50 text-muted-foreground text-[10px] px-2 py-1 rounded-full border shadow-sm">
                                    {isToday(group.date)
                                        ? "Hoy"
                                        : isYesterday(group.date)
                                            ? "Ayer"
                                            : format(group.date, "d 'de' MMMM", { locale: es })}
                                </span>
                            </div>

                            {/* Messages in this group */}
                            <div className="flex flex-col gap-2">
                                <AnimatePresence initial={false}>
                                    {group.msgs?.map((msg, index) => {
                                        const isOutbound = msg.direction === 'outbound';
                                        const isLast = index === (group.msgs?.length || 0) - 1;

                                        return (
                                            <motion.div
                                                key={msg.id}
                                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                transition={{ duration: 0.2 }}
                                                ref={isLast && groupIndex === groupedMessages.length - 1 ? scrollRef : null}
                                                className={cn(
                                                    "flex items-end gap-2 max-w-[85%] relative group",
                                                    isOutbound ? "ml-auto flex-row-reverse" : ""
                                                )}
                                            >
                                                {!isOutbound && (
                                                    <Avatar className="h-6 w-6 border shadow-sm mt-0.5">
                                                        <AvatarFallback className="text-[9px] bg-background text-foreground font-bold">
                                                            L
                                                        </AvatarFallback>
                                                    </Avatar>
                                                )}

                                                <div
                                                    className={cn(
                                                        "rounded-2xl px-4 py-2 shadow-sm text-sm whitespace-pre-wrap break-words transition-all duration-200",
                                                        isOutbound
                                                            ? "bg-primary text-primary-foreground rounded-br-sm shadow-primary/10"
                                                            : "bg-white dark:bg-zinc-800 border border-border/50 rounded-bl-sm shadow-sm"
                                                    )}
                                                >
                                                    {msg.messageType === 'text' && <p className="leading-relaxed">{msg.content}</p>}

                                                    {msg.messageType === 'image' && msg.mediaUrl && (
                                                        <div className="rounded-lg overflow-hidden my-1 border border-black/5 dark:border-white/10 group-hover:shadow-md transition-shadow">
                                                            <img
                                                                src={msg.mediaUrl}
                                                                alt="Shared image"
                                                                className="max-w-full sm:max-w-[280px] max-h-[200px] object-cover cursor-zoom-in"
                                                                loading="lazy"
                                                            />
                                                            {msg.content && <p className="mt-2 text-xs opacity-90 px-1">{msg.content}</p>}
                                                        </div>
                                                    )}

                                                    {msg.messageType === 'document' && (
                                                        <a
                                                            href={msg.mediaUrl || "#"}
                                                            target="_blank"
                                                            className="flex items-center gap-3 bg-black/5 dark:bg-white/10 rounded-lg p-2 hover:bg-black/10 transition-colors"
                                                        >
                                                            <div className="p-1.5 bg-background rounded-md shadow-sm">
                                                                <Paperclip className={cn("h-4 w-4", isOutbound ? "text-primary" : "text-foreground")} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-medium underline">Ver Documento</span>
                                                                <span className="text-[10px] opacity-70">Clic para abrir</span>
                                                            </div>
                                                        </a>
                                                    )}

                                                    <div className={cn(
                                                        "text-[10px] mt-1 text-right gap-1 flex items-center justify-end select-none",
                                                        isOutbound ? "text-primary-foreground/70" : "text-muted-foreground/70"
                                                    )}>
                                                        {format(new Date(msg.createdAt), 'HH:mm')}
                                                        {isOutbound && (
                                                            <span className="ml-0.5">
                                                                {msg.status === 'sent' && '✓'}
                                                                {msg.status === 'delivered' && '✓✓'}
                                                                {msg.status === 'read' && <span className="text-blue-200 font-bold">✓✓</span>}
                                                                {msg.status === 'failed' && <span className="text-red-300">⚠️</span>}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* Premium Input Area */}
            <div className="p-4 bg-background/80 backdrop-blur-md border-t border-border/40">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    onChange={handleFileSelect}
                />

                <div className="flex gap-2 items-end max-w-4xl mx-auto">
                    <div className="flex gap-1 shrink-0 pb-1">
                        <Button variant="ghost" size="icon" onClick={openFileSelector} disabled={isUploading} className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors">
                            <Paperclip className="h-5 w-5" />
                        </Button>
                        <ChatQuickReplies onSelect={handleTemplateSelect} />
                    </div>

                    <div className="flex-1 relative bg-muted/40 hover:bg-muted/60 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20 transition-all rounded-[24px] border border-transparent focus-within:border-primary/30">
                        <Input
                            ref={inputRef}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe un mensaje..."
                            className="pr-10 py-6 bg-transparent border-none shadow-none focus-visible:ring-0 text-[15px] resize-none overflow-hidden"
                            autoComplete="off"
                        />

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary transition-colors rounded-full"
                                >
                                    <Smile className="h-5 w-5" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent side="top" align="end" className="p-0 border-none shadow-none bg-transparent w-auto">
                                <EmojiPicker
                                    onEmojiClick={(emoji) => {
                                        setInputText(prev => prev + emoji.emoji);
                                        // Keep focus on input for better typing flow
                                        setTimeout(() => inputRef.current?.focus(), 10);
                                    }}
                                    theme={EmojiTheme.AUTO}
                                    lazyLoadEmojis
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <Button
                        onClick={handleSendText}
                        disabled={(!inputText.trim() && !isUploading) || sendMessage.isPending}
                        size="icon"
                        className={cn(
                            "rounded-full h-11 w-11 shadow-lg transition-all duration-300 pb-1",
                            (inputText.trim() || isUploading) ? "scale-100 opacity-100" : "scale-90 opacity-80 grayscale"
                        )}
                    >
                        {isUploading || sendMessage.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 -ml-0.5" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}
