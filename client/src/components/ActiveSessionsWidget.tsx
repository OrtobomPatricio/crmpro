import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Smartphone, Globe, ShieldCheck, Laptop } from "lucide-react";
import { toast } from "sonner";

function timeAgo(dateString: string | Date) {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return "hace " + Math.floor(interval) + " años";
    interval = seconds / 2592000;
    if (interval > 1) return "hace " + Math.floor(interval) + " meses";
    interval = seconds / 86400;
    if (interval > 1) return "hace " + Math.floor(interval) + " días";
    interval = seconds / 3600;
    if (interval > 1) return "hace " + Math.floor(interval) + " horas";
    interval = seconds / 60;
    if (interval > 1) return "hace " + Math.floor(interval) + " minutos";
    return "hace unos momentos";
}

export function ActiveSessionsWidget() {
    const utils = trpc.useContext();
    const { data: sessions, isLoading } = trpc.sessions.list.useQuery();

    const revokeMutation = trpc.sessions.revoke.useMutation({
        onSuccess: () => {
            utils.sessions.list.invalidate();
            toast.success("Sesión cerrada correctamente");
        },
        onError: (err: any) => {
            toast.error("Error al cerrar sesión: " + err.message);
        }
    });

    const revokeAllMutation = trpc.sessions.revokeAllOthers.useMutation({
        onSuccess: () => {
            utils.sessions.list.invalidate();
            toast.success("Todas las otras sesiones han sido cerradas");
        },
        onError: (err: any) => {
            toast.error("Error: " + err.message);
        }
    });

    const handleRevoke = (id: number) => {
        revokeMutation.mutate({ id });
    };

    const handleRevokeAll = () => {
        if (confirm("¿Estás seguro de que quieres cerrar todas las sesiones excepto esta?")) {
            revokeAllMutation.mutate();
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader><CardTitle className="text-sm">Cargando sesiones...</CardTitle></CardHeader>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-green-500" />
                            Sesiones Activas
                        </CardTitle>
                        <CardDescription>
                            Gestiona los dispositivos conectados a tu cuenta
                        </CardDescription>
                    </div>
                    {sessions && sessions.length > 1 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleRevokeAll}
                            disabled={revokeAllMutation.isPending}
                        >
                            {revokeAllMutation.isPending ? "Cerrando..." : "Cerrar todas las demás"}
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {sessions?.length === 0 && <p className="text-muted-foreground">No se encontraron sesiones.</p>}
                {sessions?.map((session: any) => {
                    const isCurrent = session.isCurrent;
                    const ua = session.userAgent || "";
                    let Icon = Globe;
                    let deviceName = "Navegador Web";

                    if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone")) {
                        Icon = Smartphone;
                        deviceName = "Dispositivo Móvil";
                    } else if (ua.includes("Windows") || ua.includes("Macintosh") || ua.includes("Linux")) {
                        Icon = Monitor;
                        deviceName = "Ordenador";
                    }

                    // Try to extract browser/OS name
                    if (ua.includes("Windows")) deviceName = "PC Windows";
                    else if (ua.includes("Macintosh")) deviceName = "Mac";
                    else if (ua.includes("Linux")) deviceName = "Linux";
                    else if (ua.includes("Android")) deviceName = "Android";
                    else if (ua.includes("iPhone")) deviceName = "iPhone";

                    if (ua.includes("Chrome")) deviceName += " - Chrome";
                    else if (ua.includes("Firefox")) deviceName += " - Firefox";
                    else if (ua.includes("Safari") && !ua.includes("Chrome")) deviceName += " - Safari";
                    else if (ua.includes("Edg")) deviceName += " - Edge";

                    return (
                        <div key={session.id} className={`flex items-center justify-between p-3 rounded-lg border ${isCurrent ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${isCurrent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-sm">{deviceName}</p>
                                        {isCurrent && <span className="text-[10px] bg-green-500/10 text-green-600 border border-green-200 px-2 py-0.5 rounded-full font-bold">ACTUAL</span>}
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-0.5">
                                        <p>IP: {session.ipAddress || "Desconocida"}</p>
                                        <p>Activo {timeAgo(session.lastActivityAt)}</p>
                                    </div>
                                </div>
                            </div>

                            {!isCurrent && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRevoke(session.id)}
                                    disabled={revokeMutation.isPending}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                                >
                                    Cerrar
                                </Button>
                            )}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
