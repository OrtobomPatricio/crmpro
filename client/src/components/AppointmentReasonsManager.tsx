import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Calendar } from "lucide-react";
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

export function AppointmentReasonsManager() {
    const [open, setOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [form, setForm] = useState({
        name: "",
        color: "#3b82f6",
    });

    const { data: reasons, isLoading } = trpc.scheduling?.reasons?.list?.useQuery() || { data: [], isLoading: false };
    const utils = trpc.useUtils();

    const createReason = trpc.scheduling?.reasons?.create?.useMutation({
        onSuccess: () => {
            toast.success("Tipo de cita creado");
            utils.scheduling.reasons.list.invalidate();
            setOpen(false);
            setForm({ name: "", color: "#3b82f6" });
        },
        onError: (e: any) => toast.error(`Error: ${e.message}`),
    }) || { mutate: () => { }, isPending: false };

    const deleteReason = trpc.scheduling?.reasons?.delete?.useMutation({
        onSuccess: () => {
            toast.success("Tipo eliminado");
            utils.scheduling.reasons.list.invalidate();
            setDeleteId(null);
        },
        onError: (e: any) => toast.error(`Error: ${e.message}`),
    }) || { mutate: () => { }, isPending: false };

    const handleSubmit = () => {
        if (!form.name) {
            toast.error("El nombre es obligatorio");
            return;
        }
        createReason.mutate(form);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            Tipos de Citas
                        </CardTitle>
                        <CardDescription>
                            Administra los tipos de citas disponibles en la agenda
                        </CardDescription>
                    </div>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Nuevo Tipo
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Nuevo Tipo de Cita</DialogTitle>
                                <DialogDescription>
                                    Define un nuevo tipo de cita para la agenda
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="reasonName">Nombre</Label>
                                    <Input
                                        id="reasonName"
                                        placeholder="ej: Consulta Inicial"
                                        value={form.name}
                                        onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="color">Color</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="color"
                                            type="color"
                                            value={form.color}
                                            onChange={(e) => setForm(p => ({ ...p, color: e.target.value }))}
                                            className="w-20"
                                        />
                                        <Input
                                            value={form.color}
                                            onChange={(e) => setForm(p => ({ ...p, color: e.target.value }))}
                                            placeholder="#3b82f6"
                                        />
                                    </div>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                                <Button onClick={handleSubmit} disabled={createReason.isPending}>
                                    {createReason.isPending ? "Creando..." : "Crear"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-sm text-muted-foreground">Cargando tipos...</div>
                ) : !reasons || reasons.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No hay tipos de citas. Haz clic en "Nuevo Tipo" para crear uno.
                    </div>
                ) : (
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Color</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reasons.map((reason: any) => (
                                    <TableRow key={reason.id}>
                                        <TableCell>
                                            <div
                                                className="w-6 h-6 rounded"
                                                style={{ backgroundColor: reason.color || "#3b82f6" }}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{reason.name}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive"
                                                onClick={() => setDeleteId(reason.id)}
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
                            <AlertDialogTitle>¿Eliminar tipo de cita?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción eliminará el tipo de cita permanentemente.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => deleteId && deleteReason.mutate({ id: deleteId })}
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
