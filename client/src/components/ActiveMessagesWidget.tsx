import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { MessageCircle, Clock, AlertTriangle } from "lucide-react";

export function ActiveMessagesWidget() {
    const { data: stats, isLoading } = trpc.messages.getActiveStats.useQuery();

    if (isLoading) {
        return (
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        Mensajes Activos
                    </CardTitle>
                    <CardDescription>Conversaciones en las últimas 24h</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                    <div className="space-y-4 animate-pulse">
                        <div className="h-16 bg-muted/30 rounded" />
                        <div className="h-16 bg-muted/30 rounded" />
                        <div className="h-16 bg-muted/30 rounded" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!stats) {
        return (
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        Mensajes Activos
                    </CardTitle>
                    <CardDescription>Conversaciones en las últimas 24h</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No hay datos disponibles
                    </p>
                </CardContent>
            </Card>
        );
    }

    const { activeConversations, unansweredMessages, avgResponseTime } = stats;

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Mensajes Activos
                </CardTitle>
                <CardDescription>Conversaciones en las últimas 24h</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                <div className="space-y-4">
                    {/* Active Conversations */}
                    <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Conversaciones Vigentes</p>
                                <p className="text-xs text-muted-foreground">&lt; 24h desde último contacto</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeConversations}</p>
                        </div>
                    </div>

                    {/* Unanswered Messages */}
                    <div className={`flex items-center justify-between p-3 border rounded-lg ${unansweredMessages > 0
                            ? 'bg-orange-500/10 border-orange-500/20'
                            : 'bg-muted/30 border-muted'
                        }`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${unansweredMessages > 0
                                    ? 'bg-orange-500/20'
                                    : 'bg-muted'
                                }`}>
                                <AlertTriangle className={`h-5 w-5 ${unansweredMessages > 0
                                        ? 'text-orange-600 dark:text-orange-400'
                                        : 'text-muted-foreground'
                                    }`} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Sin Responder</p>
                                <p className="text-xs text-muted-foreground">Requieren atención</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className={`text-2xl font-bold ${unansweredMessages > 0
                                    ? 'text-orange-600 dark:text-orange-400'
                                    : 'text-muted-foreground'
                                }`}>
                                {unansweredMessages}
                            </p>
                        </div>
                    </div>

                    {/* Average Response Time */}
                    <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Tiempo Promedio</p>
                                <p className="text-xs text-muted-foreground">Lapso de respuesta</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {avgResponseTime > 0 ? `${avgResponseTime} min` : 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
