import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function AddEmailDialog() {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        name: "",
        host: "",
        port: 587,
        secure: false,
        user: "",
        password: "",
        fromEmail: "",
        fromName: "",
    });

    const utils = trpc.useUtils();
    const createMutation = trpc.smtp.create.useMutation({
        onSuccess: () => {
            toast.success("Conexión de email agregada correctamente");
            utils.smtp.list.invalidate();
            setOpen(false);
            setForm({
                name: "",
                host: "",
                port: 587,
                secure: false,
                user: "",
                password: "",
                fromEmail: "",
                fromName: "",
            });
        },
        onError: (e) => {
            toast.error(`Error: ${e.message}`);
        },
    });

    const handleSubmit = () => {
        if (!form.name || !form.host || !form.user || !form.password) {
            toast.error("Nombre, host, usuario y contraseña son obligatorios");
            return;
        }
        createMutation.mutate(form);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Email
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Agregar Conexión de Email (SMTP)</DialogTitle>
                    <DialogDescription>
                        Configura una cuenta de email para enviar invitaciones y notificaciones.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre de la Conexión</Label>
                        <Input
                            id="name"
                            placeholder="ej: Gmail Ventas"
                            value={form.name}
                            onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="host">Host SMTP</Label>
                            <Input
                                id="host"
                                placeholder="smtp.gmail.com"
                                value={form.host}
                                onChange={(e) => setForm(p => ({ ...p, host: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="port">Puerto</Label>
                            <Input
                                id="port"
                                type="number"
                                placeholder="587"
                                value={form.port}
                                onChange={(e) => setForm(p => ({ ...p, port: parseInt(e.target.value) || 587 }))}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <Label>Conexión Segura (SSL/TLS)</Label>
                            <p className="text-xs text-muted-foreground">
                                Activa para puerto 465, desactiva para 587
                            </p>
                        </div>
                        <Switch
                            checked={form.secure}
                            onCheckedChange={(checked) => setForm(p => ({ ...p, secure: checked }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="user">Usuario / Email</Label>
                        <Input
                            id="user"
                            type="email"
                            placeholder="ventas@tuempresa.com"
                            value={form.user}
                            onChange={(e) => setForm(p => ({ ...p, user: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={form.password}
                            onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                            Para Gmail, usa una Contraseña de Aplicación
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="fromEmail">Email "From" (opcional)</Label>
                        <Input
                            id="fromEmail"
                            type="email"
                            placeholder="noreply@tuempresa.com"
                            value={form.fromEmail}
                            onChange={(e) => setForm(p => ({ ...p, fromEmail: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="fromName">Nombre "From" (opcional)</Label>
                        <Input
                            id="fromName"
                            placeholder="Tu Empresa CRM"
                            value={form.fromName}
                            onChange={(e) => setForm(p => ({ ...p, fromName: e.target.value }))}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                        {createMutation.isPending ? "Agregando..." : "Agregar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
