import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Settings2, Trash2, GripVertical } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export default function PipelineSettings() {
    const { data: pipelines, isLoading, refetch } = trpc.pipelines.list.useQuery();
    const createPipeline = trpc.pipelines.create.useMutation({
        onSuccess: () => {
            toast.success("Pipeline creado");
            refetch();
            setIsOpen(false);
            setNewPipelineName("");
        }
    });

    const [isOpen, setIsOpen] = useState(false);
    const [newPipelineName, setNewPipelineName] = useState("");
    const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);

    const selectedPipeline = pipelines?.find(p => p.id === selectedPipelineId) || pipelines?.[0];

    const handleCreate = () => {
        if (!newPipelineName) return;
        createPipeline.mutate({ name: newPipelineName });
    };

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex h-full items-center justify-center">Cargando...</div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Configuración de Pipelines</h1>
                        <p className="text-muted-foreground">Gestiona tus embudos de venta y etapas.</p>
                    </div>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Nuevo Pipeline
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Crear Pipeline</DialogTitle>
                                <DialogDescription>Genera un nuevo embudo de ventas vacío o con etapas por defecto.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-right">Nombre</Label>
                                    <Input
                                        id="name"
                                        value={newPipelineName}
                                        onChange={(e) => setNewPipelineName(e.target.value)}
                                        className="col-span-3"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreate} disabled={createPipeline.isPending}>Crear</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid gap-6 md:grid-cols-[300px_1fr]">
                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle>Pipelines</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2">
                            {pipelines?.map(pipeline => (
                                <Button
                                    key={pipeline.id}
                                    variant={selectedPipeline?.id === pipeline.id ? "secondary" : "ghost"}
                                    className="w-full justify-start"
                                    onClick={() => setSelectedPipelineId(pipeline.id)}
                                >
                                    <Settings2 className="mr-2 h-4 w-4" />
                                    {pipeline.name}
                                    {pipeline.isDefault && <Badge variant="outline" className="ml-auto text-[10px]">Default</Badge>}
                                </Button>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Etapas del Pipeline: {selectedPipeline?.name}</CardTitle>
                            <CardDescription>Define los pasos de tu proceso de ventas.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {selectedPipeline?.stages.map((stage) => (
                                    <div key={stage.id} className="flex items-center gap-2 rounded-md border p-3 bg-card">
                                        <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                                        <div className="h-4 w-4 rounded-full" style={{ backgroundColor: stage.color || '#ccc' }} />
                                        <Input defaultValue={stage.name} className="h-8 w-[200px]" disabled />
                                        <div className="ml-auto flex items-center gap-2">
                                            <Badge variant="secondary">{stage.type}</Badge>
                                            <Button variant="ghost" size="icon" disabled>
                                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 text-sm text-muted-foreground">
                                * La edición de etapas estará disponible próximamente.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
