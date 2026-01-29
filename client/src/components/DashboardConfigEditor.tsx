import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function DashboardConfigEditor() {
    const query = trpc.settings.get.useQuery();
    const utils = trpc.useUtils();
    const mutation = trpc.settings.updateDashboardConfig.useMutation({
        onSuccess: () => {
            toast.success("Dashboard actualizado");
            utils.settings.get.invalidate();
        }
    });

    const [config, setConfig] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (query.data?.dashboardConfig) {
            setConfig(query.data.dashboardConfig as Record<string, boolean>);
        }
    }, [query.data]);

    // Default actions list
    const actions = [
        { key: "leads", label: "Gestionar Leads" },
        { key: "campaigns", label: "Crear Campaña" },
        { key: "conversations", label: "Conversaciones" },
        { key: "attendants", label: "Atendentes" },
        { key: "health", label: "Salud de Cuentas" },
        { key: "whatsapp", label: "Cuentas WhatsApp" },
        { key: "integrations", label: "Integraciones" },
        { key: "kanban", label: "Kanban Board" },
        { key: "commissions", label: "Comisiones" },
        { key: "goals", label: "Metas de Vendas" },
        { key: "achievements", label: "Logros" },
        { key: "warmup", label: "Warm-up" },
        { key: "analytics", label: "Analytics" },
        { key: "scheduling", label: "Agendamiento" },
        { key: "monitoring", label: "Monitoreo en Vivo" },
    ];

    const handleToggle = (key: string, val: boolean) => {
        const next = { ...config, [key]: val };
        setConfig(next);
        mutation.mutate(next);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Personalizar Dashboard</CardTitle>
                <CardDescription>Oculta o muestra las tarjetas de acceso rápido.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {actions.map(action => (
                        <div key={action.key} className="flex items-center gap-2 border p-3 rounded-lg">
                            <Switch
                                checked={config[action.key] !== false} // Default true
                                onCheckedChange={(c) => handleToggle(action.key, c)}
                            />
                            <span className="text-sm font-medium">{action.label}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
