import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import {
  Phone,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  MoreHorizontal,
  Zap,
  MessageCircle,
  QrCode,
  Key,
  Link2,
  Unlink
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";
import { AMERICAS_COUNTRIES } from "@/_core/data/americasCountries";

type NumberStatus = 'active' | 'warming_up' | 'blocked' | 'disconnected';

interface WhatsAppNumber {
  id: number;
  phoneNumber: string;
  displayName: string | null;
  country: string;
  countryCode: string;
  status: NumberStatus;
  warmupDay: number;
  dailyMessageLimit: number;
  messagesSentToday: number;
  totalMessagesSent: number;
  isConnected: boolean;
  lastConnected: Date | null;
  createdAt: Date;
}

const countries = AMERICAS_COUNTRIES;

const statusConfig: Record<NumberStatus, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Activo', color: 'bg-green-500', icon: CheckCircle2 },
  warming_up: { label: 'Warm-up', color: 'bg-yellow-500', icon: Clock },
  blocked: { label: 'Bloqueado', color: 'bg-red-500', icon: AlertTriangle },
  disconnected: { label: 'Desconectado', color: 'bg-gray-400', icon: WifiOff },
};

export default function Monitoring() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [selectedNumberId, setSelectedNumberId] = useState<number | null>(null);
  const [connectionTab, setConnectionTab] = useState<'qr' | 'api'>('qr');
  const [apiCredentials, setApiCredentials] = useState({
    accessToken: '',
    phoneNumberId: '',
    businessAccountId: '',
  });
  const [newNumber, setNewNumber] = useState({
    phoneNumber: '',
    displayName: '',
    country: '',
  });

  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const { data: numbers, isLoading, refetch } = trpc.whatsappNumbers.list.useQuery();
  const { data: stats } = trpc.whatsappNumbers.getStats.useQuery();

  const { data: recentMessages } = trpc.chat.getRecentMessages.useQuery(
    { limit: 50 },
    {
      refetchInterval: 2000,
      refetchIntervalInBackground: true,
    }
  );

  const createNumber = trpc.whatsappNumbers.create.useMutation({
    onSuccess: () => {
      utils.whatsappNumbers.list.invalidate();
      utils.whatsappNumbers.getStats.invalidate();
      setIsAddDialogOpen(false);
      setNewNumber({ phoneNumber: '', displayName: '', country: '' });
      toast.success('Número agregado exitosamente');
    },
    onError: (error) => {
      toast.error('Error al agregar número: ' + error.message);
    },
  });

  const updateStatus = trpc.whatsappNumbers.updateStatus.useMutation({
    onSuccess: () => {
      utils.whatsappNumbers.list.invalidate();
      utils.whatsappNumbers.getStats.invalidate();
      toast.success('Estado actualizado');
    },
  });

  const deleteNumber = trpc.whatsappNumbers.delete.useMutation({
    onSuccess: () => {
      utils.whatsappNumbers.list.invalidate();
      utils.whatsappNumbers.getStats.invalidate();
      toast.success('Número eliminado');
    },
  });

  const setupApi = trpc.whatsappConnections.setupApi.useMutation({
    onSuccess: () => {
      utils.whatsappNumbers.list.invalidate();
      setIsConnectDialogOpen(false);
      setApiCredentials({ accessToken: '', phoneNumberId: '', businessAccountId: '' });
      toast.success('API de WhatsApp Business conectada exitosamente');
    },
    onError: (error) => {
      toast.error('Error al conectar API: ' + error.message);
    },
  });

  const generateQr = trpc.whatsappConnections.generateQr.useMutation({
    onSuccess: (data) => {
      toast.success('Código QR generado. Escanea con WhatsApp Business.');
    },
    onError: (error) => {
      toast.error('Error al generar QR: ' + error.message);
    },
  });

  const disconnect = trpc.whatsappConnections.disconnect.useMutation({
    onSuccess: () => {
      utils.whatsappNumbers.list.invalidate();
      toast.success('Número desconectado');
    },
  });

  const handleCreateNumber = () => {
    if (!newNumber.phoneNumber || !newNumber.country) {
      toast.error('Por favor completa los campos requeridos');
      return;
    }
    const countryData = countries.find(c => c.value === newNumber.country);
    createNumber.mutate({
      phoneNumber: newNumber.phoneNumber,
      displayName: newNumber.displayName || undefined,
      country: newNumber.country,
      countryCode: countryData?.code ?? '',
    });
  };

  const handleConnectApi = () => {
    if (!selectedNumberId || !apiCredentials.accessToken || !apiCredentials.phoneNumberId) {
      toast.error('Por favor completa los campos requeridos');
      return;
    }
    setupApi.mutate({
      whatsappNumberId: selectedNumberId,
      accessToken: apiCredentials.accessToken,
      phoneNumberId: apiCredentials.phoneNumberId,
      businessAccountId: apiCredentials.businessAccountId || undefined,
    });
  };

  const handleGenerateQr = () => {
    if (!selectedNumberId) return;
    generateQr.mutate({ whatsappNumberId: selectedNumberId });
  };

  const openConnectDialog = (numberId: number) => {
    setSelectedNumberId(numberId);
    setIsConnectDialogOpen(true);
  };

  const getWarmupProgress = (day: number) => (day / 28) * 100;
  const getMessageLimitForDay = (day: number) => {
    const minLimit = 20;
    const maxLimit = 1000;
    return Math.round(minLimit + (maxLimit - minLimit) * (day / 28));
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const typedNumbers = (numbers ?? []) as WhatsAppNumber[];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Monitoreo en Vivo</h1>
            <p className="text-muted-foreground">
              Estado de todos tus números de WhatsApp en tiempo real
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Número
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar Número WhatsApp</DialogTitle>
                  <DialogDescription>
                    El número entrará automáticamente en período de warm-up de 28 días.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Número de Teléfono *</Label>
                    <Input
                      id="phone"
                      value={newNumber.phoneNumber}
                      onChange={(e) => setNewNumber({ ...newNumber, phoneNumber: e.target.value })}
                      placeholder="+507 6123-4567"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="displayName">Nombre para Mostrar</Label>
                    <Input
                      id="displayName"
                      value={newNumber.displayName}
                      onChange={(e) => setNewNumber({ ...newNumber, displayName: e.target.value })}
                      placeholder="Ventas Principal"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="country">País *</Label>
                    <Select
                      value={newNumber.country}
                      onValueChange={(value) => setNewNumber({ ...newNumber, country: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un país" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((country) => (
                          <SelectItem key={country.value} value={country.value}>
                            {country.value} ({country.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateNumber} disabled={createNumber.isPending}>
                    {createNumber.isPending ? 'Agregando...' : 'Agregar Número'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Connection Dialog */}
        <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Conectar WhatsApp</DialogTitle>
              <DialogDescription>
                Elige cómo conectar tu número de WhatsApp Business
              </DialogDescription>
            </DialogHeader>

            <Tabs value={connectionTab} onValueChange={(v) => setConnectionTab(v as 'qr' | 'api')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="qr" className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Código QR
                </TabsTrigger>
                <TabsTrigger value="api" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API de Meta
                </TabsTrigger>
              </TabsList>

              <TabsContent value="qr" className="space-y-4 mt-4">
                <div className="text-center p-6 border rounded-lg bg-muted/50">
                  <div className="mx-auto w-48 h-48 bg-white rounded-lg flex items-center justify-center mb-4">
                    {generateQr.isPending ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    ) : generateQr.data ? (
                      <div className="text-xs text-muted-foreground p-4">
                        <QrCode className="h-32 w-32 mx-auto mb-2 text-foreground" />
                        <p>QR generado</p>
                        <p className="text-[10px]">Expira en 5 minutos</p>
                      </div>
                    ) : (
                      <QrCode className="h-24 w-24 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Escanea el código QR con la app de WhatsApp Business para conectar
                  </p>
                  <Button onClick={handleGenerateQr} disabled={generateQr.isPending}>
                    {generateQr.isPending ? 'Generando...' : 'Generar Código QR'}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Instrucciones:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Abre WhatsApp Business en tu teléfono</li>
                    <li>Ve a Configuración → Dispositivos vinculados</li>
                    <li>Toca "Vincular un dispositivo"</li>
                    <li>Escanea el código QR que aparece arriba</li>
                  </ol>
                </div>
              </TabsContent>

              <TabsContent value="api" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm text-blue-400">
                      <strong>Recomendado:</strong> Usar la API oficial de Meta evita bloqueos y permite mayor volumen de mensajes.
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="accessToken">Access Token *</Label>
                      <Input
                        id="accessToken"
                        type="password"
                        value={apiCredentials.accessToken}
                        onChange={(e) => setApiCredentials({ ...apiCredentials, accessToken: e.target.value })}
                        placeholder="EAAxxxxxxx..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
                      <Input
                        id="phoneNumberId"
                        value={apiCredentials.phoneNumberId}
                        onChange={(e) => setApiCredentials({ ...apiCredentials, phoneNumberId: e.target.value })}
                        placeholder="123456789012345"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="businessAccountId">Business Account ID (opcional)</Label>
                      <Input
                        id="businessAccountId"
                        value={apiCredentials.businessAccountId}
                        onChange={(e) => setApiCredentials({ ...apiCredentials, businessAccountId: e.target.value })}
                        placeholder="123456789012345"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">¿Cómo obtener las credenciales?</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Ve a <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">developers.facebook.com</a></li>
                      <li>Crea o selecciona tu aplicación de WhatsApp Business</li>
                      <li>En "WhatsApp" → "Configuración de la API"</li>
                      <li>Copia el Access Token y Phone Number ID</li>
                    </ol>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsConnectDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleConnectApi} disabled={setupApi.isPending}>
                    {setupApi.isPending ? 'Conectando...' : 'Conectar API'}
                  </Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Live Chat Feed */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Chats en vivo
                </CardTitle>
                <CardDescription>
                  Se actualiza automáticamente (cada 2s). Click para abrir el chat.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/chat")}
              >
                Ver Chat
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[360px]">
              <div className="divide-y">
                {(recentMessages ?? []).map((m) => {
                  const content = (m.content ?? "").toString();
                  const preview = content.length > 120 ? content.slice(0, 120) + "…" : content;
                  const createdAt = m.createdAt ? new Date(m.createdAt) : null;
                  const isNew =
                    m.direction === "inbound" &&
                    createdAt &&
                    Date.now() - createdAt.getTime() < 15000;

                  return (
                    <button
                      key={m.id}
                      className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors"
                      onClick={() =>
                        setLocation(
                          `/chat?conversationId=${m.conversationId}&whatsappNumberId=${m.whatsappNumberId}`
                        )
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {m.contactName || m.contactPhone}
                            </span>
                            {isNew && (
                              <Badge variant="secondary" className="text-xs">
                                NUEVO
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {preview || "(sin contenido)"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant={m.direction === "inbound" ? "default" : "outline"}>
                            {m.direction === "inbound" ? "Recibido" : "Enviado"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {createdAt
                              ? createdAt.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                              : ""}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {(recentMessages ?? []).length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Todavía no hay mensajes para mostrar
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Números
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                En {(stats?.byCountry ?? []).length} países
              </p>
            </CardContent>
          </Card>
          {(stats?.byStatus ?? []).map((status: { status: NumberStatus; count: number }) => {
            const config = statusConfig[status.status];
            return (
              <Card key={status.status}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${config.color}`} />
                    {config.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{status.count}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Numbers Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {typedNumbers.map((number) => {
            const config = statusConfig[number.status];
            const StatusIcon = config.icon;

            return (
              <Card key={number.id} className="relative overflow-hidden">
                {/* Status indicator bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${config.color}`} />

                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.color}/10`}>
                        <Phone className={`h-5 w-5 ${config.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {number.displayName || number.phoneNumber}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {number.phoneNumber}
                        </CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!number.isConnected ? (
                          <DropdownMenuItem onClick={() => openConnectDialog(number.id)}>
                            <Link2 className="h-4 w-4 mr-2" />
                            Conectar WhatsApp
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => disconnect.mutate({ whatsappNumberId: number.id })}>
                            <Unlink className="h-4 w-4 mr-2" />
                            Desconectar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {number.status !== 'active' && (
                          <DropdownMenuItem
                            onClick={() => updateStatus.mutate({ id: number.id, status: 'active' })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Marcar como Activo
                          </DropdownMenuItem>
                        )}
                        {number.status !== 'blocked' && (
                          <DropdownMenuItem
                            onClick={() => updateStatus.mutate({ id: number.id, status: 'blocked' })}
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Marcar como Bloqueado
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteNumber.mutate({ id: number.id })}
                        >
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Status and Connection */}
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm">
                      {number.isConnected ? (
                        <>
                          <Wifi className="h-4 w-4 text-green-500" />
                          <span className="text-green-600">Conectado</span>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => openConnectDialog(number.id)}
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          Conectar
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Warm-up Progress (if applicable) */}
                  {number.status === 'warming_up' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          <span>Warm-up</span>
                        </div>
                        <span className="text-muted-foreground">
                          Día {number.warmupDay}/28
                        </span>
                      </div>
                      <Progress value={getWarmupProgress(number.warmupDay)} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        Límite actual: {getMessageLimitForDay(number.warmupDay)} mensajes/día
                      </p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="link" className="h-auto p-0 text-xs mt-1">
                            Ver Calendario de Calentamiento
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                          <DialogHeader>
                            <DialogTitle>Cronograma de Warm-up (28 Días)</DialogTitle>
                            <DialogDescription>
                              Incremento gradual de mensajería para evitar bloqueos.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid grid-cols-7 gap-2 mt-4">
                            {Array.from({ length: 28 }, (_, i) => {
                              const day = i + 1;
                              const isPast = day < number.warmupDay;
                              const isCurrent = day === number.warmupDay;
                              const limit = getMessageLimitForDay(day);

                              return (
                                <div
                                  key={day}
                                  className={`
                                  aspect-square rounded-md flex flex-col items-center justify-center border text-xs
                                  ${isCurrent ? 'border-primary bg-primary/10 font-bold ring-2 ring-primary ring-offset-2' : ''}
                                  ${isPast ? 'bg-muted/50 text-muted-foreground border-muted' : ''}
                                  ${!isPast && !isCurrent ? 'bg-white' : ''}
                                `}
                                >
                                  <span className={isCurrent ? 'text-primary' : ''}>Día {day}</span>
                                  <span className="text-[10px] text-muted-foreground">{limit} msgs</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-between items-center text-xs text-muted-foreground mt-4">
                            <div className="flex gap-4">
                              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-muted/50 border rounded-sm"></div> Completado</div>
                              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-primary/10 border border-primary rounded-sm"></div> Actual</div>
                            </div>
                            <div>Total estimado: ~15,000 mensajes</div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}

                  {/* Message Stats */}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        Hoy
                      </p>
                      <p className="text-lg font-semibold">
                        {number.messagesSentToday}
                        <span className="text-xs text-muted-foreground font-normal">
                          /{number.dailyMessageLimit}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        Total
                      </p>
                      <p className="text-lg font-semibold">{number.totalMessagesSent}</p>
                    </div>
                  </div>

                  {/* Country */}
                  <div className="text-xs text-muted-foreground">
                    {number.country} ({number.countryCode})
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {typedNumbers.length === 0 && (
          <Card className="p-12">
            <div className="text-center">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay números registrados</h3>
              <p className="text-muted-foreground mb-4">
                Agrega tu primer número de WhatsApp para comenzar a monitorear
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Número
              </Button>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
