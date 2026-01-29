import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSearch } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { SecurityTabContent } from "@/components/SecurityTabContent";

import { usePermissions } from "@/_core/hooks/usePermissions";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { SalesConfigEditor } from "@/components/SalesConfigEditor";
import { PermissionsMatrixEditor } from "@/components/PermissionsMatrixEditor";
import { DashboardConfigEditor } from "@/components/DashboardConfigEditor";
import { AddUserDialog } from "@/components/AddUserDialog";

const TZ_OPTIONS = [
  "America/Asuncion",
  "America/La_Paz",
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Panama",
];

const LANG_OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
];

const CURRENCY_OPTIONS = [
  { value: "PYG", label: "Guaraní (PYG)" },
  { value: "USD", label: "Dólar (USD)" },
  { value: "ARS", label: "Peso (ARS)" },
  { value: "BOB", label: "Boliviano (BOB)" },
  { value: "BRL", label: "Real (BRL)" },
  { value: "MXN", label: "Peso (MXN)" },
];

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "agent", label: "Agente" },
  { value: "viewer", label: "Solo lectura" },
] as const;

export default function Settings() {
  return (
    <SettingsContent />
  );
}

function SettingsContent() {
  const { role } = usePermissions();

  const settingsQuery = trpc.settings.get.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const updateGeneral = trpc.settings.updateGeneral.useMutation({
    onSuccess: () => {
      settingsQuery.refetch();
      toast.success("Configuración guardada");
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePerms = trpc.settings.updatePermissionsMatrix.useMutation({
    onSuccess: () => {
      settingsQuery.refetch();
      toast.success("Permisos actualizados");
    },
    onError: (e) => toast.error(e.message),
  });

  const teamQuery = trpc.team.listUsers.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const updateRole = trpc.team.updateRole.useMutation({
    onSuccess: () => {
      teamQuery.refetch();
      toast.success("Rol actualizado");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCustomRole = trpc.team.updateCustomRole.useMutation({
    onSuccess: () => {
      teamQuery.refetch();
      toast.success("Permisos del usuario actualizados");
    },
    onError: (e) => toast.error(e.message),
  });

  const setActive = trpc.team.setActive.useMutation({
    onSuccess: () => {
      teamQuery.refetch();
      toast.success("Usuario actualizado");
    },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    companyName: "",
    logoUrl: "",
    timezone: "America/Asuncion",
    language: "es",
    currency: "PYG",
    slotMinutes: 15,
    maxPerSlot: 6,
    allowCustomTime: true,
    slaConfig: {
      maxResponseTimeMinutes: 60,
      alertEmail: "",
      notifySupervisor: false
    },
    chatDistributionConfig: {
      mode: "manual" as "manual" | "round_robin" | "all_agents",
      excludeAgentIds: [] as number[],
    },
    metaConfig: {
      appId: "",
      appSecret: "",
      verifyToken: "imagine_crm_verify",
    }
  });

  const initialMatrix = useMemo(() => {
    return settingsQuery.data?.permissionsMatrix ?? {
      owner: ["*"],
      admin: ["settings.*"],
      supervisor: ["dashboard.view"],
      agent: ["dashboard.view"],
      viewer: ["dashboard.view"],
    };
  }, [settingsQuery.data]);

  const availablePermissionRoles = useMemo(() => {
    const matrix = settingsQuery.data?.permissionsMatrix ?? initialMatrix;
    return Object.keys(matrix ?? {}).sort();
  }, [settingsQuery.data, initialMatrix]);

  const [matrixText, setMatrixText] = useState("{");

  const customRoleKeys = useMemo(() => {
    try {
      return Object.keys(initialMatrix ?? {});
    } catch {
      return [] as string[];
    }
  }, [initialMatrix]);

  useEffect(() => {
    if (!settingsQuery.data) return;

    setForm({
      companyName: settingsQuery.data.companyName ?? "",
      logoUrl: settingsQuery.data.logoUrl ?? "",
      timezone: settingsQuery.data.timezone ?? "America/Asuncion",
      language: settingsQuery.data.language ?? "es",
      currency: settingsQuery.data.currency ?? "PYG",
      slotMinutes: settingsQuery.data.scheduling?.slotMinutes ?? 15,
      maxPerSlot: settingsQuery.data.scheduling?.maxPerSlot ?? 6,
      allowCustomTime: settingsQuery.data.scheduling?.allowCustomTime ?? true,
      slaConfig: (settingsQuery.data as any).slaConfig ?? {
        maxResponseTimeMinutes: 60,

        notifySupervisor: false
      },
      chatDistributionConfig: (settingsQuery.data as any).chatDistributionConfig ?? {
        mode: "manual",
        excludeAgentIds: [],
      },
      metaConfig: (settingsQuery.data as any).metaConfig ?? {
        appId: "",
        appSecret: "", // Masked from backend
        verifyToken: "imagine_crm_verify"
      },
    });

    setMatrixText(JSON.stringify(initialMatrix, null, 2));
  }, [settingsQuery.data, initialMatrix]);

  const saveGeneral = () => {
    updateGeneral.mutate({
      companyName: form.companyName,
      logoUrl: form.logoUrl ? form.logoUrl : null,
      timezone: form.timezone,
      language: form.language,
      currency: form.currency,
      scheduling: {
        slotMinutes: form.slotMinutes,
        maxPerSlot: form.maxPerSlot,
        allowCustomTime: form.allowCustomTime,
      },
      slaConfig: form.slaConfig,
      chatDistributionConfig: {
        mode: form.chatDistributionConfig.mode as "manual" | "round_robin" | "all_agents",
        excludeAgentIds: form.chatDistributionConfig.excludeAgentIds,
      },
      metaConfig: form.metaConfig,
    });
  };

  const saveMatrix = () => {
    try {
      const parsed = JSON.parse(matrixText);
      updatePerms.mutate({ permissionsMatrix: parsed });
    } catch {
      toast.error("JSON inválido en permisos");
    }
  };

  const search = useSearch();
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    const params = new URLSearchParams(search);
    const tab = params.get("tab");
    if (tab && ["general", "team", "dashboard", "distribution", "security", "perms", "sla"].includes(tab)) {
      setActiveTab(tab);
    }

    // Handle OAuth Toasts
    if (params.get("success") === "meta_connected") {
      toast.success("WhatsApp conectado correctamente");
      // Clean URL
      window.history.replaceState(null, "", window.location.pathname + "?tab=distribution");
    }
    if (params.get("error")) {
      toast.error("Error conectando con Meta: " + params.get("error"));
      window.history.replaceState(null, "", window.location.pathname + "?tab=distribution");
    }
  }, [search]);

  if (settingsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  // If not allowed, show friendly message
  if (settingsQuery.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configuración</CardTitle>
          <CardDescription>
            No tenés permisos para acceder a esta sección
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Personalizá todo: branding, agenda, roles y permisos
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full h-auto grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-y-2">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="team">Usuarios</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="distribution">Distribución</TabsTrigger>
          <TabsTrigger value="sales">Ventas</TabsTrigger>
          <TabsTrigger value="security">Seguridad</TabsTrigger>
          <TabsTrigger value="perms" disabled={role !== "owner"}>Permisos</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Nombre, logo y preferencias globales</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Nombre de la empresa</Label>
                <Input
                  value={form.companyName}
                  onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                  placeholder="Mi Empresa"
                />
              </div>

              <div className="grid gap-2">
                <Label>Logo (URL)</Label>
                <Input
                  value={form.logoUrl}
                  onChange={(e) => setForm((p) => ({ ...p, logoUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Zona horaria</Label>
                  <Select
                    value={form.timezone}
                    onValueChange={(v) => setForm((p) => ({ ...p, timezone: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {TZ_OPTIONS.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Idioma</Label>
                  <Select
                    value={form.language}
                    onValueChange={(v) => setForm((p) => ({ ...p, language: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANG_OPTIONS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Moneda</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveGeneral} disabled={updateGeneral.isPending}>
                  {updateGeneral.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          <DashboardConfigEditor />
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <CardTitle>Usuarios y roles</CardTitle>
                  <CardDescription>
                    Asigná Admin, Supervisor, Agente o Solo lectura
                  </CardDescription>
                </div>
                <div className="flex-shrink-0">
                  <AddUserDialog onSuccess={() => teamQuery.refetch()} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {(teamQuery.data ?? []).map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 border rounded-lg p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{u.name ?? "Sin nombre"}</p>
                      <p className="text-sm text-muted-foreground truncate">{u.email ?? u.openId}</p>
                      <p className="text-xs text-muted-foreground">Último login: {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString() : "-"}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Select
                        value={u.role}
                        onValueChange={(v) => updateRole.mutate({ userId: u.id, role: v as any })}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={(u as any).customRole ?? "__none__"}
                        onValueChange={(v) =>
                          updateCustomRole.mutate({
                            userId: u.id,
                            customRole: v === "__none__" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Permisos (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Usar rol base</SelectItem>
                          {customRoleKeys
                            .filter((k) => k !== "owner")
                            .map((k) => (
                              <SelectItem key={k} value={k}>
                                {k}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.isActive}
                          onCheckedChange={(v) => setActive.mutate({ userId: u.id, isActive: v })}
                        />
                        <span className="text-sm">Activo</span>
                      </div>
                    </div>
                  </div>
                ))}

                {teamQuery.isLoading && (
                  <div className="text-sm text-muted-foreground">Cargando usuarios...</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="perms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permisos avanzados</CardTitle>
              <CardDescription>
                Define qué puede hacer cada rol en el sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PermissionsMatrixEditor
                initialMatrix={initialMatrix}
                onSave={(m) => updatePerms.mutate({ permissionsMatrix: m })}
                isLoading={updatePerms.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sla" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Niveles de Servicio (SLA)</CardTitle>
              <CardDescription>Define alertas cuando una conversación no es atendida a tiempo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Tiempo Máximo de Respuesta (minutos)</Label>
                <Input
                  type="number"
                  min={5}
                  value={form.slaConfig?.maxResponseTimeMinutes ?? 60}
                  onChange={(e) => setForm(p => ({ ...p, slaConfig: { ...(p.slaConfig || { notifySupervisor: false }), maxResponseTimeMinutes: parseInt(e.target.value) || 60 } }))}
                />
                <p className="text-sm text-muted-foreground">Si un cliente espera más de este tiempo, se generará una alerta.</p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={form.slaConfig?.notifySupervisor ?? false}
                  onCheckedChange={(c) => setForm(p => ({ ...p, slaConfig: { ...(p.slaConfig || { maxResponseTimeMinutes: 60 }), notifySupervisor: c } }))}
                />
                <Label>Notificar al Supervisor (Email)</Label>
              </div>

              {(form.slaConfig?.notifySupervisor) && (
                <div className="grid gap-2 pl-6 border-l-2">
                  <Label>Email para Alertas</Label>
                  <Input
                    placeholder="supervisor@empresa.com"
                    value={form.slaConfig?.alertEmail ?? ""}
                    onChange={(e) => setForm(p => ({ ...p, slaConfig: { ...(p.slaConfig || { maxResponseTimeMinutes: 60, notifySupervisor: true }), alertEmail: e.target.value } }))}
                  />
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button onClick={saveGeneral} disabled={updateGeneral.isPending}>
                  {updateGeneral.isPending ? "Guardando..." : "Guardar Configuración SLA"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="distribution">
          <Card>
            <CardHeader>
              <CardTitle>Distribución de Chats</CardTitle>
              <CardDescription>Configura cómo se asignan las nuevas conversaciones.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* WhatsApp OAuth Section */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">WhatsApp Cloud API</Label>
                  <p className="text-sm text-muted-foreground">
                    Conecta tu cuenta de WhatsApp Business para recibir mensajes.
                  </p>
                </div>
                <Button
                  onClick={() => window.location.href = "/api/meta/connect"}
                  className="bg-[#1877F2] hover:bg-[#166fe5]"
                >
                  Conectar con Facebook
                </Button>
              </div>

              <div className="grid gap-2">
                <Label>Facebook App ID</Label>
                <Input
                  value={form.metaConfig?.appId || ""}
                  onChange={(e) => setForm((p) => ({ ...p, metaConfig: { ...p.metaConfig, appId: e.target.value } }))}
                  placeholder="App ID de Meta Developer"
                />
              </div>

              <div className="grid gap-2">
                <Label>Facebook App Secret</Label>
                <Input
                  type="password"
                  value={form.metaConfig?.appSecret || ""}
                  onChange={(e) => setForm((p) => ({ ...p, metaConfig: { ...p.metaConfig, appSecret: e.target.value } }))}
                  placeholder={(settingsQuery.data as any)?.metaConfig?.hasAppSecret ? "•••••••• (Guardado)" : "App Secret"}
                />
              </div>

              <div className="grid gap-2">
                <Label>Webhook Verify Token</Label>
                <Input
                  readOnly
                  value={form.metaConfig?.verifyToken || "imagine_crm_verify"}
                  className="bg-muted text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">Usa este token al configurar el webhook en el panel de desarrolladores de Facebook.</p>
              </div>

              <Separator />

              <div className="grid gap-2">
                <Label>Modo de Asignación</Label>
                <Select
                  value={form.chatDistributionConfig.mode}
                  onValueChange={(v: any) => setForm(p => ({
                    ...p,
                    chatDistributionConfig: { ...p.chatDistributionConfig, mode: v }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (Sin asignación automática)</SelectItem>
                    <SelectItem value="round_robin">Round Robin (Cíclico)</SelectItem>
                    {/* <SelectItem value="all_agents">Todos (Broadcast)</SelectItem> */}
                  </SelectContent>
                </Select>
              </div>

              {form.chatDistributionConfig.mode === 'round_robin' && (
                <div className="space-y-2 border rounded-lg p-4">
                  <Label>Excluir Agentes del Ciclo</Label>
                  <p className="text-sm text-muted-foreground">Selecciona quiénes NO deben recibir chats automáticamente.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {(teamQuery.data ?? []).filter(u => u.isActive && u.role !== 'viewer').map(u => {
                      const isExcluded = form.chatDistributionConfig.excludeAgentIds.includes(u.id);
                      return (
                        <div key={u.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`exclude-${u.id}`}
                            checked={isExcluded}
                            onCheckedChange={(c) => {
                              setForm(p => {
                                const current = p.chatDistributionConfig.excludeAgentIds;
                                const next = c
                                  ? [...current, u.id]
                                  : current.filter(id => id !== u.id);
                                return {
                                  ...p,
                                  chatDistributionConfig: { ...p.chatDistributionConfig, excludeAgentIds: next }
                                };
                              });
                            }}
                          />
                          <Label htmlFor={`exclude-${u.id}`} className="cursor-pointer">
                            {u.name} ({u.role})
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button onClick={saveGeneral} disabled={updateGeneral.isPending}>
                  {updateGeneral.isPending ? "Guardando..." : "Guardar Configuración"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <SalesConfigEditor
            query={settingsQuery}
            onSave={updateGeneral.mutate}
            isPending={updateGeneral.isPending}
          />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SecurityTabContent />
        </TabsContent>

        <TabsContent value="perms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permisos avanzados</CardTitle>
              <CardDescription>
                Define qué puede hacer cada rol en el sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PermissionsMatrixEditor
                initialMatrix={initialMatrix}
                onSave={(m) => updatePerms.mutate({ permissionsMatrix: m })}
                isLoading={updatePerms.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}






