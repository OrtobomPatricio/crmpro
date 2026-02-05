import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, Users, ChevronLeft, UserCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { useAuth } from "@/_core/hooks/useAuth";

export function TeamChatWidget({ helpCenterOpen }: { helpCenterOpen?: boolean }) {

    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();

    // View state: 'list' (user list) or 'chat' (active conversation)
    const [view, setView] = useState<'list' | 'chat'>('list');
    const [activeRecipient, setActiveRecipient] = useState<{ id: number; name: string } | null>(null);

    const { data: users } = trpc.internalChat.getRecentChats.useQuery(undefined, {
        refetchInterval: 10000,
    });

    const totalUnread = users?.reduce((acc, user) => acc + user.unreadCount, 0) || 0;

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="default"
                    size="icon"
                    className={`fixed bottom-6 h-14 w-14 rounded-full shadow-2xl z-[100] bg-indigo-600 hover:bg-indigo-700 transition-all duration-300 hover:scale-105 ${isOpen ? 'hidden' : ''} ${helpCenterOpen ? 'right-[440px] sm:right-[580px]' : 'right-24'}`}
                >
                    <MessageSquare className="h-7 w-7 text-white" />
                    {totalUnread > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white border-2 border-background animate-in zoom-in">
                            {totalUnread > 9 ? '9+' : totalUnread}
                        </span>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[400px] sm:w-[540px] p-0 flex flex-col">
                {view === 'list' ? (
                    <ChatUserList
                        onSelect={(recipient) => {
                            setActiveRecipient(recipient);
                            setView('chat');
                        }}
                    />
                ) : (
                    <ChatWindow
                        recipient={activeRecipient}
                        onBack={() => {
                            setActiveRecipient(null);
                            setView('list');
                        }}
                        currentUser={user}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}

function ChatUserList({ onSelect }: { onSelect: (u: { id: number; name: string } | null) => void }) {
    const { data: users, isLoading } = trpc.internalChat.getRecentChats.useQuery();

    return (
        <div className="flex flex-col h-full">
            <SheetHeader className="p-4 border-b">
                <SheetTitle>Chat de Equipo</SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                    {/* General Channel */}
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-4 h-14"
                        onClick={() => onSelect(null)}
                    >
                        <div className="bg-indigo-100 p-2 rounded-full">
                            <Users className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="text-left">
                            <p className="font-semibold">General</p>
                            <p className="text-xs text-muted-foreground">Canal de anuncios</p>
                        </div>
                    </Button>

                    <div className="px-2 py-1 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Direct Messages
                    </div>

                    {isLoading && <p className="text-sm text-center p-4">Cargando...</p>}

                    {users?.map((u) => (
                        <Button
                            key={u.id}
                            variant="ghost"
                            className="w-full justify-start gap-3 h-14 relative"
                            onClick={() => onSelect({ id: u.id, name: u.name || 'Sin nombre' })}
                        >
                            <Avatar>
                                <AvatarFallback className="bg-slate-200">
                                    {(u.name || "?").substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="text-left">
                                <p className={`font-semibold ${u.unreadCount > 0 ? 'font-bold' : ''}`}>{u.name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
                            </div>
                            {u.unreadCount > 0 && (
                                <div className="absolute right-8 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
                                    {u.unreadCount}
                                </div>
                            )}
                            <div className={`ml-auto w-2 h-2 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                        </Button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}

import EmojiPicker, { EmojiStyle } from 'emoji-picker-react';
import { Paperclip, X, File as FileIcon, Image as ImageIcon, Video, Smile, Loader2 } from "lucide-react";

function ChatWindow({ recipient, onBack, currentUser }: { recipient: { id: number; name: string } | null, onBack: () => void, currentUser: any }) {
    const [message, setMessage] = useState("");
    const [showEmoji, setShowEmoji] = useState(false);
    const [attachments, setAttachments] = useState<{ type: 'image' | 'video' | 'file'; url: string; name: string }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const utils = trpc.useContext();
    const markAsRead = trpc.internalChat.markAsRead.useMutation({
        onSuccess: () => {
            utils.internalChat.getRecentChats.invalidate();
        }
    });

    // Use polling for real-time like effect
    const { data: messages, isLoading } = trpc.internalChat.getHistory.useQuery(
        { recipientId: recipient?.id },
        {
            refetchInterval: 3000,
        }
    );

    const sendMessage = trpc.internalChat.send.useMutation({
        onSuccess: () => {
            setMessage("");
            setAttachments([]);
            setShowEmoji(false);
            utils.internalChat.getHistory.invalidate({ recipientId: recipient?.id });
            scrollToBottom();
        }
    });

    const scrollToBottom = () => {
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollIntoView({ behavior: "smooth" });
            }
        }, 100);
    };

    useEffect(() => {
        if (messages) {
            scrollToBottom();
            if (recipient) {
                markAsRead.mutate({ senderId: recipient.id });
            }
        }
    }, [messages, recipient?.id]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if ((!message.trim() && attachments.length === 0) || isUploading) return;
        sendMessage.mutate({
            content: message || (attachments.length > 0 ? "Adjunto enviado" : "."), // Fallback content if only attachment
            recipientId: recipient?.id,
            attachments: attachments.length > 0 ? attachments : undefined
        });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setIsUploading(true);

        const formData = new FormData();
        Array.from(e.target.files).forEach(file => {
            formData.append('files', file);
        });

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.files) {
                setAttachments(prev => [...prev, ...data.files]);
            }
        } catch (error) {
            console.error("Upload failed", error);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b bg-white flex items-center gap-3 shadow-sm z-10 shrink-0">
                <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2">
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                {recipient ? (
                    <Avatar className="h-8 w-8">
                        <AvatarFallback>{recipient.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                ) : (
                    <div className="bg-indigo-100 p-1.5 rounded-full">
                        <Users className="h-5 w-5 text-indigo-600" />
                    </div>
                )}
                <div>
                    <h3 className="font-semibold text-sm">{recipient ? recipient.name : "General"}</h3>
                    <p className="text-xs text-green-600 flex items-center gap-1">
                        <span className="block w-1.5 h-1.5 rounded-full bg-green-500" />
                        En línea
                    </p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto min-h-0 bg-slate-50/50">
                <div className="space-y-4 pb-2">
                    {messages?.map((msg) => {
                        const isMe = msg.senderId === currentUser?.id;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                {!isMe && (
                                    <div className="mr-2 mt-1">
                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                                            {(msg.senderName || "?").charAt(0).toUpperCase()}
                                        </div>
                                    </div>
                                )}
                                <div
                                    className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${isMe
                                        ? 'bg-indigo-600 text-white rounded-br-none'
                                        : 'bg-white text-slate-800 border rounded-bl-none'
                                        }`}
                                >
                                    {!isMe && recipient === null && (
                                        <p className="text-[10px] font-bold mb-1 opacity-70">{msg.senderName}</p>
                                    )}

                                    {/* Render Attachments */}
                                    {msg.attachments && (msg.attachments as any[]).length > 0 && (
                                        <div className="mb-2 space-y-2">
                                            {(msg.attachments as any[]).map((att, i) => (
                                                <div key={i} className="rounded overflow-hidden">
                                                    {att.type === 'image' ? (
                                                        <img src={att.url} alt={att.name} className="max-w-full rounded-lg max-h-[200px] object-cover" />
                                                    ) : att.type === 'video' ? (
                                                        <video src={att.url} controls className="max-w-full rounded-lg max-h-[200px]" />
                                                    ) : (
                                                        <a href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-black/10 p-2 rounded hover:bg-black/20 transition-colors">
                                                            <FileIcon className="h-4 w-4" />
                                                            <span className="underline truncate max-w-[150px]">{att.name}</span>
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                    <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                                        {format(new Date(msg.createdAt), "HH:mm")}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={scrollRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t relative shrink-0">
                {showEmoji && (
                    <div className="absolute bottom-full left-4 mb-2 shadow-xl rounded-lg z-50">
                        <EmojiPicker
                            onEmojiClick={(emoji) => setMessage(prev => prev + emoji.emoji)}
                            width={300}
                            height={400}
                            emojiStyle={EmojiStyle.NATIVE}
                        />
                    </div>
                )}

                {/* Attachments Preview */}
                {attachments.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
                        {attachments.map((att, i) => (
                            <div key={i} className="relative shrink-0 group">
                                <div className="h-16 w-16 rounded border bg-slate-100 flex items-center justify-center overflow-hidden">
                                    {att.type === 'image' ? (
                                        <img src={att.url} className="h-full w-full object-cover" />
                                    ) : (
                                        <FileIcon className="h-6 w-6 text-slate-400" />
                                    )}
                                </div>
                                <button
                                    onClick={() => removeAttachment(i)}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSend} className="flex gap-2 items-end">
                    <div className="flex gap-1 pb-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                            onClick={() => setShowEmoji(!showEmoji)}
                        >
                            <Smile className="h-5 w-5" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            <Paperclip className="h-5 w-5" />
                        </Button>
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                        />
                    </div>

                    <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={isUploading ? "Subiendo..." : `Mensaje a ${recipient ? recipient.name : "General"}...`}
                        className="flex-1 rounded-2xl bg-slate-100 border-none focus-visible:ring-1 min-h-[40px] max-h-[100px]"
                        autoFocus
                    />

                    <Button
                        type="submit"
                        size="icon"
                        className="rounded-full bg-indigo-600 hover:bg-indigo-700 w-10 h-10 shrink-0 mb-0.5"
                        disabled={(!message.trim() && attachments.length === 0) || isUploading || sendMessage.isPending}
                    >
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </form>
            </div>
        </div>
    );
}
