import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Download, Upload, FileJson, FileSpreadsheet, AlertCircle, RefreshCw } from "lucide-react";
import { useState, useRef, type ChangeEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Backup() {
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);
    const restoreInputRef = useRef<HTMLInputElement>(null);

    const [restoreMode, setRestoreMode] = useState<"replace" | "merge">("replace");
    const [restoreFileName, setRestoreFileName] = useState<string>("");

    const createBackupMutation = trpc.backup.createBackup.useMutation({
        onSuccess: (data) => {
            // Download as JSON file
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `backup_${new Date().toISOString().split("T")[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setIsExporting(false);
            toast.success("Backup descargado exitosamente");
        },
        onError: (error) => {
            setIsExporting(false);
            toast.error("Error al crear backup: " + error.message);
        },
    });

    const exportLeadsQuery = trpc.backup.exportLeadsCSV.useQuery(undefined, {
        enabled: false,
    });

    const importLeadsMutation = trpc.backup.importLeadsCSV.useMutation({
        onSuccess: (result) => {
            setIsImporting(false);
            toast.success(
                `Importación completada: ${result.imported} importados, ${result.duplicates} duplicados, ${result.errors} errores`
            );
        },
        onError: (error) => {
            setIsImporting(false);
            toast.error("Error al importar: " + error.message);
        },
    });

    const restoreBackupMutation = trpc.backup.restoreBackupJson.useMutation({
        onSuccess: (result: any) => {
            setIsRestoring(false);
            toast.success("Backup restaurado correctamente");
            console.log("[Restore] Result:", result);
        },
        onError: (error) => {
            setIsRestoring(false);
            toast.error("Error al restaurar: " + error.message);
        },
    });

    const handleBackupDownload = () => {
        setIsExporting(true);
        createBackupMutation.mutate();
    };

    const handleExportCSV = async () => {
        setIsExporting(true);
        try {
            const result = await exportLeadsQuery.refetch();
            if (result.data) {
                const blob = new Blob([result.data.csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `leads_export_${new Date().toISOString().split("T")[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success(`${result.data.count} leads exportados`);
            }
        } catch (error: any) {
            toast.error("Error al exportar: " + error.message);
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportCSV = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const csvContent = e.target?.result as string;
            setIsImporting(true);
            importLeadsMutation.mutate({ csvContent });
        };
        reader.readAsText(file);
    };

    const handleRestoreBackup = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setRestoreFileName(file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const raw = e.target?.result as string;
                const parsed = JSON.parse(raw);
                setIsRestoring(true);
                restoreBackupMutation.mutate({ backupJson: parsed, mode: restoreMode });
            } catch (err: any) {
                toast.error("Archivo JSON inválido: " + (err?.message ?? ""));
            }
        };
        reader.readAsText(file);
    };

    return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Backups e Importación</h1>
                    <p className="text-muted-foreground">
                        Administra tus datos: backups completos y gestión de leads via CSV
                    </p>
                </div>

                {/* Full System Backup */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileJson className="w-5 h-5" />
                            Backup Completo del Sistema
                        </CardTitle>
                        <CardDescription>
                            Descarga todos los datos del CRM (leads, campañas, conversaciones) en formato JSON
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                El backup incluye: Leads, Campañas, Conversaciones, Mensajes y Números WhatsApp
                            </AlertDescription>
                        </Alert>

                        <Button
                            onClick={handleBackupDownload}
                            disabled={isExporting}
                            className="w-full sm:w-auto"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            {isExporting ? "Generando..." : "Descargar Backup Completo"}
                        </Button>
                    </CardContent>
                </Card>

                {/* CSV Import/Export */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5" />
                            Gestión de Leads (CSV)
                        </CardTitle>
                        <CardDescription>
                            Importa o exporta leads en formato CSV
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <Label>Exportar Leads a CSV</Label>
                            <p className="text-sm text-muted-foreground">
                                Descarga todos tus leads en un archivo CSV compatible con Excel
                            </p>
                            <Button
                                onClick={handleExportCSV}
                                variant="outline"
                                disabled={isExporting}
                                className="w-full sm:w-auto"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                {isExporting ? "Exportando..." : "Exportar a CSV"}
                            </Button>
                        </div>

                        <div className="border-t pt-6 space-y-3">
                            <Label>Importar Leads desde CSV</Label>
                            <p className="text-sm text-muted-foreground">
                                Sube un archivo CSV con columnas: nombre, telefono, email, pais, estado, notas
                            </p>
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Los leads duplicados (mismo teléfono) serán ignorados automáticamente
                                </AlertDescription>
                            </Alert>

                            <input
                                ref={csvInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleImportCSV}
                                className="hidden"
                            />

                            <Button
                                onClick={() => csvInputRef.current?.click()}
                                variant="outline"
                                disabled={isImporting}
                                className="w-full sm:w-auto"
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                {isImporting ? "Importando..." : "Seleccionar archivo CSV"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Restore Backup */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <RefreshCw className="w-5 h-5" />
                            Restaurar Backup (JSON)
                        </CardTitle>
                        <CardDescription>
                            Sube un archivo de backup para restaurar datos del CRM
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                <div className="space-y-1">
                                    <p>
                                        <b>Reemplazar</b> borra todo y restaura completo (recomendado)
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        <b>Merge seguro</b> solo importa: Leads + Plantillas + Pipelines (sin duplicar)
                                    </p>
                                </div>
                            </AlertDescription>
                        </Alert>

                        <div className="grid gap-2 max-w-sm">
                            <Label>Modo de restauración</Label>
                            <Select value={restoreMode} onValueChange={(v: any) => setRestoreMode(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="replace">Reemplazar (full)</SelectItem>
                                    <SelectItem value="merge">Merge seguro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <input
                            ref={restoreInputRef}
                            type="file"
                            accept=".json,application/json"
                            onChange={handleRestoreBackup}
                            className="hidden"
                        />

                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <Button
                                onClick={() => restoreInputRef.current?.click()}
                                variant={restoreMode === "replace" ? "default" : "outline"}
                                disabled={isRestoring || restoreBackupMutation.isPending}
                                className="w-full sm:w-auto"
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                {restoreBackupMutation.isPending ? "Restaurando..." : "Seleccionar backup JSON"}
                            </Button>

                            {restoreFileName && (
                                <p className="text-sm text-muted-foreground truncate">
                                    Archivo: {restoreFileName}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
    );
}
