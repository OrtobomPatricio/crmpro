import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Facebook } from "lucide-react";
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

export function FacebookPagesList() {
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data: pages, isLoading } = trpc.facebook.listPages.useQuery();
    const utils = trpc.useUtils();

    const disconnectMutation = trpc.facebook.disconnectPage.useMutation({
        onSuccess: () => {
            toast.success("Página desconectada");
            utils.facebook.listPages.invalidate();
            setDeleteId(null);
        },
        onError: (e) => {
            toast.error(`Error: ${e.message}`);
        },
    });

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">Cargando páginas...</div>;
    }

    if (!pages || pages.length === 0) {
        return (
            <div className="text-center py-8 border rounded-lg bg-muted/30">
                <Facebook className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No hay páginas de Facebook conectadas</p>
                <p className="text-xs text-muted-foreground mt-1">Haz clic en "Agregar Facebook" para comenzar</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-3">
                {pages.map((page) => (
                    <div
                        key={page.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-600/10 flex items-center justify-center">
                                {page.pictureUrl ? (
                                    <img src={page.pictureUrl} alt={page.name} className="w-12 h-12 rounded-full" />
                                ) : (
                                    <Facebook className="w-6 h-6 text-blue-600" />
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="font-medium">{page.name}</p>
                                    {page.isConnected && (
                                        <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20">
                                            Conectada
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Page ID: {page.pageId}
                                </p>
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteId(page.id)}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                ))}
            </div>

            <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desconectar página de Facebook?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción desconectará la página. No podrás recibir mensajes desde esta página.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => deleteId && disconnectMutation.mutate({ id: deleteId })}
                            disabled={disconnectMutation.isPending}
                        >
                            {disconnectMutation.isPending ? "Desconectando..." : "Desconectar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
