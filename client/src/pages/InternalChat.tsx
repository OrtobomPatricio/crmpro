import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function InternalChatPage() {
    const [message, setMessage] = useState("");
    const [selectedRecipient, setSelectedRecipient] = useState<number | null>(null);

    const { data: messages, isLoading } = trpc.internalChat.list.useQuery(undefined, {
        refetchInterval: 5000, // Poll every 5 seconds
    });

    const { data: team } = trpc.team.list.useQuery();
    const utils = trpc.useUtils();

    const sendMutation = trpc.internalChat.send.useMutation({
        onSuccess: () => {
            setMessage("");
            utils.internalChat.list.invalidate();
            toast.success("Mensaje enviado");
        },
        onError: (e: any) => {
            toast.error(`Error: ${e.message}`);
        },
    });

    const markReadMutation = trpc.internalChat.markRead.useMutation({
        onSuccess: () => {
            utils.internalChat.list.invalidate();
        },
    });

    const handleSend = () => {
        if (!message.trim()) return;
        sendMutation.mutate({
            content: message,
            recipientId: selectedRecipient || undefined,
        });
    };

    useEffect(() => {
        // Mark all messages as read when opening the page
        if (messages && messages.length > 0) {
            const unreadIds = messages
                .filter((m: any) => !m.isRead && m.recipientId)
                .map((m: any) => m.id);

            if (unreadIds.length > 0) {
                markReadMutation.mutate({ messageIds: unreadIds });
            }
        }
    }, [messages]);

    return (
        <div className="container mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <MessageCircle className="w-8 h-8" />
                    Chat Interno del Equipo
                </h1>
                <p className="text-muted-foreground mt-1">
                    Comunicate con tu equipo en tiempo real
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Usuarios del equipo */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Equipo</CardTitle>
                        <CardDescription>Selecciona un usuario o envía a todos</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <Button
                                variant={selectedRecipient === null ? "default" : "outline"}
                                className="w-full justify-start"
                                onClick={() => setSelectedRecipient(null)}
                            >
                                💬 Canal General (Todos)
                            </Button>
                            {team?.map((user: any) => (
                                <Button
                                    key={user.id}
                                    variant={selectedRecipient === user.id ? "default" : "outline"}
                                    className="w-full justify-start"
                                    onClick={() => setSelectedRecipient(user.id)}
                                >
                                    {user.name || user.email}
                                    <Badge variant="secondary" className="ml-auto">
                                        {user.role}
                                    </Badge>
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Mensajes */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>
                            {selectedRecipient
                                ? `Conversación con ${team?.find((u: any) => u.id === selectedRecipient)?.name || "Usuario"}`
                                : "Canal General"
                            }
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col" style={{ height: "500px" }}>
                        <ScrollArea className="flex-1 pr-4">
                            {isLoading ? (
                                <div className="text-center text-muted-foreground py-8">
                                    Cargando mensajes...
                                </div>
                            ) : !messages || messages.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">
                                    No hay mensajes. ¡Sé el primero en escribir!
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {messages
                                        .filter((m: any) => {
                                            if (selectedRecipient === null) {
                                                return m.recipientId === null; // General channel
                                            }
                                            return m.recipientId === selectedRecipient || m.senderId === selectedRecipient;
                                        })
                                        .map((msg: any) => (
                                            <div
                                                key={msg.id}
                                                className={`flex flex-col gap-1 p-3 rounded-lg ${msg.senderId === msg.currentUserId
                                                        ? "bg-primary/10 ml-auto max-w-[70%]"
                                                        : "bg-muted max-w-[70%]"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm">
                                                        {msg.senderName || "Usuario"}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(msg.createdAt).toLocaleTimeString("es-ES", {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </span>
                                                </div>
                                                <p className="text-sm">{msg.content}</p>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </ScrollArea>

                        <div className="mt-4 flex gap-2">
                            <Input
                                placeholder={
                                    selectedRecipient
                                        ? "Escribe un mensaje privado..."
                                        : "Escribe un mensaje al canal general..."
                                }
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                            />
                            <Button onClick={handleSend} disabled={sendMutation.isPending || !message.trim()}>
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
