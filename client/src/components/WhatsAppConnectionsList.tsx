import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, CheckCircle2, XCircle, Phone, Plus, QrCode, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import QRCode from "react-qr-code";
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
    const [showModal, setShowModal] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isGeneratingQr, setIsGeneratingQr] = useState(false);
    const [selectedNumberId, setSelectedNumberId] = useState<number | null>(null);

    const { data: connections, isLoading } = trpc.whatsapp.list.useQuery();
    const utils = trpc.useUtils();

    const generateQrMutation = trpc.whatsappConnections.generateQr.useMutation({
        onSuccess: (data) => {
            setQrCode(data.qrCode || null); // Ensure string | null
            setIsGeneratingQr(false);
            if (data.qrCode) {
                toast.success("Código QR generado. Escanéalo con tu celular.");
            } else {
                toast.warning("El código QR no se generó correctamente.");
            }
        },
        onError: (err) => {
            setIsGeneratingQr(false);
            toast.error("Error al generar QR: " + err.message);
        }
    });

    const handleConnectQR = (numberId: number) => {
        setSelectedNumberId(numberId);
        setShowQrModal(true);
        setIsGeneratingQr(true);
        setQrCode(null);
        // Assuming generateQr is the correct procedure name based on previous context
        generateQrMutation.mutate({ whatsappNumberId: numberId });
    };

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
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Conexiones WhatsApp</h2>
                <Dialog open={showModal} onOpenChange={setShowModal}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Número
                        </Button>
                    </DialogTrigger>
                    {/* ... New Number Dialog form placeholders ... */}
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Agregar Nuevo Número</DialogTitle>
                        </DialogHeader>
                        <div className="p-4 text-center">
                            <p className="text-muted-foreground mb-4">Para conectar un número, usa el botón "Ver QR" en las tarjetas de abajo.</p>
                            <Button onClick={() => handleConnectQR(Date.now())} disabled>
                                Iniciar Conexión Manual
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* QR Code Modal */}
                <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Escanear Código QR</DialogTitle>
                            <DialogDescription>
                                Abre WhatsApp en tu teléfono, ve a Dispositivos vinculados {'>'} Vincular un dispositivo.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col items-center justify-center p-6 space-y-4">
                            {isGeneratingQr ? (
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                                    <p className="text-sm text-slate-500">Generando código seguro...</p>
                                </div>
                            ) : qrCode ? (
                                <div className="bg-white p-4 rounded-xl shadow-inner border">
                                    <QRCode value={qrCode} size={256} />
                                </div>
                            ) : (
                                <div className="text-center text-red-500">
                                    <p>No se pudo cargar el QR.</p>
                                    <Button variant="outline" size="sm" onClick={() => selectedNumberId && handleConnectQR(selectedNumberId)} className="mt-2">
                                        Reintentar
                                    </Button>
                                </div>
                            )}

                            <div className="text-xs text-slate-400 text-center max-w-[250px]">
                                <p>Este código expira en 60 segundos.</p>
                                <p className="mt-1 text-orange-500 font-medium">⚠️ Advertencia: Usa esta función con precaución para evitar bloqueos.</p>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {connections?.map((num) => (
                    <Card key={num.id}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {num.number?.phoneNumber || "Sin número"}
                            </CardTitle>
                            <Badge variant={num.isConnected ? 'default' : 'secondary'}>
                                {num.isConnected ? 'Conectado' : 'Desconectado'}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xs text-muted-foreground mt-2 mb-4">
                                {num.number?.displayName || "Sin nombre"}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleConnectQR(num.id)}
                                    disabled={num.isConnected}
                                >
                                    <QrCode className="h-4 w-4 mr-2" />
                                    {num.isConnected ? 'Vinculado' : 'Ver QR'}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteId(num.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {(!connections || connections.length === 0) && (
                    <div className="col-span-full text-center py-8 border rounded-lg bg-muted/30 border-dashed">
                        <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                        <p className="text-sm text-muted-foreground">No hay conexiones de WhatsApp configuradas</p>
                        <Button variant="link" onClick={() => setShowModal(true)}>Agregar una ahora</Button>
                    </div>
                )}
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
        </div>
    );
}
