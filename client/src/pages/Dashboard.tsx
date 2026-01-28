import { useAuth } from "@/_core/hooks/useAuth";
// import DashboardLayout from "@/components/DashboardLayout"; // REMOVED
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
    PipelineFunnelWidget,
    AgentLeaderboardWidget,
    UpcomingAppointmentsWidget,
    RecentActivityWidget
} from "@/components/dashboard-widgets";
import {
    Users,
    MessageCircle,
    Phone,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Zap,
    Send,
    MessageSquare,
    UserCheck,
    Shield,
    LayoutGrid,
    DollarSign,
    Target,
    Trophy,
    Flame,
    BarChart3,
    Calendar,
    Activity,
    FileText,
    ArrowUpRight,
    X,
    Settings,
    Database,
    Workflow,
    Heart,
} from "lucide-react";

interface WidgetDefinition {
    key: string;
    label: string;
    category: 'Stats' | 'Analytics' | 'Operacional' | 'Navegación';
}

const WIDGET_DEFINITIONS: WidgetDefinition[] = [
    { key: 'stat-leads', label: 'Total Leads', category: 'Stats' },
    { key: 'stat-whatsapp', label: 'Números WhatsApp', category: 'Stats' },
    { key: 'stat-messages', label: 'Mensajes Hoy', category: 'Stats' },
    { key: 'stat-conversion', label: 'Tasa Conversión', category: 'Stats' },
    { key: 'warmup', label: 'Sistema Warm-up', category: 'Operacional' },
    { key: 'status', label: 'Estado de Números', category: 'Operacional' },
    { key: 'pipeline-funnel', label: 'Embudo de Ventas', category: 'Analytics' },
    { key: 'agent-leaderboard', label: 'Top Agentes', category: 'Analytics' },
    { key: 'upcoming-appointments', label: 'Próximas Citas', category: 'Analytics' },
    { key: 'recent-activity', label: 'Actividad Reciente', category: 'Analytics' },
    { key: 'quick-actions', label: 'Acciones Rápidas', category: 'Navegación' },
    { key: 'recent-leads', label: 'Leads Recientes', category: 'Navegación' },
];

const CATEGORIES = ['Stats', 'Analytics', 'Operacional', 'Navegación'] as const;

export default function Dashboard() {
    return <DashboardContent />;
}

