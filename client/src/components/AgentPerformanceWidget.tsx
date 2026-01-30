import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Users, Send } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function AgentPerformanceWidget() {
    const { data, isLoading } = trpc.messages.getAgentPerformance.useQuery();

    if (isLoading) {
        return (
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Desempeño de Agentes
                    </CardTitle>
                    <CardDescription>Mensajes procesados por agente</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                    <div className="space-y-3 animate-pulse">
                        <div className="h-12 bg-muted/30 rounded" />
                        <div className="h-12 bg-muted/30 rounded" />
                        <div className="h-12 bg-muted/30 rounded" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!data || data.total === 0) {
        return (
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Desempeño de Agentes
                    </CardTitle>
                    <CardDescription>Mensajes procesados por agente</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No hay datos disponibles
                    </p>
                </CardContent>
            </Card>
        );
    }

    const { total, agents } = data;

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Desempeño de Agentes
                </CardTitle>
                <CardDescription>Mensajes procesados (últimos 30 días)</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
                {/* Total Messages */}
                <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <Send className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-muted-foreground">Total Procesados</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">{total.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">Mensajes enviados por el equipo</p>
                </div>

                {/* Agent List */}
                {agents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No hay agentes con mensajes enviados
                    </p>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Por Agente
                        </p>
                        {agents.map((agent, index) => (
                            <div
                                key={agent.userId}
                                className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${index === 0
                                                ? 'bg-yellow-500 text-white'
                                                : index === 1
                                                    ? 'bg-gray-400 text-white'
                                                    : index === 2
                                                        ? 'bg-orange-600 text-white'
                                                        : 'bg-muted text-muted-foreground'
                                            }`}>
                                            {index + 1}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">{agent.userName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {agent.messageCount} mensaje{agent.messageCount !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-primary">{agent.percentage}%</p>
                                    </div>
                                </div>
                                <Progress value={agent.percentage} className="h-2" />
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
