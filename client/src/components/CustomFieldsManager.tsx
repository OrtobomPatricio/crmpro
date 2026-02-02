import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit } from "lucide-react";
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

export function CustomFieldsManager() {
    const [open, setOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [editingField, setEditingField] = useState<any>(null);
    const [form, setForm] = useState({
        name: "",
        fieldType: "text" as "text" | "number" | "date" | "select",
        options: "",
        entityType: "lead" as "lead" | "contact",
        isRequired: false,
    });

    const { data: fields, isLoading } = trpc.customFields.list.useQuery();
    const utils = trpc.useUtils();

    const createField = trpc.customFields.create.useMutation({
        onSuccess: () => {
            toast.success("Campo personalizado creado");
            utils.customFields.list.invalidate();
            setOpen(false);
            resetForm();
        },
        onError: (e: any) => toast.error(`Error: ${e.message}`),
    });

    const updateField = trpc.customFields.update.useMutation({
        onSuccess: () => {
            toast.success("Campo actualizado");
            utils.customFields.list.invalidate();
            setOpen(false);
            resetForm();
        },
        onError: (e: any) => toast.error(`Error: ${e.message}`),
    });

    const deleteField = trpc.customFields.delete.useMutation({
        onSuccess: () => {
            toast.success("Campo eliminado");
            utils.customFields.list.invalidate();
            setDeleteId(null);
        },
        onError: (e: any) => toast.error(`Error: ${e.message}`),
    });

    const resetForm = () => {
        setForm({
            name: "",
            fieldType: "text",
            options: "",
            entityType: "lead",
            isRequired: false,
        });
        setEditingField(null);
    };

    const handleSubmit = () => {
        if (!form.name) {
            toast.error("El nombre es obligatorio");
            return;
        }

        const payload: any = {
            name: form.name,
            type: form.fieldType,
            entityType: form.entityType,
            isRequired: form.isRequired,
        };

        if (form.fieldType === "select" && form.options) {
            payload.options = JSON.stringify(form.options.split(",").map(o => o.trim()));
        }

        if (editingField) {
            updateField.mutate({ id: editingField.id, ...payload });
        } else {
            createField.mutate(payload);
        }
    };

    const handleEdit = (field: any) => {
        setEditingField(field);
        setForm({
            name: field.name,
            fieldType: field.type,
            options: field.options ? JSON.parse(field.options).join(", ") : "",
            entityType: field.entityType,
            isRequired: field.isRequired || false,
        });
        setOpen(true);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Campos Personalizados</CardTitle>
                        <CardDescription>
                            Define campos adicionales para leads y contactos
                        </CardDescription>
                    </div>
                    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Nuevo Campo
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingField ? "Editar Campo" : "Nuevo Campo Personalizado"}</DialogTitle>
                                <DialogDescription>
                                    Agrega campos dinámicos a tus registros
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Nombre del Campo</Label>
                                    <Input
                                        id="name"
                                        placeholder="ej: Fecha de Nacimiento"
                                        value={form.name}
                                        onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label>Tipo de Campo</Label>
                                    <Select value={form.fieldType} onValueChange={(v: any) => setForm(p => ({ ...p, fieldType: v }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="text">Texto</SelectItem>
                                            <SelectItem value="number">Número</SelectItem>
                                            <SelectItem value="date">Fecha</SelectItem>
                                            <SelectItem value="select">Lista Desplegable</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {form.fieldType === "select" && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="options">Opciones (separadas por coma)</Label>
                                        <Input
                                            id="options"
                                            placeholder="ej: Opción 1, Opción 2, Opción 3"
                                            value={form.options}
                                            onChange={(e) => setForm(p => ({ ...p, options: e.target.value }))}
                                        />
                                    </div>
                                )}

                                <div className="grid gap-2">
                                    <Label>Aplicar a</Label>
                                    <Select value={form.entityType} onValueChange={(v: any) => setForm(p => ({ ...p, entityType: v }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="lead">Leads</SelectItem>
                                            <SelectItem value="contact">Contactos</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                                <Button onClick={handleSubmit} disabled={createField.isPending || updateField.isPending}>
                                    {createField.isPending || updateField.isPending ? "Guardando..." : editingField ? "Actualizar" : "Crear"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-sm text-muted-foreground">Cargando campos...</div>
                ) : !fields || fields.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No hay campos personalizados. Haz clic en "Nuevo Campo" para crear uno.
                    </div>
                ) : (
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Aplica a</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field) => (
                                    <TableRow key={field.id}>
                                        <TableCell className="font-medium">{field.name}</TableCell>
                                        <TableCell className="capitalize">{field.type}</TableCell>
                                        <TableCell className="capitalize">{field.entityType}s</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(field)}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive"
                                                    onClick={() => setDeleteId(field.id)}
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

                <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar campo personalizado?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción eliminará el campo y todos sus datos asociados.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => deleteId && deleteField.mutate({ id: deleteId })}
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