function DashboardContent() {
    const { user } = useAuth();
    const { data: stats } = trpc.dashboard.getStats.useQuery();
    const { data: settings } = trpc.settings.get.useQuery();
    const updateConfig = trpc.settings.updateDashboardConfig.useMutation({
        onSuccess: () => {
            toast.success("Configuración guardada");
        }
    });
    const [, setLocation] = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Widget visibility state
    const [widgetConfig, setWidgetConfig] = useState<Record<string, boolean>>({
        'stat-leads': true,
        'stat-whatsapp': true,
        'stat-messages': true,
        'stat-conversion': true,
        'warmup': false,
        'status': false,
        'pipeline-funnel': false,
        'agent-leaderboard': false,
        'upcoming-appointments': false,
        'recent-activity': false,
        'quick-actions': true,
        'recent-leads': true,
        // Quick Actions Defaults
        'kanban': true,
        'monitoring': true,
        'analytics': true,
        'reports': true,
        'automations': true,
        'integrations': true,
        'backups': true,
        'settings': true,
        'leads': true,
        'campaigns': true,
        'conversations': true,
        'scheduling': true,
        // Added to match Settings
        'attendants': true,
        'health': true,
        'whatsapp': true,
        'commissions': true,
        'goals': true,
        'achievements': true,
        'warmup': true,
    });

    // Load config from backend
    useEffect(() => {
        if (settings?.dashboardConfig) {
            const config = settings.dashboardConfig as unknown as Record<string, boolean>;
            setWidgetConfig(prev => ({ ...prev, ...config }));
        }
    }, [settings?.dashboardConfig]);

    const handleToggleWidget = (key: string, value: boolean) => {
        const newConfig = { ...widgetConfig, [key]: value };
        setWidgetConfig(newConfig);
        updateConfig.mutate(newConfig);
    };

    const quickActions = [
        {
            key: "leads",
            icon: Users,
            label: "Gestionar Leads",
            description: "Importa, organiza y segmenta tus prospectos",
            iconColor: "icon-container-blue",
            hoverColor: "hover:border-blue-500/50",
            path: "/leads",
        },
        {
            key: "kanban",
            icon: LayoutGrid,
            label: "Kanban Board",
            description: "Visualiza tu pipeline de ventas",
            iconColor: "icon-container-orange",
            hoverColor: "hover:border-orange-500/50",
            path: "/kanban",
        },
        {
            key: "campaigns",
            icon: Send,
            label: "Crear Campaña",
            description: "Lanza campañas de WhatsApp masivas",
            iconColor: "icon-container-purple",
            hoverColor: "hover:border-purple-500/50",
            path: "/campaigns",
        },
        {
            key: "conversations",
            icon: MessageSquare,
            label: "Conversaciones",
            description: "Gestiona chats con tus leads",
            iconColor: "icon-container-green",
            hoverColor: "hover:border-green-500/50",
            path: "/chat",
        },
        {
            key: "scheduling",
            icon: Calendar,
            label: "Agendamiento",
            description: "Gestiona citas y reuniones",
            iconColor: "icon-container-blue",
            hoverColor: "hover:border-blue-500/50",
            path: "/scheduling",
        },
        {
            key: "monitoring",
            icon: Activity,
            label: "Monitoreo en Vivo",
            description: "Estado de cuentas y actividad",
            iconColor: "icon-container-red",
            hoverColor: "hover:border-red-500/50",
            path: "/monitoring",
        },
        {
            key: "analytics",
            icon: BarChart3,
            label: "Analytics",
            description: "Métricas y rendimiento",
            iconColor: "icon-container-indigo",
            hoverColor: "hover:border-indigo-500/50",
            path: "/analytics",
        },
        {
            key: "reports",
            icon: FileText,
            label: "Reportes",
            description: "Informes detallados exportables",
            iconColor: "icon-container-gray",
            hoverColor: "hover:border-gray-500/50",
            path: "/reports",
        },
        {
            key: "automations",
            icon: Zap,
            label: "Automatizaciones",
            description: "Flujos de trabajo automáticos",
            iconColor: "icon-container-yellow",
            hoverColor: "hover:border-yellow-500/50",
            path: "/automations",
        },
        {
            key: "integrations",
            icon: Workflow,
            label: "Integraciones",
            description: "Conecta con herramientas externas",
            iconColor: "icon-container-pink",
            hoverColor: "hover:border-pink-500/50",
            path: "/integrations",
        },
        {
            key: "backups",
            icon: Database,
            label: "Backups",
            description: "Copias de seguridad del sistema",
            iconColor: "icon-container-cyan",
            hoverColor: "hover:border-cyan-500/50",
            path: "/backup",
        },
        {
            key: "attendants",
            icon: UserCheck,
            label: "Atendentes",
            description: "Gestión del equipo de soporte",
            iconColor: "icon-container-blue",
            hoverColor: "hover:border-blue-500/50",
            path: "/attendants",
        },
        {
            key: "health",
            icon: Heart,
            label: "Salud de Cuentas",
            description: "Estado de salud de tus conexiones",
            iconColor: "icon-container-red",
            hoverColor: "hover:border-red-500/50",
            path: "/health",
        },
        {
            key: "whatsapp",
            icon: Phone,
            label: "Cuentas WhatsApp",
            description: "Administrar números conectados",
            iconColor: "icon-container-green",
            hoverColor: "hover:border-green-500/50",
            path: "/whatsapp",
        },
        {
            key: "commissions",
            icon: DollarSign,
            label: "Comisiones",
            description: "Cálculo y reporte de comisiones",
            iconColor: "icon-container-yellow",
            hoverColor: "hover:border-yellow-500/50",
            path: "/commissions",
        },
        {
            key: "goals",
            icon: Target,
            label: "Metas de Vendas",
            description: "Objetivos y seguimiento",
            iconColor: "icon-container-orange",
            hoverColor: "hover:border-orange-500/50",
            path: "/goals",
        },
        {
            key: "achievements",
            icon: Trophy,
            label: "Logros",
            description: "Premios y reconocimientos",
            iconColor: "icon-container-purple",
            hoverColor: "hover:border-purple-500/50",
            path: "/achievements",
        },
        {
            key: "warmup",
            icon: Flame,
            label: "Warm-up",
            description: "Calentamiento de números",
            iconColor: "icon-container-orange",
            hoverColor: "hover:border-orange-500/50",
            path: "/warmup",
        },
        {
            key: "settings",
            icon: Settings,
            label: "Configuración",
            description: "Permisos, roles y ajustes",
            iconColor: "icon-container-slate",
            hoverColor: "hover:border-slate-500/50",
            path: "/settings",
        },
    ];

    const statCards = [
        {
            key: "stat-leads",
            title: "Total Leads",
            value: stats?.totalLeads ?? 0,
            description: "Leads en el sistema",
            icon: Users,
            iconColor: "icon-container-blue",
        },
        {
            key: "stat-whatsapp",
            title: "Números WhatsApp",
            value: stats?.activeNumbers ?? 0,
            description: "Activos",
            icon: Phone,
            iconColor: "icon-container-green",
        },
        {
            key: "stat-messages",
            title: "Mensajes Hoy",
            value: stats?.messagesToday ?? 0,
            description: "Mensajes",
            icon: MessageCircle,
            iconColor: "icon-container-purple",
        },
        {
            key: "stat-conversion",
            title: "Tasa de Conversión",
            value: `${stats?.conversionRate ?? 0}%`,
            description: "Leads",
            icon: TrendingUp,
            iconColor: "icon-container-orange",
        },
    ];

    return (
        <div className="space-y-6 relative">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Bienvenido, {user?.name?.split(' ')[0] ?? 'Usuario'}
                    </h1>
                    <p className="text-muted-foreground">
                        Aquí tienes el resumen de tu CRM.
                    </p>
                </div>
                <Button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                >
                    <LayoutGrid className="h-4 w-4" />
                    Personalizar Widgets
                </Button>
            </div>

            {/* Sidebar */}
            {sidebarOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-40"
                        onClick={() => setSidebarOpen(false)}
                    />
                    <div className="fixed right-0 top-0 h-full w-80 bg-background border-l z-50 shadow-2xl overflow-y-auto">
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold">Personalizar Dashboard</h2>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <p className="text-sm text-muted-foreground">
                                Selecciona los widgets que quieres ver en tu dashboard.
                            </p>

                            {CATEGORIES.map(category => (
                                <div key={category} className="space-y-3">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                        {category}
                                    </h3>
                                    <div className="space-y-2">
                                        {WIDGET_DEFINITIONS
                                            .filter(w => w.category === category)
                                            .map(widget => (
                                                <label
                                                    key={widget.key}
                                                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={widgetConfig[widget.key] !== false}
                                                        onChange={(e) => handleToggleWidget(widget.key, e.target.checked)}
                                                        className="w-4 h-4 rounded border-gray-300"
                                                    />
                                                    <span className="text-sm font-medium">{widget.label}</span>
                                                </label>
                                            ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Stats Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {statCards.filter(s => widgetConfig[s.key] !== false).map((stat) => (
                    <Card key={stat.key} className="glass-card">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {stat.title}
                            </CardTitle>
                            <div className={`icon-container ${stat.iconColor}`}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {stat.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Analytics Widgets */}
            <div className="grid gap-6 md:grid-cols-2">
                {widgetConfig['pipeline-funnel'] && <PipelineFunnelWidget />}
                {widgetConfig['agent-leaderboard'] && <AgentLeaderboardWidget />}
                {widgetConfig['upcoming-appointments'] && <UpcomingAppointmentsWidget />}
                {widgetConfig['recent-activity'] && <RecentActivityWidget />}
            </div>

            {/* Quick Actions */}
            {widgetConfig['quick-actions'] !== false && (
                <div className="bg-background/50 rounded-lg p-6 border">
                    <h2 className="text-xl font-semibold mb-4">Acciones Rápidas</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {quickActions.filter(action => widgetConfig[action.key] !== false).map((action) => (
                            <div
                                key={action.key}
                                onClick={() => setLocation(action.path)}
                                className={`group relative flex flex-col justify-between p-4 rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer ${action.hoverColor} h-[140px]`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className={`icon-container ${action.iconColor}`}>
                                        <action.icon className="h-5 w-5" />
                                    </div>
                                    <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="mt-4">
                                    <h3 className="font-semibold">
                                        {action.label}
                                    </h3>
                                    <p className="text-sm mt-1 text-muted-foreground">
                                        {action.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
