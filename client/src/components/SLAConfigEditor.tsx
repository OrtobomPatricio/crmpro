import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface SLAConfigEditorProps {
    query: any;
    updateMutation: any;
}

export function SLAConfigEditor({ query, updateMutation }: SLAConfigEditorProps) {
    const [form, setForm] = useState({
        maxResponseTimeMinutes: 60,
        alertEmail: "",
        notifySupervisor: false,
    });

    // Load initial data
    useEffect(() => {
        if (query.data?.slaConfig) {
            setForm({
                maxResponseTimeMinutes: query.data.slaConfig.maxResponseTimeMinutes ?? 60,
                alertEmail: query.data.slaConfig.alertEmail ?? "",
                notifySupervisor: query.data.slaConfig.notifySupervisor ?? false,
            });
        }
    }, [query.data]);

    const handleSave = () => {
        updateMutation.mutate({ slaConfig: form }, {
            onSuccess: () => {
                toast.success("Configuración SLA guardada correctamente");
            },
            onError: (e: any) => {
                toast.error(`Error: ${e.message}`);
            },
        });
    };

    // Calculate time ranges for quick presets
    const presets = [
        { label: "5 min (Urgente)", value: 5 },
        { label: "15 min (Rápido)", value: 15 },
        { label: "30 min (Normal)", value: 30 },
        { label: "1 hora (Estándar)", value: 60 },
        { label: "2 horas (Flexible)", value: 120 },
        { label: "4 horas (Bajo)", value: 240 },
    ];

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Configuración de Tiempo de Respuesta</CardTitle>
                    <CardDescription>
                        Define el tiempo máximo aceptable para responder a un cliente
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <Clock className="h-4 w-4" />
                        <AlertDescription>
                            Las alertas se generan automáticamente cuando un chat supera el tiempo definido sin respuesta.
                        </AlertDescription>
                    </Alert>

                    {/* Presets rápidos */}
                    <div className="space-y-2">
                        <Label>Presets Rápidos</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {presets.map((preset) => (
                                <Button
                                    key={preset.value}
                                    variant={form.maxResponseTimeMinutes === preset.value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setForm(p => ({ ...p, maxResponseTimeMinutes: preset.value }))}
                                >
                                    {preset.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Input personalizado */}
                    <div className="grid gap-2">
                        <Label htmlFor="responseTime">
                            Tiempo Máximo de Respuesta (minutos)
                        </Label>
                        <Input
                            id="responseTime"
                            type="number"
                            min={1}
                            max={1440}
                            value={form.maxResponseTimeMinutes}
                            onChange={(e) => setForm(p => ({ ...p, maxResponseTimeMinutes: parseInt(e.target.value) || 60 }))}
                        />
                        <p className="text-sm text-muted-foreground">
                            {form.maxResponseTimeMinutes < 60
                                ? `${form.maxResponseTimeMinutes} minutos`
                                : `${(form.maxResponseTimeMinutes / 60).toFixed(1)} horas`
                            }
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Notificaciones y Alertas</CardTitle>
                    <CardDescription>
                        Configura cómo y a quién notificar cuando se incumple el SLA
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <Mail className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <Label className="text-base">Notificar por Email</Label>
                                <p className="text-sm text-muted-foreground">
                                    Enviar alerta al supervisor cuando se incumple SLA
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={form.notifySupervisor}
                            onCheckedChange={(c) => setForm(p => ({ ...p, notifySupervisor: c }))}
                        />
                    </div>

                    {form.notifySupervisor && (
                        <div className="pl-4 border-l-2 space-y-3">
                            <div className="grid gap-2">
                                <Label htmlFor="alertEmail">Email para Alertas SLA</Label>
                                <Input
                                    id="alertEmail"
                                    type="email"
                                    placeholder="supervisor@empresa.com"
                                    value={form.alertEmail}
                                    onChange={(e) => setForm(p => ({ ...p, alertEmail: e.target.value }))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Este email recibirá notificaciones cuando una conversación exceda el tiempo de respuesta.
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Vista Previa de Configuración</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="text-sm">
                            Tiempo de respuesta: <strong>{form.maxResponseTimeMinutes} minutos</strong>
                        </span>
                    </div>

                    {form.notifySupervisor ? (
                        <div className="flex items-center gap-2">
                            <Mail className="w-5 h-5 text-blue-600" />
                            <span className="text-sm">
                                Notificaciones activas a: <strong>{form.alertEmail || "Sin configurar"}</strong>
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-yellow-600" />
                            <span className="text-sm text-muted-foreground">
                                Notificaciones por email desactivadas
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending || (form.notifySupervisor && !form.alertEmail)}
                >
                    {updateMutation.isPending ? "Guardando..." : "Guardar Configuración SLA"}
                </Button>
            </div>
        </div>
    );
}
