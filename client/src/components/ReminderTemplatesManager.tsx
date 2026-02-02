import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Bell } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";
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

export function ReminderTemplatesManager() {
    const [open, setOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<any>(null);
    const [form, setForm] = useState({
        name: "",
        body: "",
        triggerBefore: 60,
    });

    // Nota: Este router necesita ser implementado en el backend
    const { data: templates, isLoading } = trpc.scheduling.getTemplates.useQuery();
    const utils = trpc.useUtils();

    const createTemplate = trpc.scheduling.saveTemplate.useMutation({
        onSuccess: () => {
            toast.success("Plantilla guardada");
            utils.scheduling.getTemplates.invalidate();
            setOpen(false);
            resetForm();
        },
        onError: (e: any) => toast.error(`Error: ${e.message}`),
    });

    const deleteTemplate = trpc.scheduling.deleteTemplate.useMutation({
        onSuccess: () => {
            toast.success("Plantilla eliminada");
            utils.scheduling.getTemplates.invalidate();
            setDeleteId(null);
        },
        onError: (e: any) => toast.error(`Error: ${e.message}`),
    });

    const resetForm = () => {
        setForm({ name: "", body: "", triggerBefore: 60 });
        setEditingTemplate(null);
    };

    const handleSubmit = () => {
        if (!form.name || !form.body) {
            toast.error("Nombre y contenido son obligatorios");
            return;
        }
        createTemplate.mutate({
            name: form.name,
            content: form.body,
            daysBefore: form.triggerBefore, // Mapping UI 'Minutos' to server param (renaming needed in server later if strictly days)
        });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="w-5 h-5" />
                            Plantillas de Recordatorios
                        </CardTitle>
                        <CardDescription>
                            Crea plantillas reutilizables para recordatorios de citas
                        </CardDescription>
                    </div>
                    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Nueva Plantilla
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Nueva Plantilla de Recordatorio</DialogTitle>
                                <DialogDescription>
                                    Crea un mensaje que se enviará antes de las citas
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="templateName">Nombre</Label>
                                    <Input
                                        id="templateName"
                                        placeholder="ej: Recordatorio Estándar"
                                        value={form.name}
                                        onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="triggerBefore">Minutos antes de la cita</Label>
                                    <Input
                                        id="triggerBefore"
                                        type="number"
                                        value={form.triggerBefore}
                                        onChange={(e) => setForm(p => ({ ...p, triggerBefore: parseInt(e.target.value) }))}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="body">Contenido del Mensaje</Label>
                                    <Textarea
                                        id="body"
                                        placeholder="Hola {nombre}, te recordamos tu cita..."
                                        rows={4}
                                        value={form.body}
                                        onChange={(e) => setForm(p => ({ ...p, body: e.target.value }))}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Variables: {"{nombre}"}, {"{fecha}"}, {"{hora}"}
                                    </p>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                                <Button onClick={handleSubmit} disabled={createTemplate.isPending}>
                                    {createTemplate.isPending ? "Creando..." : "Crear"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-sm text-muted-foreground">Cargando plantillas...</div>
                ) : !templates || templates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No hay plantillas de recordatorios. Haz clic en "Nueva Plantilla" para crear una.
                    </div>
                ) : (
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Minutos antes</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {templates.map((template: any) => (
                                    <TableRow key={template.id}>
                                        <TableCell className="font-medium">{template.name}</TableCell>
                                        <TableCell>{template.triggerBefore} min</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive"
                                                onClick={() => setDeleteId(template.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción eliminará la plantilla permanentemente.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => deleteId && deleteTemplate.mutate({ id: deleteId })}
                            >
                                Eliminar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}
