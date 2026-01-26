import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  MessageCircle,
  Mail,
  Database,
  Bot,
  MapPin,
  Key,
  Workflow,
  AlertCircle,
  Trash2,
  Send,
  Activity
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import FacebookSettings from "@/components/FacebookSettings";

export default function Integrations() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integraciones</h1>
          <p className="text-muted-foreground">
            Conectá tus herramientas favoritas y configurá los servicios externos.
          </p>
        </div>

        <Tabs defaultValue="messaging" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="messaging">Mensajería</TabsTrigger>
            <TabsTrigger value="automation">Automatización</TabsTrigger>
            <TabsTrigger value="system">Sistema & IA</TabsTrigger>
          </TabsList>

          {/* MESSAGING TAB */}
          <TabsContent value="messaging" className="space-y-4 mt-4">
            <WhatsAppList />
            <FacebookSettings />
            <SmtpSettings />
          </TabsContent>

          {/* AUTOMATION TAB */}
          <TabsContent value="automation" className="space-y-4 mt-4">
            <WebhookIntegrations />
          </TabsContent>

          {/* SYSTEM TAB */}
          <TabsContent value="system" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AiSettings />
              <StorageSettings />
              <MapsSettings />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// --- SUB-COMPONENTS ---

function WhatsAppList() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const numbersQuery = trpc.whatsappNumbers.list.useQuery();
  const updateCreds = trpc.whatsappNumbers.updateCredentials.useMutation({
    onSuccess: () => {
      toast.success("Credenciales actualizadas");
      setOpen(false);
      setEditingId(null);
      numbersQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const selectedNumber = numbersQuery.data?.find((n) => n.id === editingId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          WhatsApp Cloud API
        </CardTitle>
        <CardDescription>
          Gestiona los números conectados y sus credenciales de Meta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {numbersQuery.isLoading && <div className="text-sm">Cargando...</div>}
        <div className="grid gap-4">
          {numbersQuery.data?.map((num) => (
            <div key={num.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{num.phoneNumber}</span>
                  {num.displayName && <span className="text-muted-foreground">({num.displayName})</span>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full ${num.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-muted-foreground">{num.isConnected ? "Conectado" : "Desconectado"}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setEditingId(num.id); setOpen(true); }}>
                <Key className="w-4 h-4 mr-2" />
                Configurar
              </Button>
            </div>
          ))}

          {numbersQuery.data?.length === 0 && (
            <div className="flex items-center gap-2 p-4 text-sm text-yellow-600 bg-yellow-50 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              No hay números registrados. Contacta a soporte para agregar uno.
            </div>
          )}
        </div>

        {/* Dialog for editing credentials */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar API WhatsApp</DialogTitle>
              <DialogDescription>Credenciales del portal de desarrolladores de Meta.</DialogDescription>
            </DialogHeader>
            {selectedNumber && (
              <WhatsAppCredentialForm
                numberId={selectedNumber.id}
                onSubmit={(data) => updateCreds.mutate({ id: selectedNumber.id, ...data })}
                isLoading={updateCreds.isPending}
              />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function WhatsAppCredentialForm({ numberId, onSubmit, isLoading }: { numberId: number, onSubmit: (data: any) => void, isLoading: boolean }) {
  const detailsQuery = trpc.whatsappNumbers.getById.useQuery({ id: numberId }, { enabled: !!numberId });
  const [formData, setFormData] = useState({ phoneNumberId: "", businessAccountId: "", accessToken: "" });

  useEffect(() => {
    if (detailsQuery.data) {
      setFormData({
        phoneNumberId: detailsQuery.data.phoneNumberId || "",
        businessAccountId: detailsQuery.data.businessAccountId || "",
        accessToken: "",
      });
    }
  }, [detailsQuery.data]);

  return (
    <div className="space-y-4 py-2">
      <div className="grid gap-2">
        <Label>Phone Number ID</Label>
        <Input value={formData.phoneNumberId} onChange={(e) => setFormData(p => ({ ...p, phoneNumberId: e.target.value }))} />
      </div>
      <div className="grid gap-2">
        <Label>Business Account ID</Label>
        <Input value={formData.businessAccountId} onChange={(e) => setFormData(p => ({ ...p, businessAccountId: e.target.value }))} />
      </div>
      <div className="grid gap-2">
        <Label>Access Token (Permanente)</Label>
        <Input type="password" value={formData.accessToken} onChange={(e) => setFormData(p => ({ ...p, accessToken: e.target.value }))} placeholder={detailsQuery.data?.hasAccessToken ? "Guardado" : "EAAG..."} />
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(formData)} disabled={isLoading}>
          {isLoading ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function SmtpSettings() {
  const query = trpc.settings.get.useQuery();
  const utils = trpc.useContext();
  const updateSmtp = trpc.settings.updateSmtpConfig.useMutation({
    onSuccess: () => { toast.success("SMTP guardado"); utils.settings.get.invalidate(); }
  });
  const testSmtp = trpc.settings.verifySmtpTest.useMutation({
    onSuccess: () => toast.success("Email enviado"),
    onError: (e) => toast.error(e.message)
  });

  const [form, setForm] = useState({ host: "", port: 587, secure: false, user: "", pass: "", from: "" });

  useEffect(() => {
    if (query.data?.smtpConfig) setForm(query.data.smtpConfig as any);
  }, [query.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> SMTP (Correo)</CardTitle>
        <CardDescription>Para enviar invitaciones y alertas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Host</Label>
            <Input value={form.host} onChange={e => setForm(p => ({ ...p, host: e.target.value }))} placeholder="smtp.gmail.com" />
          </div>
          <div className="grid gap-2">
            <Label>Puerto</Label>
            <Input type="number" value={form.port} onChange={e => setForm(p => ({ ...p, port: Number(e.target.value) }))} />
          </div>
          <div className="grid gap-2">
            <Label>Usuario</Label>
            <Input value={form.user} onChange={e => setForm(p => ({ ...p, user: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <Label>Password</Label>
            <Input type="password" value={form.pass} onChange={e => setForm(p => ({ ...p, pass: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <Label>From</Label>
            <Input value={form.from} onChange={e => setForm(p => ({ ...p, from: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2 pt-8">
            <Switch checked={form.secure} onCheckedChange={c => setForm(p => ({ ...p, secure: c }))} />
            <Label>SSL/TLS</Label>
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => {
            const email = prompt("Email de prueba:");
            if (email) testSmtp.mutate({ email });
          }}>Probar</Button>
          <Button onClick={() => updateSmtp.mutate(form)} disabled={updateSmtp.isPending}>Guardar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StorageSettings() {
  const updateStorage = trpc.settings.updateStorageConfig.useMutation({
    onSuccess: () => toast.success("Storage config guardado")
  });
  const [form, setForm] = useState({
    provider: "s3" as "s3" | "forge", bucket: "", region: "", accessKey: "", secretKey: "", endpoint: "", publicUrl: ""
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> Almacenamiento (S3)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Provider</Label>
          <Select value={form.provider} onValueChange={(v: any) => setForm(p => ({ ...p, provider: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="s3">AWS S3 / Compatible</SelectItem>
              <SelectItem value="forge">Forge (Built-in)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.provider === 's3' && (
          <>
            <div className="grid gap-2"><Label>Bucket</Label><Input value={form.bucket} onChange={e => setForm(p => ({ ...p, bucket: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Region</Label><Input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Endpoint</Label><Input value={form.endpoint} onChange={e => setForm(p => ({ ...p, endpoint: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Access Key</Label><Input value={form.accessKey} onChange={e => setForm(p => ({ ...p, accessKey: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Secret Key</Label><Input type="password" value={form.secretKey} onChange={e => setForm(p => ({ ...p, secretKey: e.target.value }))} /></div>
          </>
        )}
        <Button onClick={() => updateStorage.mutate(form)} className="w-full">Guardar</Button>
      </CardContent>
    </Card>
  );
}

function AiSettings() {
  const updateAi = trpc.settings.updateAiConfig.useMutation({ onSuccess: () => toast.success("AI config guardado") });
  const [form, setForm] = useState({ provider: "openai" as "openai" | "anthropic", apiKey: "", model: "gpt-4-turbo" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot className="w-5 h-5" /> Inteligencia Artificial</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Proveedor</Label>
          <Select value={form.provider} onValueChange={(v: any) => setForm(p => ({ ...p, provider: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2"><Label>API Key</Label><Input type="password" value={form.apiKey} onChange={e => setForm(p => ({ ...p, apiKey: e.target.value }))} /></div>
        <div className="grid gap-2"><Label>Modelo (Default)</Label><Input value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} /></div>
        <Button onClick={() => updateAi.mutate(form)} className="w-full">Guardar</Button>
      </CardContent>
    </Card>
  );
}

function MapsSettings() {
  const updateMaps = trpc.settings.updateMapsConfig.useMutation({ onSuccess: () => toast.success("Maps config guardado") });
  const [apiKey, setApiKey] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5" /> Google Maps</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>API Key</Label>
          <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="AIza..." />
        </div>
        <Button onClick={() => updateMaps.mutate({ apiKey })} className="w-full">Guardar</Button>
      </CardContent>
    </Card>
  );
}

function WebhookIntegrations() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const integrationsQuery = trpc.integrations.list.useQuery();
  const utils = trpc.useContext();

  const deleteMutation = trpc.integrations.delete.useMutation({
    onSuccess: () => {
      toast.success("Integración eliminada");
      integrationsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = trpc.integrations.toggle.useMutation({
    onSuccess: () => {
      toast.success("Estado actualizado");
      integrationsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const testMutation = trpc.integrations.testWebhook.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Webhook probado exitosamente (Status: ${data.status})`);
      } else {
        toast.error(`Error al probar webhook: ${data.error || data.status}`);
      }
      integrationsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleEdit = (id: number) => {
    setEditingId(id);
    setOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de eliminar esta integración?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="w-5 h-5" />
            n8n, Zapier & Webhooks
          </CardTitle>
          <CardDescription>
            Conectá Chatwoot, n8n o cualquier servicio mediante Webhooks.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingId(null); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Bot className="w-4 h-4 mr-2" />
              Nueva Integración
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Integración" : "Nueva Integración"}</DialogTitle>
              <DialogDescription>
                Configurá el endpoint y los eventos para disparar.
              </DialogDescription>
            </DialogHeader>
            <IntegrationForm
              id={editingId}
              onSuccess={() => {
                setOpen(false);
                setEditingId(null);
                integrationsQuery.refetch();
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {integrationsQuery.isLoading && <div className="text-sm text-center py-4">Cargando integraciones...</div>}

        <div className="grid gap-4">
          {integrationsQuery.data?.map((integration) => (
            <div key={integration.id} className="flex flex-col md:flex-row items-center justify-between p-4 border rounded-lg bg-card gap-4">
              <div className="flex items-start gap-3 w-full md:w-auto">
                <div className={`p-2 rounded-lg ${integration.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">{integration.name}</h4>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground uppercase font-mono">
                      {integration.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-mono break-all line-clamp-1 max-w-[300px]" title={integration.webhookUrl}>
                    {integration.webhookUrl}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    {integration.lastTriggeredAt && (
                      <span className="flex items-center gap-1 text-green-600">
                        <Activity className="w-3 h-3" />
                        Ejecutado: {new Date(integration.lastTriggeredAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <div className="flex items-center gap-2 mr-2">
                  <Switch
                    checked={integration.isActive}
                    onCheckedChange={(c) => toggleMutation.mutate({ id: integration.id, isActive: c })}
                  />
                </div>

                <Button variant="outline" size="icon" onClick={() => testMutation.mutate({ id: integration.id })} title="Probar Webhook" disabled={testMutation.isPending}>
                  <Send className="w-4 h-4" />
                </Button>

                <Button variant="outline" size="sm" onClick={() => handleEdit(integration.id)}>
                  Editar
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(integration.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {integrationsQuery.data?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <Workflow className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No hay integraciones configuradas.</p>
              <p className="text-sm">Agregá la primera para conectar con Zapier, n8n o Chatwoot.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationForm({ id, onSuccess }: { id: number | null, onSuccess: () => void }) {
  const isEditing = !!id;
  const numbersQuery = trpc.whatsappNumbers.list.useQuery();
  const integrationsQuery = trpc.integrations.list.useQuery();
  const existing = integrationsQuery.data?.find(i => i.id === id);

  const createMutation = trpc.integrations.create.useMutation({
    onSuccess: () => { toast.success("Integración creada"); onSuccess(); },
    onError: (e) => toast.error(e.message)
  });

  const updateMutation = trpc.integrations.update.useMutation({
    onSuccess: () => { toast.success("Integración actualizada"); onSuccess(); },
    onError: (e) => toast.error(e.message)
  });

  const [form, setForm] = useState({
    name: "",
    type: "webhook" as "webhook" | "n8n" | "zapier" | "chatwoot",
    webhookUrl: "",
    whatsappNumberId: 0,
    events: ["message_received"] // Default
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        type: existing.type as any,
        webhookUrl: existing.webhookUrl,
        whatsappNumberId: existing.whatsappNumberId,
        events: (existing.events as string[]) || []
      });
    } else if (numbersQuery.data?.[0]) {
      setForm(p => ({ ...p, whatsappNumberId: numbersQuery.data[0].id }));
    }
  }, [existing, numbersQuery.data]);

  const handleSubmit = () => {
    if (!form.name || !form.webhookUrl) return toast.error("Completá los campos requeridos");
    if (isEditing && id) {
      updateMutation.mutate({ id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const EVENT_OPTIONS = [
    { value: "lead_created", label: "Nuevo Lead" },
    { value: "lead_updated", label: "Lead Actualizado" },
    { value: "message_received", label: "Mensaje Recibido (WhatsApp)" },
    { value: "campaign_sent", label: "Campaña Enviada" },
  ];

  const handleEventToggle = (evt: string) => {
    setForm(p => ({
      ...p,
      events: p.events.includes(evt)
        ? p.events.filter(e => e !== evt)
        : [...p.events, evt]
    }));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4 py-2">
      <div className="grid gap-2">
        <Label>Nombre</Label>
        <Input
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="Ej: Conexión n8n Producción"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={(v: any) => setForm(p => ({ ...p, type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="webhook">Webhook Genérico</SelectItem>
              <SelectItem value="n8n">n8n</SelectItem>
              <SelectItem value="zapier">Zapier</SelectItem>
              <SelectItem value="chatwoot">Chatwoot</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Canal de Origen</Label>
          <Select
            value={form.whatsappNumberId.toString()}
            onValueChange={(v) => setForm(p => ({ ...p, whatsappNumberId: Number(v) }))}
          >
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {numbersQuery.data?.map(n => (
                <SelectItem key={n.id} value={n.id.toString()}>
                  {n.phoneNumber} ({n.displayName || 'Sin nombre'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">Disparar solo para este número</p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Webhook URL</Label>
        <Input
          value={form.webhookUrl}
          onChange={e => setForm(p => ({ ...p, webhookUrl: e.target.value }))}
          placeholder="https://..."
        />
      </div>

      <div className="grid gap-2">
        <Label>Eventos</Label>
        <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
          {EVENT_OPTIONS.map(opt => (
            <div key={opt.value} className="flex items-center space-x-2">
              <Checkbox
                id={`evt-${opt.value}`}
                checked={form.events.includes(opt.value)}
                onCheckedChange={() => handleEventToggle(opt.value)}
              />
              <Label htmlFor={`evt-${opt.value}`} className="cursor-pointer font-normal text-sm">
                {opt.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <DialogFooter className="pt-4">
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar Integración"}
        </Button>
      </DialogFooter>
    </div>
  );
}
