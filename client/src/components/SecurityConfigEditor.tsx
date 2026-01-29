import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

interface SecurityConfigEditorProps {
    query: any;
    updateMutation: any;
}

export function SecurityConfigEditor({ query, updateMutation }: SecurityConfigEditorProps) {
    const [form, setForm] = useState({
        allowedIps: "",
        maxLoginAttempts: 5,
        sessionTimeoutMinutes: 60,
    });

    useEffect(() => {
        if (query.data?.securityConfig) {
            setForm({
                allowedIps: query.data.securityConfig.allowedIps?.join(", ") || "",
                maxLoginAttempts: query.data.securityConfig.maxLoginAttempts || 5,
                sessionTimeoutMinutes: query.data.securityConfig.sessionTimeoutMinutes || 60,
            });
        }
    }, [query.data]);

    const handleSave = () => {
        const allowedIpsArray = form.allowedIps
            .split(",")
            .map(ip => ip.trim())
            .filter(ip => ip.length > 0);

        updateMutation.mutate({
            securityConfig: {
                allowedIps: allowedIpsArray,
                maxLoginAttempts: form.maxLoginAttempts,
                sessionTimeoutMinutes: form.sessionTimeoutMinutes,
            },
        }, {
            onSuccess: () => toast.success("Configuración de seguridad guardada"),
            onError: (e: any) => toast.error(`Error: ${e.message}`),
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    configuración de Seguridad Avanzada
                </CardTitle>
                <CardDescription>
                    Ajustes de control de acceso y restricciones de seguridad
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor="allowedIps">IPs Permitidas (separadas por coma)</Label>
                    <Textarea
                        id="allowedIps"
                        placeholder="192.168.1.100, 10.0.0.50 (dejar vacío para permitir todas)"
                        value={form.allowedIps}
                        onChange={(e) => setForm(p => ({ ...p, allowedIps: e.target.value }))}
                        rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                        Si configuras IPs, solo esas direcciones podrán acceder al CRM
                    </p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="maxAttempts">Máximo de Intentos de Login</Label>
                    <Input
                        id="maxAttempts"
                        type="number"
                        min={1}
                        max={20}
                        value={form.maxLoginAttempts}
                        onChange={(e) => setForm(p => ({ ...p, maxLoginAttempts: parseInt(e.target.value) || 5 }))}
                    />
                    <p className="text-xs text-muted-foreground">
                        Bloquea temporalmente al usuario tras N intentos fallidos
                    </p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="sessionTimeout">Timeout de Sesión (minutos)</Label>
                    <Input
                        id="sessionTimeout"
                        type="number"
                        min={5}
                        max={1440}
                        value={form.sessionTimeoutMinutes}
                        onChange={(e) => setForm(p => ({ ...p, sessionTimeoutMinutes: parseInt(e.target.value) || 60 }))}
                    />
                    <p className="text-xs text-muted-foreground">
                        Cierra la sesión automáticamente tras este tiempo de inactividad
                    </p>
                </div>

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? "Guardando..." : "Guardar Configuración"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
