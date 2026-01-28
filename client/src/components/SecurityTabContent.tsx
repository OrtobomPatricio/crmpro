import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { Shield, XCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export function SecurityTabContent() {
    const accessLogsQuery = trpc.security.listAccessLogs.useQuery({ limit: 50 }, {
        refetchOnWindowFocus: false,
    });

    const sessionsQuery = trpc.security.listActiveSessions.useQuery(undefined, {
        refetchOnWindowFocus: false,
    });

    // Fetch settings for IP config
    const settingsQuery = trpc.settings.get.useQuery();
    const utils = trpc.useUtils();

    const [allowedIps, setAllowedIps] = useState<string[]>([]);
    const [newIp, setNewIp] = useState("");

    // Update allowedIps when settings are loaded
    useEffect(() => {
        if (settingsQuery.data?.securityConfig?.allowedIps) {
            setAllowedIps(settingsQuery.data.securityConfig.allowedIps as string[]);
        }
    }, [settingsQuery.data]);

    const updateSecurity = trpc.settings.updateSecurityConfig.useMutation({
        onSuccess: () => {
            toast.success("Configuración de seguridad actualizada");
            utils.settings.get.invalidate();
        },
        onError: (e) => toast.error(e.message)
    });

    const revokeSession = trpc.security.revokeSession.useMutation({
        onSuccess: () => {
            toast.success("Sesión revocada");
            sessionsQuery.refetch();
        },
        onError: (e) => toast.error(e.message),
    });

    const handleAddIp = () => {
        if (!newIp) return;
        // Simple regex for IPv4/IPv6 validation could go here
        if (allowedIps.includes(newIp)) {
            toast.error("IP ya existe en la lista");
            return;
        }
        const next = [...allowedIps, newIp];
        setAllowedIps(next);
        setNewIp("");
        updateSecurity.mutate({ securityConfig: { allowedIps: next } });
    };

    const handleRemoveIp = (ip: string) => {
        const next = allowedIps.filter(i => i !== ip);
        setAllowedIps(next);
        updateSecurity.mutate({ securityConfig: { allowedIps: next } });
    };

    return (
        <div className="space-y-6">
            {/* IP Restrictions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Restricción de IP
                    </CardTitle>
                    <CardDescription>
                        Limita el acceso al CRM solo a estas direcciones IP. (Deja vacío para permitir todas)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2 mb-4">
                        <Input
                            value={newIp}
                            onChange={(e) => setNewIp(e.target.value)}
                            placeholder="Ej: 192.168.1.1"
                            className="max-w-xs"
                        />
                        <Button onClick={handleAddIp} disabled={updateSecurity.isPending} variant="outline">
                            <Plus className="w-4 h-4 mr-2" /> Agregar IP
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 p-4 border rounded-md min-h-[60px] bg-muted/10">
                        {allowedIps.length === 0 ? (
                            <span className="text-sm text-muted-foreground italic">Todas las IPs están permitidas</span>
                        ) : (
                            allowedIps.map(ip => (
                                <Badge key={ip} variant="secondary" className="flex items-center gap-1 pl-2 pr-1 py-1">
                                    {ip}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-4 w-4 rounded-full ml-1 hover:bg-destructive/20 hover:text-destructive"
                                        onClick={() => handleRemoveIp(ip)}
                                    >
                                        <XCircle className="w-3 h-3" />
                                    </Button>
                                </Badge>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

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
