import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function AddFacebookDialog() {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        name: "",
        pageId: "",
        accessToken: "",
        pictureUrl: "",
    });

    const utils = trpc.useUtils();
    const connectMutation = trpc.facebook.connectPage.useMutation({
        onSuccess: () => {
            toast.success("Página de Facebook conectada");
            utils.facebook.listPages.invalidate();
            setOpen(false);
            setForm({ name: "", pageId: "", accessToken: "", pictureUrl: "" });
        },
        onError: (e) => {
            toast.error(`Error: ${e.message}`);
        },
    });

    const handleSubmit = () => {
        if (!form.name || !form.pageId || !form.accessToken) {
            toast.error("Nombre, Page ID y Access Token son obligatorios");
            return;
        }
        connectMutation.mutate(form);
    };

    return (
        <Dialog open={open} onValueChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Facebook
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Conectar Página de Facebook</DialogTitle>
                    <DialogDescription>
                        Conecta una página de Facebook para gestionar mensajes desde el CRM
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label html For="fbName">Nombre de la Página</Label>
                        <Input
                            id="fbName"
                            placeholder="ej: Mi Empresa"
                            value={form.name}
                            onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pageId">Page ID</Label>
                        <Input
                            id="pageId"
                            placeholder="123456789012345"
                            value={form.pageId}
                            onChange={(e) => setForm(p => ({ ...p, pageId: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                            Lo encuentras en la configuración de tu página de Facebook
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="fbAccessToken">Access Token</Label>
                        <Input
                            id="fbAccessToken"
                            type="password"
                            placeholder="EAAxxxxxxxxxx..."
                            value={form.accessToken}
                            onChange={(e) => setForm(p => ({ ...p, accessToken: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                            Token de acceso de tu app de Facebook
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pictureUrl">URL de Imagen (opcional)</Label>
                        <Input
                            id="pictureUrl"
                            placeholder="https://..."
                            value={form.pictureUrl}
                            onChange={(e) => setForm(p => ({ ...p, pictureUrl: e.target.value }))}
                        />
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
