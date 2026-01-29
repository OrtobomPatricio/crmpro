import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function AddWhatsAppDialog() {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        displayName: "",
        phoneNumber: "",
        phoneNumberId: "",
        accessToken: "",
        businessAccountId: "",
    });

    const utils = trpc.useUtils();
    const connectMutation = trpc.whatsapp.connect.useMutation({
        onSuccess: () => {
            toast.success("Conexión agregada correctamente");
            utils.whatsapp.list.invalidate();
            setOpen(false);
            setForm({
                displayName: "",
                phoneNumber: "",
                phoneNumberId: "",
                accessToken: "",
                businessAccountId: "",
            });
        },
        onError: (e) => {
            toast.error(`Error: ${e.message}`);
        },
    });

    const handleSubmit = () => {
        if (!form.displayName || !form.phoneNumber || !form.phoneNumberId || !form.accessToken || !form.businessAccountId) {
            toast.error("Todos los campos son obligatorios");
            return;
        }
        connectMutation.mutate(form);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-[#25D366] hover:bg-[#20BA5A]">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Cuenta
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Agregar Conexión de WhatsApp</DialogTitle>
                    <DialogDescription>
                        Ingresa los datos de tu cuenta de WhatsApp Business desde Meta Business Suite.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="displayName">Nombre de la Conexión</Label>
                        <Input
                            id="displayName"
                            placeholder="ej: WhatsApp Ventas"
                            value={form.displayName}
                            onChange={(e) => setForm(p => ({ ...p, displayName: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phoneNumber">Número de Teléfono</Label>
                        <Input
                            id="phoneNumber"
                            placeholder="ej: +595981234567"
                            value={form.phoneNumber}
                            onChange={(e) => setForm(p => ({ ...p, phoneNumber: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                        <Input
                            id="phoneNumberId"
                            placeholder="Obtén esto de Meta Business Suite"
                            value={form.phoneNumberId}
                            onChange={(e) => setForm(p => ({ ...p, phoneNumberId: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                            Lo encuentras en: Meta Business Suite → Números de teléfono
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="businessAccountId">Business Account ID (WABA ID)</Label>
                        <Input
                            id="businessAccountId"
                            placeholder="ID de cuenta de negocio"
                            value={form.businessAccountId}
                            onChange={(e) => setForm(p => ({ ...p, businessAccountId: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="accessToken">Access Token</Label>
                        <Input
                            id="accessToken"
                            type="password"
                            placeholder="Token de acceso de la aplicación"
                            value={form.accessToken}
                            onChange={(e) => setForm(p => ({ ...p, accessToken: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                            Token permanente generado en Meta for Developers
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={connectMutation.isPending}>
                        {connectMutation.isPending ? "Conectando..." : "Conectar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
