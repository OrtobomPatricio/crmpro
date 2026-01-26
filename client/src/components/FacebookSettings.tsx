import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Facebook, Plus } from "lucide-react";

export default function FacebookSettings() {
    const [open, setOpen] = useState(false);
    const [formData, setFormData] = useState({
        pageId: "",
        name: "",
        accessToken: "",
        pictureUrl: "",
    });

    const pagesQuery = trpc.facebook.listPages.useQuery(undefined, {
        retry: false
    });

    const connectPage = trpc.facebook.connectPage.useMutation({
        onSuccess: () => {
            toast.success("Página conectada exitosamente");
            setOpen(false);
            setFormData({ pageId: "", name: "", accessToken: "", pictureUrl: "" });
            pagesQuery.refetch();
        },
        onError: (e) => toast.error(e.message),
    });

    const disconnectPage = trpc.facebook.disconnectPage.useMutation({
        onSuccess: () => {
            toast.success("Página desconectada");
            pagesQuery.refetch();
        },
        onError: (e) => toast.error(e.message),
    });

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Facebook Pages</CardTitle>
                    <CardDescription>
                        Conectá tus páginas de Facebook para recibir mensajes y leads (Messenger/Ads).
                    </CardDescription>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Conectar Página
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Conectar Página de Facebook</DialogTitle>
                            <DialogDescription>
                                Ingresá el ID de la página y un Token de Acceso válido (Long-Lived).
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Page ID</Label>
                                <Input
                                    value={formData.pageId}
                                    onChange={(e) => setFormData(p => ({ ...p, pageId: e.target.value }))}
                                    placeholder="Ej: 10092..."
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Nombre de la Página</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Mi Negocio FB"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Access Token</Label>
                                <Input
                                    type="password"
                                    value={formData.accessToken}
                                    onChange={(e) => setFormData(p => ({ ...p, accessToken: e.target.value }))}
                                    placeholder="EAAG..."
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Foto URL (Opcional)</Label>
                                <Input
                                    value={formData.pictureUrl}
                                    onChange={(e) => setFormData(p => ({ ...p, pictureUrl: e.target.value }))}
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                onClick={() => connectPage.mutate(formData)}
                                disabled={connectPage.isPending || !formData.pageId || !formData.accessToken}
                            >
                                {connectPage.isPending ? "Conectando..." : "Guardar Conexión"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
                {pagesQuery.isLoading && <div className="text-sm">Cargando páginas...</div>}

                <div className="grid gap-4">
                    {pagesQuery.data?.map((page: any) => (
                        <div
                            key={page.id}
                            className="flex items-center justify-between p-4 border rounded-lg bg-card"
                        >
                            <div className="flex items-center gap-3">
                                {page.pictureUrl ? (
                                    <img src={page.pictureUrl} alt={page.name} className="w-10 h-10 rounded-full" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                        <Facebook className="w-6 h-6" />
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium">{page.name}</p>
                                    <p className="text-xs text-muted-foreground">ID: {page.pageId}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className={`text-xs px-2 py-1 rounded-full ${page.isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {page.isConnected ? "Conectado" : "Desconectado"}
                                </div>
                                {page.isConnected && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                        onClick={() => disconnectPage.mutate({ id: page.id })}
                                    >
                                        Desconectar
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}

                    {pagesQuery.data?.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            No hay páginas conectadas.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
