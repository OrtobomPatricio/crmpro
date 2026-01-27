import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
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
  ChevronRight,
  MenuIcon,
  User,
  ChevronLeft,
  ArrowUpRight,
  Pencil,
  Save,
  X,
} from "lucide-react";

interface WarmupNumber {
  id: number;
  phoneNumber: string;
  warmupDay: number;
  dailyMessageLimit: number;
  messagesSentToday: number;
}

interface CountryDistribution {
  country: string;
  count: number;
}

interface RecentLead {
  id: number;
  name: string;
  phone: string;
  status: string;
  country: string;
}

// Quick Actions configuration - hoverColor matches icon color
const quickActions = [
  {
    key: "leads",
    icon: Users,
    label: "Gestionar Leads",
    description: "Importa, organiza y segmenta tus prospectos",
    path: "/leads",
    iconColor: "icon-container-blue",
    hoverColor: "hover-blue"
  },
  {
    key: "campaigns",
    icon: Send,
    label: "Crear Campaña",
    description: "Diseña y lanza campañas de mensajes masivos",
    path: "/campaigns",
    iconColor: "icon-container-pink",
    hoverColor: "hover-pink"
  },
  {
    key: "conversations",
    icon: MessageSquare,
    label: "Conversaciones",
    description: "Chat completo estilo WhatsApp",
    path: "/chat",
    iconColor: "icon-container-purple",
    hoverColor: "hover-purple"
  },
  {
    key: "attendants",
    icon: UserCheck,
    label: "Atendentes",
    description: "Administra tu equipo de atención",
    path: "/settings?tab=team",
    iconColor: "icon-container-red",
    hoverColor: "hover-red"
  },
  {
    key: "health",
    icon: Shield,
    label: "Salud de Cuentas",
    description: "Monitor de detección de bloqueos",
    path: "/monitoring",
    iconColor: "icon-container-orange",
    hoverColor: "hover-orange"
  },
  {
    key: "whatsapp",
    icon: Phone,
    label: "Cuentas WhatsApp",
    description: "Monitorea tus 42 números conectados",
    path: "/monitoring",
    iconColor: "icon-container-green",
    hoverColor: "hover-green"
  },
  {
    key: "integrations",
    icon: LayoutGrid,
    label: "Integraciones",
    description: "Configura Chatwoot, n8n y más",
    path: "/integrations",
    iconColor: "icon-container-purple",
    hoverColor: "hover-purple"
  },
  {
    key: "kanban",
    icon: LayoutGrid,
    label: "Kanban Board",
    description: "Gestiona leads con arrastrar y soltar",
    path: "/kanban",
    iconColor: "icon-container-pink",
    hoverColor: "hover-pink"
  },
  {
    key: "commissions",
    icon: DollarSign,
    label: "Comisiones",
    description: "Acompaña tus ganancias por país",
    path: "/analytics?tab=commissions",
    iconColor: "icon-container-yellow",
    hoverColor: "hover-yellow"
  },
  {
    key: "goals",
    icon: Target,
    label: "Metas de Vendas",
    description: "Progreso y ranking del equipo",
    path: "/analytics?tab=goals",
    iconColor: "icon-container-orange",
    hoverColor: "hover-orange"
  },
  {
    key: "achievements",
    icon: Trophy,
    label: "Logros",
    description: "Badges y conquistas desbloqueadas",
    path: "/analytics?tab=achievements",
    iconColor: "icon-container-red",
    hoverColor: "hover-red"
  },
  {
    key: "warmup",
    icon: Flame,
    label: "Warm-up",
    description: "Calendario de 28 días hasta 1000 msgs",
    path: "/monitoring",
    iconColor: "icon-container-orange",
    hoverColor: "hover-orange"
  },
  {
    key: "analytics",
    icon: BarChart3,
    label: "Analytics",
    description: "Tasas de apertura y heatmap de horarios",
    path: "/analytics",
    iconColor: "icon-container-blue",
    hoverColor: "hover-blue"
  },
  {
    key: "scheduling",
    icon: Calendar,
    label: "Agendamiento",
    description: "Gestiona citas y reuniones en calendario",
    path: "/scheduling",
    iconColor: "icon-container-green",
    hoverColor: "hover-green"
  },
  {
    key: "monitoring",
    icon: Activity,
    label: "Monitoreo en Vivo",
    description: "Dashboard en tiempo real con alertas",
    path: "/monitoring",
    iconColor: "icon-container-cyan",
    hoverColor: "hover-cyan"
  },
  {
    key: "reports",
    icon: FileText,
    label: "Reportes",
    description: "Analiza el desempeño de tus campañas",
    path: "/reports",
    iconColor: "icon-container-pink",
    hoverColor: "hover-pink"
  },
];

