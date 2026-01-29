import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Mail, CheckCircle2, XCircle, Star, TestTube } from "lucide-react";
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

export function EmailConnectionsList() {
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data: connections, isLoading } = trpc.smtp.list.useQuery();
    const utils = trpc.useUtils();

    const deleteMutation = trpc.smtp.delete.useMutation({
        onSuccess: () => {
            toast.success("Conexión eliminada");
            utils.smtp.list.invalidate();
            setDeleteId(null);
        },
        onError: (e) => {
            toast.error(`Error: ${e.message}`);
        },
    });

    const testMutation = trpc.smtp.test.useMutation({
        onSuccess: () => {
            toast.success("Conexión probada exitosamente");
            utils.smtp.list.invalidate();
        },
        onError: (e) => {
            toast.error(`Prueba fallida: ${e.message}`);
            utils.smtp.list.invalidate();
        },
    });

    const setDefaultMutation = trpc.smtp.setDefault.useMutation({
        onSuccess: () => {
            toast.success("Conexión marcada como predeterminada");
            utils.smtp.list.invalidate();
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
                <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No hay conexiones de email configuradas</p>
                <p className="text-xs text-muted-foreground mt-1">Haz clic en "Agregar Email" para comenzar</p>
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
                            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <Mail className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-medium">{conn.name}</p>
                                    {conn.isDefault && (
                                        <Badge className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 flex items-center gap-1">
                                            <Star className="w-3 h-3 fill-current" />
                                            Predeterminada
                                        </Badge>
                                    )}
                                    {conn.testStatus === "success" && (
                                        <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Probada
                                        </Badge>
                                    )}
                                    {conn.testStatus === "failed" && (
                                        <Badge variant="outline" className="text-destructive flex items-center gap-1">
                                            <XCircle className="w-3 h-3" />
                                            Fallo
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {conn.user} • {conn.host}:{conn.port}
                                </p>
                                {conn.fromEmail && (
                                    <p className="text-xs text-muted-foreground">
                                        From: {conn.fromName || conn.fromEmail}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => testMutation.mutate({ id: conn.id })}
                                disabled={testMutation.isPending}
                            >
                                <TestTube className="w-4 h-4 mr-1" />
                                Probar
                            </Button>

                            {!conn.isDefault && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDefaultMutation.mutate({ id: conn.id })}
                                    disabled={setDefaultMutation.isPending}
                                >
                                    <Star className="w-4 h-4 mr-1" />
                                    Predeterminar
                                </Button>
                            )}

                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteId(conn.id)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar conexión de email?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente la conexión SMTP. No podrás enviar emails desde esta cuenta.
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
