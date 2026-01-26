import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { Shield, XCircle } from "lucide-react";
import { toast } from "sonner";

export function SecurityTabContent() {
    const accessLogsQuery = trpc.security.listAccessLogs.useQuery({ limit: 50 }, {
        refetchOnWindowFocus: false,
    });

    const sessionsQuery = trpc.security.listActiveSessions.useQuery(undefined, {
        refetchOnWindowFocus: false,
    });

    const revokeSession = trpc.security.revokeSession.useMutation({
        onSuccess: () => {
            toast.success("Sesión revocada");
            sessionsQuery.refetch();
        },
        onError: (e) => toast.error(e.message),
    });

    return (
        <div className="space-y-6">
            {/* Access Logs */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Registros de Acceso
                    </CardTitle>
                    <CardDescription>
                        Últimas acciones de todos los usuarios (máximo 50)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {accessLogsQuery.isLoading ? (
                        <div className="text-sm text-muted-foreground">Cargando...</div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha/Hora</TableHead>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead>Acción</TableHead>
                                        <TableHead>IP</TableHead>
                                        <TableHead>Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(accessLogsQuery.data ?? []).map((log: any) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-sm">
                                                {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss")}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {log.userName ?? log.userId ?? "Sistema"}
                                            </TableCell>
                                            <TableCell className="text-sm font-mono">
                                                {log.action}
                                            </TableCell>
                                            <TableCell className="text-sm font-mono">
                                                {log.ipAddress ?? "—"}
                                            </TableCell>
                                            <TableCell>
                                                <span
                                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${log.success
                                                            ? "bg-green-500/10 text-green-600"
                                                            : "bg-red-500/10 text-red-600"
                                                        }`}
                                                >
                                                    {log.success ? "OK" : "Error"}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {accessLogsQuery.data?.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                                                No hay registros
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Active Sessions */}
            <Card>
                <CardHeader>
                    <CardTitle>Sesiones Activas</CardTitle>
                    <CardDescription>
                        Administra las sesiones de usuarios conectados
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {sessionsQuery.isLoading ? (
                        <div className="text-sm text-muted-foreground">Cargando...</div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead>Última Actividad</TableHead>
                                        <TableHead>IP</TableHead>
                                        <TableHead>Expira</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(sessionsQuery.data ?? []).map((session: any) => (
                                        <TableRow key={session.id}>
                                            <TableCell>{session.userName}</TableCell>
                                            <TableCell className="text-sm">
                                                {format(new Date(session.lastActivityAt), "dd/MM HH:mm")}
                                            </TableCell>
                                            <TableCell className="text-sm font-mono">
                                                {session.ipAddress ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {format(new Date(session.expiresAt), "dd/MM HH:mm")}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => revokeSession.mutate({ sessionId: session.id })}
                                                    disabled={revokeSession.isPending}
                                                >
                                                    <XCircle className="w-4 h-4 mr-1" />
                                                    Revocar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {sessionsQuery.data?.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                                                No hay sesiones activas
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