// Imports for Grid Layout
// Attempt 5: Namespace import to access named exports from CJS build
import * as RGLNamespace from "react-grid-layout";
import { type Layout } from "react-grid-layout"; // Keep type import separate works best usually or strictly from namespace if exported
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// In the CJS build with __esModule=true, import sets "default" to the default export.
// We need the "Responsive" named export, which is available on the namespace object.
const Responsive = (RGLNamespace as any).Responsive || (RGLNamespace as any).default?.Responsive || RGLNamespace.ResponsiveGridLayout;

// Custom WidthProvider since the library export is missing in this build
const WidthProvider = (ComposedComponent: any) => {
  return (props: any) => {
    const [width, setWidth] = useState(1200);
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = elementRef.current;
      if (!el) return;

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(el);
      return () => resizeObserver.disconnect();
    }, []);

    return (
      <div ref={elementRef} className={props.className} style={props.style}>
        <ComposedComponent {...props} width={width} />
      </div>
    );
  };
};

const ResponsiveGridLayout = WidthProvider(Responsive);

// Updated Layout with individual stats
const DEFAULT_LAYOUT: Layout = [
  // Stats Row (4 equal cards)
  { i: "stat-leads", x: 0, y: 0, w: 3, h: 2, minH: 2, maxH: 3 },
  { i: "stat-whatsapp", x: 3, y: 0, w: 3, h: 2, minH: 2, maxH: 3 },
  { i: "stat-messages", x: 6, y: 0, w: 3, h: 2, minH: 2, maxH: 3 },
  { i: "stat-conversion", x: 9, y: 0, w: 3, h: 2, minH: 2, maxH: 3 },

  // NEW ANALYTICS WIDGETS (2x2 grid - larger and balanced)
  { i: "pipeline-funnel", x: 0, y: 2, w: 6, h: 6, minH: 5 },
  { i: "agent-leaderboard", x: 6, y: 2, w: 6, h: 6, minH: 5 },
  { i: "upcoming-appointments", x: 0, y: 8, w: 6, h: 6, minH: 5 },
  { i: "recent-activity", x: 6, y: 8, w: 6, h: 6, minH: 5 },

  // Warmup & Status (moved below widgets)
  { i: "warmup", x: 0, y: 14, w: 6, h: 5, minH: 4 },
  { i: "status", x: 6, y: 14, w: 6, h: 5, minH: 4 },

  // Quick Actions & Recent Leads (full width at bottom)
  { i: "quick-actions", x: 0, y: 19, w: 12, h: 5, minH: 4 },
  { i: "recent-leads", x: 0, y: 24, w: 12, h: 5, minH: 4 },
];

