import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function AddUserDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [isInvite, setIsInvite] = useState(true); // Default to invite
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "agent" as "admin" | "supervisor" | "agent" | "viewer",
    });

    const createUser = trpc.team.create.useMutation({
        onSuccess: () => {
            toast.success("Usuario creado exitosamente");
            setOpen(false);
            setFormData({ name: "", email: "", password: "", role: "agent" });
            onSuccess();
        },
        onError: (e) => toast.error(e.message),
    });

    const inviteUser = trpc.team.invite.useMutation({
        onSuccess: () => {
            toast.success("Invitación enviada exitosamente");
            setOpen(false);
            setFormData({ name: "", email: "", password: "", role: "agent" });
            onSuccess();
        },
        onError: (e) => toast.error(e.message),
    });

    const handleSubmit = () => {
        if (!formData.name || !formData.email) {
            toast.error("Nombre y Email son requeridos");
            return;
        }

        if (isInvite) {
            inviteUser.mutate({
                name: formData.name,
                email: formData.email,
                role: formData.role
            });
        } else {
            if (!formData.password) {
                toast.error("La contraseña es requerida para creación manual");
                return;
            }
            createUser.mutate(formData);
        }
    };

    const isPending = createUser.isPending || inviteUser.isPending;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Usuario
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nuevo Usuario</DialogTitle>
                    <DialogDescription>
                        Invitá a un miembro del equipo o crealo manualmente.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center space-x-2 pb-4">
                    <Switch id="invite-mode" checked={isInvite} onCheckedChange={setIsInvite} />
                    <Label htmlFor="invite-mode">Enviar invitación por correo</Label>
                </div>

                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                            placeholder="Juan Pérez"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                            placeholder="juan@empresa.com"
                        />
                    </div>

                    {!isInvite && (
                        <div className="grid gap-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                                placeholder="••••••••"
                            />
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label>Rol</Label>
                        <Select
                            value={formData.role}
                            onValueChange={(v) => setFormData(p => ({ ...p, role: v as any }))}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                                <SelectItem value="agent">Agente</SelectItem>
                                <SelectItem value="viewer">Solo lectura</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={isPending}>
                        {isPending ? "Procesando..." : (isInvite ? "Enviar Invitación" : "Crear Usuario")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
