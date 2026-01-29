import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Settings2, Trash2, GripVertical, Check, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Sortable Item Component ---
function SortableStage({ stage, onDelete, onUpdate }: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: stage.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(stage.name);
    const [color, setColor] = useState(stage.color || "#e2e8f0");

    const saveEdit = () => {
        onUpdate(stage.id, { name, color });
        setIsEditing(false);
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border p-3 bg-card mb-2">
            <div {...attributes} {...listeners} className="cursor-move">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>

            {isEditing ? (
                <div className="flex items-center gap-2 flex-1">
                    <Input
                        type="color"
                        value={color}
                        onChange={e => setColor(e.target.value)}
                        className="w-10 h-8 p-1 px-1"
                    />
                    <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="h-8 flex-1"
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={saveEdit}>
                        <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setIsEditing(false)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            ) : (
                <>
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: stage.color || '#ccc' }} />
                    <span className="flex-1 text-sm font-medium">{stage.name}</span>
                    <Badge variant="outline" className="text-[10px]">{stage.type}</Badge>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(true)}>
                            <Settings2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => onDelete(stage.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}


export default function PipelineSettings() {
    const { data: pipelines, isLoading, refetch } = trpc.pipelines.list.useQuery();
    const utils = trpc.useUtils();

    const createPipeline = trpc.pipelines.create.useMutation({
        onSuccess: () => {
            toast.success("Pipeline creado");
            refetch();
            setIsOpen(false);
            setNewPipelineName("");
        }
    });

    const createStage = trpc.pipelines.createStage.useMutation({
        onSuccess: () => {
            toast.success("Etapa agregada");
            refetch();
            setIsAddStageOpen(false);
            setNewStageName("");
        }
    });

    const updateStage = trpc.pipelines.updateStage.useMutation({
        onSuccess: () => refetch()
    });

    const deleteStage = trpc.pipelines.deleteStage.useMutation({
        onSuccess: () => {
            toast.success("Etapa eliminada");
            refetch();
        }
    });

    const reorderStages = trpc.pipelines.reorderStages.useMutation();

    const [isOpen, setIsOpen] = useState(false);
    const [isAddStageOpen, setIsAddStageOpen] = useState(false);
    const [newPipelineName, setNewPipelineName] = useState("");
    const [newStageName, setNewStageName] = useState("");
    const [newStageType, setNewStageType] = useState("open");
    const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);

    const selectedPipeline = pipelines?.find(p => p.id === selectedPipelineId) || pipelines?.[0];

    // Ensure we start with correct selected ID if not set
    useEffect(() => {
        if (!selectedPipelineId && pipelines?.[0]) {
            setSelectedPipelineId(pipelines[0].id);
        }
    }, [pipelines, selectedPipelineId]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleCreatePipeline = () => {
        if (!newPipelineName) return;
        createPipeline.mutate({ name: newPipelineName });
    };

    const handleAddStage = () => {
        if (!selectedPipeline || !newStageName) return;
        createStage.mutate({
            pipelineId: selectedPipeline.id,
            name: newStageName,
            type: newStageType as any,
            order: (selectedPipeline.stages.length || 0) + 1
        });
    };

    const handleUpdateStage = (id: number, data: any) => {
        updateStage.mutate({ id, ...data });
    };

    const handleDeleteStage = (id: number) => {
        if (confirm("¿Estás seguro de eliminar esta etapa? Los leads podrían quedar sin estado.")) {
            deleteStage.mutate({ id });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || !selectedPipeline) return;

        if (active.id !== over.id) {
            const oldIndex = selectedPipeline.stages.findIndex((s) => s.id === active.id);
            const newIndex = selectedPipeline.stages.findIndex((s) => s.id === over.id);

            // Optimistic update locally could be done here, but for now we rely on refetch
            const newOrder = arrayMove(selectedPipeline.stages, oldIndex, newIndex);
            const orderedIds = newOrder.map(s => s.id);

            // Trigger backend update
            reorderStages.mutate({ pipelineId: selectedPipeline.id, orderedStageIds: orderedIds });

            // Force optimistic UI update via query cache (optional but smooth)
            utils.pipelines.list.setData(undefined, (old: any) => {
                if (!old) return old;
                return old.map((p: any) => {
                    if (p.id !== selectedPipeline.id) return p;
                    return { ...p, stages: newOrder };
                });
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">Cargando...</div>
        );
    }

    return (
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
                            <Button onClick={handleCreatePipeline} disabled={createPipeline.isPending}>Crear</Button>
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

                {selectedPipeline && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Etapas del Pipeline: {selectedPipeline.name}</CardTitle>
                                <CardDescription>Arrastra para reordenar o edita los estados.</CardDescription>
                            </div>
                            <Dialog open={isAddStageOpen} onOpenChange={setIsAddStageOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <Plus className="mr-2 h-4 w-4" /> Agregar Etapa
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Nueva Etapa</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Nombre de la etapa</Label>
                                            <Input value={newStageName} onChange={e => setNewStageName(e.target.value)} placeholder="Ej: Pre-Calificado" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tipo de estado</Label>
                                            <select
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                value={newStageType}
                                                onChange={(e) => setNewStageType(e.target.value)}
                                            >
                                                <option value="open">Abierto (En proceso)</option>
                                                <option value="won">Ganado (Éxito)</option>
                                                <option value="lost">Perdido (Cerrado)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleAddStage} disabled={createStage.isPending}>Agregar</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={selectedPipeline.stages.map(s => s.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-2">
                                        {selectedPipeline.stages.map((stage) => (
                                            <SortableStage
                                                key={stage.id}
                                                stage={stage}
                                                onDelete={handleDeleteStage}
                                                onUpdate={handleUpdateStage}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
