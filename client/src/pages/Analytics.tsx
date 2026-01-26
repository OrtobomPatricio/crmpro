import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp,
  Users,
  MessageCircle,
  Phone,
  Target,
  DollarSign,
  BarChart3,
  PieChart,
  Clock,
  Trophy,
  Medal,
  Award
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";

export default function Analytics() {
  const { data: dashboardStats } = trpc.dashboard.getStats.useQuery();
  const { data: numberStats } = trpc.whatsappNumbers.getStats.useQuery();

  const totalCommission = (dashboardStats?.recentLeads ?? []).reduce((acc, lead: { commission?: string | null }) => {
    return acc + parseFloat(lead.commission ?? '0');
  }, 0);


  const searchParams = new URLSearchParams(window.location.search);
  const defaultTab = searchParams.get("tab") || "overview";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Métricas y estadísticas de rendimiento
          </p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
            <TabsTrigger value="overview">General</TabsTrigger>
            <TabsTrigger value="commissions">Comisiones</TabsTrigger>
            <TabsTrigger value="goals">Metas</TabsTrigger>
            <TabsTrigger value="achievements">Logros</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 pt-4">
            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Leads
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats?.totalLeads ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Leads en el sistema
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tasa de Conversión
                  </CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats?.conversionRate ?? 0}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Leads ganados
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Mensajes Hoy
                  </CardTitle>
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats?.messagesToday ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enviados hoy
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Números Activos
                  </CardTitle>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats?.activeNumbers ?? 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    De {dashboardStats?.totalNumbers ?? 0} totales
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Lead Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Distribución de Leads
                  </CardTitle>
                  <CardDescription>
                    Por estado actual
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { status: 'Nuevos', count: 0, color: 'bg-blue-500' },
                      { status: 'Contactados', count: 0, color: 'bg-yellow-500' },
                      { status: 'Calificados', count: 0, color: 'bg-purple-500' },
                      { status: 'Negociación', count: 0, color: 'bg-orange-500' },
                      { status: 'Ganados', count: 0, color: 'bg-green-500' },
                      { status: 'Perdidos', count: 0, color: 'bg-red-500' },
                    ].map((item) => (
                      <div key={item.status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${item.color}`} />
                          <span className="text-sm">{item.status}</span>
                        </div>
                        <span className="font-semibold">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Numbers by Country */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Números por País
                  </CardTitle>
                  <CardDescription>
                    Distribución geográfica
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(numberStats?.byCountry ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No hay datos disponibles
                      </p>
                    ) : (
                      (numberStats?.byCountry ?? []).map((country: { country: string; count: number }) => {
                        const total = numberStats?.total ?? 1;
                        const percentage = Math.round((country.count / total) * 100);
                        return (
                          <div key={country.country} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>{country.country}</span>
                              <span className="font-semibold">{country.count}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Number Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Estado de Números
                  </CardTitle>
                  <CardDescription>
                    Distribución por estado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {dashboardStats?.activeNumbers ?? 0}
                      </div>
                      <p className="text-sm text-green-700">Activos</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {dashboardStats?.warmingUpNumbers ?? 0}
                      </div>
                      <p className="text-sm text-yellow-700">Warm-up</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {dashboardStats?.blockedNumbers ?? 0}
                      </div>
                      <p className="text-sm text-red-700">Bloqueados</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-gray-600">
                        {(dashboardStats?.totalNumbers ?? 0) -
                          (dashboardStats?.activeNumbers ?? 0) -
                          (dashboardStats?.warmingUpNumbers ?? 0) -
                          (dashboardStats?.blockedNumbers ?? 0)}
                      </div>
                      <p className="text-sm text-gray-700">Desconectados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Resumen de Rendimiento
                  </CardTitle>
                  <CardDescription>
                    Métricas clave del sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Comisión Potencial Total</span>
                      </div>
                      <span className="font-semibold text-green-600">
                        {totalCommission.toLocaleString()} G$
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">Leads por Número</span>
                      </div>
                      <span className="font-semibold">
                        {dashboardStats?.totalNumbers
                          ? Math.round((dashboardStats?.totalLeads ?? 0) / dashboardStats.totalNumbers)
                          : 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-purple-500" />
                        <span className="text-sm">Capacidad de Mensajes/Día</span>
                      </div>
                      <span className="font-semibold">
                        {((dashboardStats?.activeNumbers ?? 0) * 1000).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="commissions" className="pt-4">
            <CommissionsView />
          </TabsContent>

          <TabsContent value="goals" className="pt-4">
            <GoalsView />
          </TabsContent>

          <TabsContent value="achievements" className="pt-4">
            <AchievementsView />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function CommissionsView() {
  const { data: dashboardStats } = trpc.dashboard.getStats.useQuery();
  // Mock detailed data breakdown by country
  const commissionsByCountry = [
    { country: "Paraguay", amount: 12500000, leads: 45 },
    { country: "Bolivia", amount: 8400000, leads: 32 },
    { country: "Panamá", amount: 15600000, leads: 28 },
    { country: "Chile", amount: 11200000, leads: 21 },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Comisiones por País</CardTitle>
          <CardDescription>Desglose de ganancias generadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {commissionsByCountry.map((item) => (
              <div key={item.country} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xs">
                    {item.country.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{item.country}</div>
                    <div className="text-xs text-muted-foreground">{item.leads} leads cerrados</div>
                  </div>
                </div>
                <div className="font-bold text-green-600">
                  {item.amount.toLocaleString()} G$
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proyección Mensual</CardTitle>
          <CardDescription>Basado en el rendimiento actual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-4xl font-bold text-primary mb-2">
              47.700.000 G$
            </div>
            <p className="text-muted-foreground mb-6">Estimado al cierre de mes</p>
            <div className="w-full space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progreso (Día 22/30)</span>
                <span>73%</span>
              </div>
              <Progress value={73} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GoalsView() {
  const { data: goals, isLoading } = trpc.goals.list.useQuery();
  const [isNewGoalOpen, setIsNewGoalOpen] = useState(false);

  // Mock data for display until DB is populated
  const displayGoals = goals && goals.length > 0 ? goals : [
    { id: 1, type: "sales_amount", targetAmount: 50000000, currentAmount: 35000000, period: "monthly" },
    { id: 2, type: "deals_closed", targetAmount: 50, currentAmount: 42, period: "monthly" },
    { id: 3, type: "leads_created", targetAmount: 500, currentAmount: 320, period: "monthly" },
  ];

  const getLabel = (type: string) => {
    switch (type) {
      case "sales_amount": return "Ventas Totales";
      case "deals_closed": return "Cierres";
      case "leads_created": return "Nuevos Leads";
      default: return type;
    }
  };

  const getFormat = (type: string, val: number) => {
    if (type === "sales_amount") return val.toLocaleString() + " G$";
    return val.toString();
  };

  return (
    <div className="grid gap-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayGoals.map((goal) => {
          const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          return (
            <Card key={goal.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {getLabel(goal.type)} ({goal.period === 'monthly' ? 'Mensual' : 'Semanal'})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-end mb-2">
                  <div className="text-2xl font-bold">
                    {getFormat(goal.type, goal.currentAmount)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    / {getFormat(goal.type, goal.targetAmount)}
                  </div>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2 text-right">{progress}% completado</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ranking del Equipo</CardTitle>
          <CardDescription>Top performers este mes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { name: "Ana Silva", sales: 18500000, deals: 12, rank: 1 },
              { name: "Carlos Ruiz", sales: 15200000, deals: 10, rank: 2 },
              { name: "Sofia Merez", sales: 12800000, deals: 8, rank: 3 },
            ].map((agent) => (
              <div key={agent.rank} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 font-bold text-primary">
                    #{agent.rank}
                  </div>
                  <div>
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">{agent.deals} cierres</div>
                  </div>
                </div>
                <div className="font-bold">
                  {agent.sales.toLocaleString()} G$
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AchievementsView() {
  const { data: achievements } = trpc.achievements.list.useQuery();

  const BADGES = [
    { id: "first_sale", name: "Primera Venta", icon: Trophy, desc: "Cerraste tu primera venta", color: "text-yellow-500 bg-yellow-500/10" },
    { id: "shark", name: "Tiburón", icon: Medal, desc: "Más de 50M G$ en un mes", color: "text-blue-500 bg-blue-500/10" },
    { id: "speed", name: "Rayo Veloz", icon: Clock, desc: "Respuesta promedio < 5min", color: "text-purple-500 bg-purple-500/10" },
    { id: "closer", name: "Closer", icon: Award, desc: "10 Cierres en una semana", color: "text-green-500 bg-green-500/10" },
    { id: "social", name: "Sociable", icon: MessageCircle, desc: "1000 Mensajes enviados", color: "text-pink-500 bg-pink-500/10" },
  ];

  // Mock unlocked badges
  const unlockedIds = achievements?.map(a => a.type) || ["first_sale", "social"];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {BADGES.map((badge) => {
        const isUnlocked = unlockedIds.includes(badge.id);
        const Icon = badge.icon;

        return (
          <Card key={badge.id} className={`text-center ${isUnlocked ? 'border-primary/50' : 'opacity-50 grayscale'}`}>
            <CardContent className="pt-6 flex flex-col items-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isUnlocked ? badge.color : 'bg-muted'}`}>
                <Icon className="w-8 h-8" />
              </div>
              <h3 className="font-bold mb-1">{badge.name}</h3>
              <p className="text-xs text-muted-foreground">{badge.desc}</p>
              {isUnlocked && (
                <div className="mt-3 px-2 py-1 bg-primary/10 rounded-full text-[10px] font-medium text-primary">
                  Desbloqueado
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

