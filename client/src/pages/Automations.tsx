
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    MoreHorizontal,
    Plus,
    Trash2,
    Zap,
    Edit,
    PlayCircle
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Automations() {
    const [, setLocation] = useLocation();
    const utils = trpc.useUtils();
    const { data: workflows, isLoading } = trpc.workflows.list.useQuery();

    const toggleWorkflow = trpc.workflows.toggle.useMutation({
        onSuccess: () => {
            utils.workflows.list.invalidate();
            toast.success("Estado actualizado");
        },
        onError: (err) => toast.error(err.message),
    });

    const deleteWorkflow = trpc.workflows.delete.useMutation({
        onSuccess: () => {
            utils.workflows.list.invalidate();
            toast.success("Automatización eliminada");
        },
    });

    const formatDate = (date: string | Date | null | undefined) => {
        if (!date) return "-";
        try {
            return format(new Date(date), "PP", { locale: es });
        } catch (e) {
            return "-";
        }
    };

    const getTriggerLabel = (type: string) => {
        const labels: Record<string, string> = {
            lead_created: "Nuevo Lead",
            lead_updated: "Lead Actualizado",
            msg_received: "Mensaje Recibido",
            campaign_link_clicked: "Clic en Enlace"
        };
        return labels[type] || type;
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Automatizaciones</h1>
                        <p className="text-muted-foreground">
                            Define reglas automáticas para optimizar tu flujo de trabajo (IFTTT)
                        </p>
                    </div>
                    <Button onClick={() => setLocation("/automations/new")}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva Regla
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Reglas Activas</CardTitle>
                        <CardDescription>
                            Gestiona tus flujos de automatización.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : workflows?.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Zap className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No tienes automatizaciones configuradas.</p>
                                <Button variant="link" onClick={() => setLocation("/automations/new")}>Crear la primera</Button>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Disparador</TableHead>
                                        <TableHead>Acciones</TableHead>
                                        <TableHead>Creada</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="text-right">Opciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {workflows?.map((wf) => (
                                        <TableRow key={wf.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{wf.name}</span>
                                                    <span className="text-xs text-muted-foreground">{wf.description}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="flex w-fit items-center gap-1">
                                                    <PlayCircle className="h-3 w-3" />
                                                    {getTriggerLabel(wf.triggerType)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">
                                                    {(wf.actions as any[])?.length || 0} acciones
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{formatDate(wf.createdAt)}</TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={wf.isActive}
                                                    onCheckedChange={(checked) => toggleWorkflow.mutate({ id: wf.id, isActive: checked })}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {/* <DropdownMenuItem onClick={() => setLocation(`/automations/${wf.id}`)}>
                                <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem> */}
                                                        <DropdownMenuItem className="text-red-600" onClick={() => deleteWorkflow.mutate({ id: wf.id })}>
                                                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
