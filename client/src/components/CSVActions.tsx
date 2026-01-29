import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";

interface CSVActionsProps {
    onRefresh?: () => void;
}

export function CSVActions({ onRefresh }: CSVActionsProps) {
    const [importing, setImporting] = useState(false);

    const exportCSV = trpc.backup.exportLeadsCSV.useMutation({
        onSuccess: (data) => {
            const blob = new Blob([data.csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`${data.count} leads exportados`);
        },
        onError: (e) => {
            toast.error(`Error: ${e.message}`);
        },
    });

    const importCSV = trpc.backup.importLeadsCSV.useMutation({
        onSuccess: (data) => {
            toast.success(`Importados: ${data.imported} | Errores: ${data.errors}`);
            onRefresh?.();
        },
        onError: (e) => {
            toast.error(`Error: ${e.message}`);
        },
    });

    const handleImport = async (file: File) => {
        setImporting(true);
        try {
            const content = await file.text();
            await importCSV.mutateAsync({ csvContent: content });
        } catch (e) {
            console.error(e);
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="flex gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => exportCSV.mutate()}
                disabled={exportCSV.isPending}
            >
                <Download className="w-4 h-4 mr-2" />
                {exportCSV.isPending ? "Exportando..." : "Exportar CSV"}
            </Button>

            <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('csv-import')?.click()}
                disabled={importing}
            >
                <Upload className="w-4 h-4 mr-2" />
                {importing ? "Importando..." : "Importar CSV"}
            </Button>

            <input
                id="csv-import"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImport(file);
                }}
            />
        </div>
    );
}