export default function Dashboard() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const { data: stats } = trpc.dashboard.getStats.useQuery();
  const { data: settings } = trpc.settings.get.useQuery();
  const updateSettings = trpc.settings.updateDashboardLayout.useMutation();
  const [, setLocation] = useLocation();

  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (settings?.dashboardConfig?.layout) {
      setLayout(settings.dashboardConfig.layout as Layout);
    }
  }, [settings?.dashboardConfig?.layout]);

  const saveLayout = () => {
    updateSettings.mutate({
      layout: layout as any
    });
    toast.success("Diseño del dashboard guardado");
    setIsEditing(false);
  };

  const cancelEdit = () => {
    if (settings?.dashboardConfig?.layout) {
      setLayout(settings.dashboardConfig.layout as Layout);
    } else {
      setLayout(DEFAULT_LAYOUT);
    }
    setIsEditing(false);
  };

  // Filter quick actions based on dashboard config
  const dashboardConfig = (settings?.dashboardConfig as Record<string, any>) ?? {};
  const visibleActions = quickActions.filter(action => dashboardConfig.visibleWidgets?.[action.key] !== false);

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
      value: stats?.totalNumbers ?? 0,
      description: `${stats?.activeNumbers ?? 0} activos`,
      icon: Phone,
      iconColor: "icon-container-green",
    },
    {
      key: "stat-messages",
      title: "Mensajes Hoy",
      value: stats?.messagesToday ?? 0,
      description: "Mensajes enviados",
      icon: MessageCircle,
      iconColor: "icon-container-purple",
    },
    {
      key: "stat-conversion",
      title: "Tasa de Conversión",
      value: `${stats?.conversionRate ?? 0}%`,
      description: "Leads ganados",
      icon: TrendingUp,
      iconColor: "icon-container-orange",
    },
  ];

  const warmupNumbers = (stats?.warmupNumbers ?? []) as WarmupNumber[];
  const countriesDistribution = (stats?.countriesDistribution ?? []) as CountryDistribution[];
  const recentLeads = (stats?.recentLeads ?? []) as RecentLead[];

  return (
    <div className="space-y-4">
      {/* Welcome Section */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bienvenido, {user?.name?.split(' ')[0] ?? 'Usuario'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? "Arrastra y redimensiona los widgets a tu gusto."
              : "Aquí tienes el resumen de tu CRM."}
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button onClick={cancelEdit} size="sm" variant="ghost" className="gap-2 text-muted-foreground">
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={saveLayout} size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                <Save className="h-4 w-4" />
                Guardar Diseño
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} size="sm" variant="outline" className="gap-2">
              <Pencil className="h-4 w-4" />
              Editar Diseño
            </Button>
          )}
        </div>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={100}
        onLayoutChange={(l: Layout) => setLayout(l)}
        draggableHandle=".drag-handle"
        isDraggable={isEditing}
        isResizable={isEditing}
      >
        {/* Individual Stats Cards */}
        {statCards.map((stat) => (
          <div key={stat.key} className={`bg-background/50 rounded-lg p-0.5 border group relative ${isEditing ? 'ring-2 ring-primary/20 ring-dashed' : ''}`}>
            {isEditing && (
              <div className="absolute top-2 right-2 z-10 cursor-move p-1 bg-muted rounded drag-handle hover:bg-primary hover:text-primary-foreground transition-colors">
                <LayoutGrid className="h-4 w-4" />
              </div>
            )}
            <Card className="h-full flex flex-col justify-between shadow-none border-0 bg-transparent">
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
          </div>
        ))}

        {/* Warm-up Progress */}
        <div key="warmup" className={isEditing ? 'ring-2 ring-primary/20 ring-dashed rounded-lg' : ''}>
          <Card className="glass-card h-full flex flex-col">
            <CardHeader className={`${isEditing ? 'drag-handle cursor-move' : ''} transition-colors ${isEditing ? 'bg-muted/30' : ''}`}>
              <CardTitle className="flex items-center gap-2">
                <div className="icon-container icon-container-yellow">
                  <Zap className="h-5 w-5" />
                </div>
                <span>Sistema de Warm-up</span>
              </CardTitle>
              <CardDescription>
                Progreso de calentamiento de números
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 overflow-auto">
              {warmupNumbers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay números en proceso de warm-up
                </p>
              ) : (
                warmupNumbers.slice(0, 5).map((number: WarmupNumber) => (
                  <div key={number.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{number.phoneNumber}</span>
                      <span className="text-muted-foreground">
                        Día {number.warmupDay}/28
                      </span>
                    </div>
                    <Progress
                      value={(number.warmupDay / 28) * 100}
                      className="h-2"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Límite: {number.dailyMessageLimit} msg/día</span>
                      <span>{number.messagesSentToday} enviados hoy</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Number Status Overview */}
        <div key="status" className={isEditing ? 'ring-2 ring-primary/20 ring-dashed rounded-lg' : ''}>
          <Card className="glass-card h-full flex flex-col">
            <CardHeader className={`${isEditing ? 'drag-handle cursor-move' : ''} transition-colors ${isEditing ? 'bg-muted/30' : ''}`}>
              <CardTitle className="flex items-center gap-2">
                <div className="icon-container icon-container-green">
                  <Phone className="h-5 w-5" />
                </div>
                <span>Estado de Números</span>
              </CardTitle>
              <CardDescription>
                Distribución por estado
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Activos</span>
                  </div>
                  <span className="font-semibold">{stats?.activeNumbers ?? 0}</span>
                </div>
                {/* ... other stats ... */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">En Warm-up</span>
                  </div>
                  <span className="font-semibold">{stats?.warmingUpNumbers ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Bloqueados</span>
                  </div>
                  <span className="font-semibold">{stats?.blockedNumbers ?? 0}</span>
                </div>
              </div>

              {/* Countries Distribution */}
              <div className="mt-6 pt-4 border-t border-border/50">
                <h4 className="text-sm font-medium mb-3">Distribución por País</h4>
                <div className="grid grid-cols-2 gap-2">
                  {countriesDistribution.map((country: CountryDistribution) => (
                    <div
                      key={country.country}
                      className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm">{country.country}</span>
                      <span className="text-sm font-semibold">{country.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* NEW WIDGETS */}
        <div key="pipeline-funnel" className={isEditing ? 'ring-2 ring-primary/20 ring-dashed rounded-lg' : ''}>
          {isEditing && (
            <div className="absolute top-2 right-2 z-10 cursor-move p-1 bg-muted rounded drag-handle hover:bg-primary hover:text-primary-foreground transition-colors">
              <LayoutGrid className="h-4 w-4" />
            </div>
          )}
          <PipelineFunnelWidget />
        </div>

        <div key="agent-leaderboard" className={isEditing ? 'ring-2 ring-primary/20 ring-dashed rounded-lg' : ''}>
          {isEditing && (
            <div className="absolute top-2 right-2 z-10 cursor-move p-1 bg-muted rounded drag-handle hover:bg-primary hover:text-primary-foreground transition-colors">
              <LayoutGrid className="h-4 w-4" />
            </div>
          )}
          <AgentLeaderboardWidget />
        </div>

        <div key="upcoming-appointments" className={isEditing ? 'ring-2 ring-primary/20 ring-dashed rounded-lg' : ''}>
          {isEditing && (
            <div className="absolute top-2 right-2 z-10 cursor-move p-1 bg-muted rounded drag-handle hover:bg-primary hover:text-primary-foreground transition-colors">
              <LayoutGrid className="h-4 w-4" />
            </div>
          )}
          <UpcomingAppointmentsWidget />
        </div>

        <div key="recent-activity" className={isEditing ? 'ring-2 ring-primary/20 ring-dashed rounded-lg' : ''}>
          {isEditing && (
            <div className="absolute top-2 right-2 z-10 cursor-move p-1 bg-muted rounded drag-handle hover:bg-primary hover:text-primary-foreground transition-colors">
              <LayoutGrid className="h-4 w-4" />
            </div>
          )}
          <RecentActivityWidget />
        </div>

        {/* Quick Actions */}
        <div key="quick-actions" className={isEditing ? 'ring-2 ring-primary/20 ring-dashed rounded-lg' : ''}>
          <div className="h-full flex flex-col bg-background/50 rounded-lg p-4 border relative group">
            <div className={`mb-4 flex items-center justify-between ${isEditing ? 'drag-handle cursor-move' : ''}`}>
              <h2 className="text-xl font-semibold">Acciones Rápidas</h2>
              {isEditing && <LayoutGrid className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 overflow-auto flex-1">
              {visibleActions.map((action) => (
                <div
                  key={action.key}
                  onClick={() => !isEditing && setLocation(action.path)}
                  className={`group relative flex flex-col justify-between p-4 rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all ${!isEditing ? 'cursor-pointer' : ''} ${action.hoverColor} h-[140px]`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`icon-container ${action.iconColor}`}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    {!isEditing && <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
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
        </div>

        {/* Recent Activity */}
        <div key="recent-leads" className={isEditing ? 'ring-2 ring-primary/20 ring-dashed rounded-lg' : ''}>
          <Card className="glass-card h-full flex flex-col">
            <CardHeader className={`${isEditing ? 'drag-handle cursor-move' : ''} transition-colors ${isEditing ? 'bg-muted/30' : ''}`}>
              <CardTitle>Leads Recientes</CardTitle>
              <CardDescription>
                Últimos leads agregados al sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <div className="space-y-4">
                {recentLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay leads recientes
                  </p>
                ) : (
                  recentLeads.map((lead: RecentLead) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => !isEditing && setLocation('/leads')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <span className="text-sm font-semibold text-white">
                            {lead.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{lead.name}</p>
                          <p className="text-sm text-muted-foreground">{lead.phone}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`status-badge status-${lead.status}`}>
                          {lead.status}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {lead.country}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </ResponsiveGridLayout>
    </div>
  );
}
