import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Play, Trash2, Edit, Zap } from "lucide-react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function WorkflowsPage() {
    const [open, setOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [editingWorkflow, setEditingWorkflow] = useState<any>(null);
    const [form, setForm] = useState({
        name: "",
        description: "",
        triggerType: "",
        action: "",
        conditions: "{}",
    });

    const { data: workflows, isLoading } = trpc.workflows.list.useQuery();
    const utils = trpc.useUtils();

    const createWorkflow = trpc.workflows.create.useMutation({
        onSuccess: () => {
            toast.success("Workflow creado");
            utils.workflows.list.invalidate();
            setOpen(false);
            resetForm();
        },
        onError: (e: any) => toast.error(`Error: ${e.message}`),
    });

    const updateWorkflow = trpc.workflows.update.useMutation({
        onSuccess: () => {
            toast.success("Workflow actualizado");
            utils.workflows.list.invalidate();
            setOpen(false);
            resetForm();
        },
        onError: (e: any) => toast.error(`Error: ${e.message}`),
    });

    const deleteWorkflow = trpc.workflows.delete.useMutation({
        onSuccess: () => {
            toast.success("Workflow eliminado");
            utils.workflows.list.invalidate();
            setDeleteId(null);
        },
        onError: (e: any) => toast.error(`Error: ${e.message}`),
    });

    const toggleWorkflow = trpc.workflows.update.useMutation({
        onSuccess: () => {
            utils.workflows.list.invalidate();
        },
    });

    const resetForm = () => {
        setForm({
            name: "",
            description: "",
            triggerType: "",
            action: "",
            conditions: "{}",
        });
        setEditingWorkflow(null);
    };

    const handleSubmit = () => {
        if (!form.name || !form.triggerType || !form.action) {
            toast.error("Nombre, Trigger y Acción son obligatorios");
            return;
        }

        const payload = {
            name: form.name,
            description: form.description || undefined,
            triggerType: form.triggerType as "lead_created" | "lead_updated" | "msg_received" | "campaign_link_clicked",
            action: form.action,
            conditions: form.conditions,
        };

        if (editingWorkflow) {
            updateWorkflow.mutate({ id: editingWorkflow.id, ...payload });
        } else {
            createWorkflow.mutate(payload);
        }
    };

    const handleEdit = (workflow: any) => {
        setEditingWorkflow(workflow);
        setForm({
            name: workflow.name,
            description: workflow.description || "",
            triggerType: workflow.triggerType,
            action: workflow.action,
            conditions: workflow.conditions || "{}",
        });
        setOpen(true);
    };

    return (
        <div className="container mx-auto p-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Zap className="w-8 h-8" />
                        Workflows & Automatización
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Automatiza procesos con reglas "If This Then That"
                    </p>
                </div>

                <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Nuevo Workflow
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>{editingWorkflow ? "Editar Workflow" : "Nuevo Workflow"}</DialogTitle>
                            <DialogDescription>
                                Crea reglas de automatización para tu CRM
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="wfName">Nombre del Workflow</Label>
                                <Input
                                    id="wfName"
                                    placeholder="ej: Notificar al crear lead"
                                    value={form.name}
                                    onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="desc">Descripción</Label>
                                <Textarea
                                    id="desc"
                                    placeholder="Describe qué hace este workflow"
                                    value={form.description}
                                    onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="trigger">Trigger (Disparador)</Label>
                                <Select
                                    value={form.triggerType}
                                    onValueChange={(v) => setForm(p => ({ ...p, triggerType: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar evento" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="lead_created">Nuevo Lead</SelectItem>
                                        <SelectItem value="lead_updated">Lead Actualizado</SelectItem>
                                        <SelectItem value="msg_received">Mensaje Recibido</SelectItem>
                                        <SelectItem value="campaign_link_clicked">Link de Campaña Clickeado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="action">Acción</Label>
                                <Input
                                    id="action"
                                    placeholder="ej: send_email, create_task, assign_to_user"
                                    value={form.action}
                                    onChange={(e) => setForm(p => ({ ...p, action: e.target.value }))}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="conditions">Condiciones (JSON)</Label>
                                <Textarea
                                    id="conditions"
                                    placeholder='{"field": "value"}'
                                    value={form.conditions}
                                    onChange={(e) => setForm(p => ({ ...p, conditions: e.target.value }))}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSubmit} disabled={createWorkflow.isPending || updateWorkflow.isPending}>
                                {createWorkflow.isPending || updateWorkflow.isPending ? "Guardando..." : editingWorkflow ? "Actualizar" : "Crear"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Lista de Workflows</CardTitle>
                    <CardDescription>
                        Gestiona tus automatizaciones activas
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center text-muted-foreground py-8">Cargando workflows...</div>
                    ) : !workflows || workflows.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No hay workflows configurados. Haz clic en "Nuevo Workflow" para crear uno.
                        </div>
                    ) : (
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Trigger</TableHead>
                                        <TableHead>Acción</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {workflows.map((workflow: any) => (
                                        <TableRow key={workflow.id}>
                                            <TableCell className="font-medium">{workflow.name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{workflow.triggerType}</Badge>
                                            </TableCell>
                                            <TableCell>{workflow.action}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={workflow.isActive}
                                                        onCheckedChange={(checked) => {
                                                            toggleWorkflow.mutate({
                                                                id: workflow.id,
                                                                isActive: checked,
                                                            });
                                                        }}
                                                    />
                                                    <span className="text-sm">
                                                        {workflow.isActive ? "Activo" : "Inactivo"}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(workflow)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive"
                                                        onClick={() => setDeleteId(workflow.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar workflow?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará el workflow permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => deleteId && deleteWorkflow.mutate({ id: deleteId })}
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
