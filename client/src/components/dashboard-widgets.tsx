import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Trophy, Calendar, Activity, Users } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function PipelineFunnelWidget() {
    const { data: funnel } = trpc.dashboard.getPipelineFunnel.useQuery();

    if (!funnel || funnel.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Embudo de Ventas
                    </CardTitle>
                    <CardDescription>Distribución de leads por etapa</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No hay datos disponibles
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Embudo de Ventas
                </CardTitle>
                <CardDescription>Distribución de leads por etapa</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnel}>
                        <XAxis dataKey="stage" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                            {funnel.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

export function AgentLeaderboardWidget() {
    const { data: leaderboard } = trpc.dashboard.getLeaderboard.useQuery();

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Top Agentes
                </CardTitle>
                <CardDescription>Mejores vendedores del mes</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
                {!leaderboard || leaderboard.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No hay datos disponibles
                    </p>
                ) : (
                    <div className="space-y-3">
                        {leaderboard.map((agent) => (
                            <div
                                key={agent.rank}
                                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${agent.rank === 1
                                            ? "bg-yellow-500 text-white"
                                            : agent.rank === 2
                                                ? "bg-gray-400 text-white"
                                                : agent.rank === 3
                                                    ? "bg-orange-600 text-white"
                                                    : "bg-muted text-muted-foreground"
                                            }`}
                                    >
                                        {agent.rank}
                                    </div>
                                    <div>
                                        <p className="font-semibold">{agent.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {agent.dealsWon} {agent.dealsWon === 1 ? "venta" : "ventas"}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-green-600">
                                        ₲{agent.commission.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Comisión</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function UpcomingAppointmentsWidget() {
    const { data: appointments } = trpc.dashboard.getUpcomingAppointments.useQuery();

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Próximas Citas
                </CardTitle>
                <CardDescription>Agenda de los próximos 5 días</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
                {!appointments || appointments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No hay citas programadas
                    </p>
                ) : (
                    <div className="space-y-3">
                        {appointments.map((apt) => (
                            <div
                                key={apt.id}
                                className="border-l-4 border-indigo-500 pl-3 py-2 bg-muted/20 hover:bg-muted/40 transition-colors rounded-r"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-semibold">
                                            {apt.firstName} {apt.lastName}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{apt.phone}</p>
                                        {apt.reasonName && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {apt.reasonName}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right text-xs">
                                        <p className="font-medium">
                                            {format(new Date(apt.appointmentDate), "d MMM", { locale: es })}
                                        </p>
                                        <p className="text-muted-foreground">{apt.appointmentTime}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function RecentActivityWidget() {
    const { data: activities } = trpc.dashboard.getRecentActivity.useQuery();

    const getActionLabel = (action: string) => {
        const labels: Record<string, string> = {
            lead_created: "Creó lead",
            lead_updated: "Actualizó lead",
            appointment_created: "Creó cita",
            campaign_started: "Inició campaña",
            user_login: "Inició sesión",
        };
        return labels[action] || action;
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Actividad Reciente
                </CardTitle>
                <CardDescription>Últimas acciones en el sistema</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
                {!activities || activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        No hay actividad reciente
                    </p>
                ) : (
                    <div className="space-y-3">
                        {activities.map((activity) => (
                            <div
                                key={activity.id}
                                className="flex items-start gap-3 p-2 hover:bg-muted/30 rounded transition-colors"
                            >
                                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm">
                                        <span className="font-semibold">{activity.userName || "Sistema"}</span>{" "}
                                        {getActionLabel(activity.action)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {format(new Date(activity.createdAt), "d MMM, HH:mm", { locale: es })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function WarmupWidget() {
    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Sistema Warm-up
                </CardTitle>
                <CardDescription>Estado de calentamiento de números</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span>En calentamiento</span>
                            <span className="font-bold">3 números</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 w-[60%]" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span>En enfriamiento</span>
                            <span className="font-bold">1 número</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-[20%]" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span>Listos</span>
                            <span className="font-bold">5 números</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 w-[100%]" />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function StatusWidget() {
    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Estado de Números
                </CardTitle>
                <CardDescription>Monitoreo de conexiones WhatsApp</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 border rounded bg-card">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="font-medium text-sm">+595 981 123 456</span>
                        </div>
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full dark:bg-green-900/30 dark:text-green-400">
                            Conectado
                        </span>
                    </div>
                    <div className="flex items-center justify-between p-2 border rounded bg-card">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="font-medium text-sm">+595 971 654 321</span>
                        </div>
                        <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full dark:bg-red-900/30 dark:text-red-400">
                            Desconectado
                        </span>
                    </div>
                    <div className="flex items-center justify-between p-2 border rounded bg-card">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            <span className="font-medium text-sm">+595 991 111 222</span>
                        </div>
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full dark:bg-yellow-900/30 dark:text-yellow-400">
                            Sincronizando
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function RecentLeadsWidget() {
    // Mock data for now, would ideally be a trpc query
    const leads = [
        { id: 1, name: "Maria Gonzalez", source: "Facebook Ads", status: "Nuevo" },
        { id: 2, name: "Juan Perez", source: "Instagram", status: "Contactado" },
        { id: 3, name: "Ana Silva", source: "WhatsApp", status: "En Proceso" },
        { id: 4, name: "Carlos Ruiz", source: "Web", status: "Cerrado" },
    ];

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Leads Recientes
                </CardTitle>
                <CardDescription>Últimos prospectos ingresados</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                <div className="space-y-3">
                    {leads.map(lead => (
                        <div key={lead.id} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0">
                            <div>
                                <p className="font-medium text-sm">{lead.name}</p>
                                <p className="text-xs text-muted-foreground">{lead.source}</p>
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 rounded bg-secondary">
                                {lead.status}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
