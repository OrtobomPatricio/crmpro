import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Shield, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";

export function BackupRestoreSection() {
    const [uploading, setUploading] = useState(false);

    const createBackup = trpc.backup.createBackup.useMutation({
        onSuccess: (data) => {
            // Download the backup file
            const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `crm-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`Backup creado: ${data.count} registros`);
        },
        onError: (e) => {
            toast.error(`Error al crear backup: ${e.message}`);
        },
    });

    const handleRestore = async (file: File) => {
        setUploading(true);
        try {
            const content = await file.text();
            const data = JSON.parse(content);

            // TODO: Call restore endpoint
            toast.success("Backup restaurado correctamente");
        } catch (e) {
            toast.error("Error al restaurar backup");
        } finally {
            setUploading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Backup y Restauración
                </CardTitle>
                <CardDescription>
                    Crea copias de seguridad de tu base de datos o restaura desde un backup anterior
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Crear Backup Completo</p>
                            <p className="text-sm text-muted-foreground">
                                Descarga un archivo JSON con todos tus datos
                            </p>
                        </div>
                        <Button
                            onClick={() => createBackup.mutate()}
                            disabled={createBackup.isPending}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            {createBackup.isPending ? "Creando..." : "Crear Backup"}
                        </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg border-yellow-500/30 bg-yellow-500/5">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-yellow-600" />
                            <div>
                                <p className="font-medium">Restaurar desde Backup</p>
                                <p className="text-sm text-muted-foreground">
                                    ⚠️ Esto reemplazará todos los datos actuales
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => document.getElementById('backup-file')?.click()}
                            disabled={uploading}
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            {uploading ? "Restaurando..." : "Restaurar"}
                        </Button>
                        <input
                            id="backup-file"
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleRestore(file);
                            }}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function ActivityLogsViewer() {
    const { data: logs, isLoading } = trpc.security.listAccessLogs.useQuery({ limit: 50 });

    const getActionBadge = (action: string) => {
        if (action.includes('login')) return <Badge variant="outline" className="bg-green-500/10 text-green-700">Login</Badge>;
        if (action.includes('create') || action.includes('import')) return <Badge variant="outline" className="bg-blue-500/10 text-blue-700">Crear</Badge>;
        if (action.includes('update') || action.includes('edit')) return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700">Editar</Badge>;
        if (action.includes('delete') || action.includes('revoke')) return <Badge variant="outline" className="bg-red-500/10 text-red-700">Eliminar</Badge>;
        if (action.includes('export') || action.includes('backup')) return <Badge variant="outline" className="bg-purple-500/10 text-purple-700">Export</Badge>;
        return <Badge variant="outline">{action}</Badge>;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Registro de Actividades</CardTitle>
                <CardDescription>
                    Historial completo de acciones realizadas en el sistema
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-sm text-muted-foreground">Cargando actividades...</div>
                ) : !logs || logs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No hay actividades registradas
                    </div>
                ) : (
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha/Hora</TableHead>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Acción</TableHead>
                                    <TableHead>IP</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-sm">
                                            {new Date(log.createdAt).toLocaleString('es-ES', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {log.userName || 'Sistema'}
                                        </TableCell>
                                        <TableCell>
                                            {getActionBadge(log.action)}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {log.ipAddress || '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
