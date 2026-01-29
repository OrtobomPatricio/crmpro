import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, CheckCircle2, XCircle, Phone } from "lucide-react";
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

export function WhatsAppConnectionsList() {
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data: connections, isLoading } = trpc.whatsapp.list.useQuery();
    const utils = trpc.useUtils();

    const deleteMutation = trpc.whatsapp.delete.useMutation({
        onSuccess: () => {
            toast.success("Conexión eliminada");
            utils.whatsapp.list.invalidate();
            setDeleteId(null);
        },
        onError: (e) => {
            toast.error(`Error: ${e.message}`);
        },
    });

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">Cargando conexiones...</div>;
    }

    if (!connections || connections.length === 0) {
        return (
            <div className="text-center py-8 border rounded-lg bg-muted/30">
                <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No hay conexiones de WhatsApp configuradas</p>
                <p className="text-xs text-muted-foreground mt-1">Haz clic en "Agregar Cuenta" para comenzar</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-3">
                {connections.map((conn) => (
                    <div
                        key={conn.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                                <Phone className="w-6 h-6 text-[#25D366]" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-medium">{conn.number?.displayName || "Sin nombre"}</p>
                                    {conn.isConnected ? (
                                        <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Activa
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-muted-foreground flex items-center gap-1">
                                            <XCircle className="w-3 h-3" />
                                            Desconectada
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {conn.number?.phoneNumber || "Sin número"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Phone ID: {conn.phoneNumberId}
                                </p>
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteId(conn.id)}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                ))}
            </div>

            <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar conexión?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente la conexión de WhatsApp. Las conversaciones asociadas se mantendrán.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
