import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  DragCancelEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// -- Tipos --
type Lead = {
  id: number;
  name: string;
  phone: string;
  status: string; // legacy
  pipelineStageId?: number | null;
  country: string;
};

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-semibold text-sm truncate pr-2">{lead.name}</h4>
          <Badge variant="outline" className="text-[10px] px-1 h-5">
            {lead.country}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-2">{lead.phone}</p>
      </CardContent>
    </Card>
  );
}

// -- Componente Tarjeta (Sortable Item) --
function SortableItem({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { ...lead },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-3">
      <LeadCard lead={lead} />
    </div>
  );
}

// -- Componente Columna --
function KanbanColumn({ id, title, leads }: { id: string; title: string; leads: Lead[] }) {
  return (
    <div className="flex flex-col h-full bg-muted/30 rounded-lg p-2 min-w-[280px] w-[280px]">
      <div className="flex items-center justify-between mb-3 px-2">
        <h3 className="font-bold text-sm text-foreground/80">{title}</h3>
        <Badge variant="secondary" className="text-xs">
          {leads.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1">
        <SortableContext id={id} items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <div className="px-1 min-h-[50px]">
            {leads.map((lead) => (
              <SortableItem key={lead.id} lead={lead} />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

// -- Página Principal --
export default function KanbanBoard() {
  const [activePipelineId, setActivePipelineId] = useState<number | null>(null);

  const { data: pipelines, isLoading: isLoadingPipelines } = trpc.pipelines.list.useQuery();

  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !activePipelineId) {
      const def = (pipelines as any[]).find((p: any) => p.isDefault) || (pipelines as any[])[0];
      setActivePipelineId(def.id);
    }
  }, [pipelines, activePipelineId]);

  const { data: leadsByStage, isLoading: isLoadingLeads, refetch } = trpc.leads.getByPipeline.useQuery(
    { pipelineId: activePipelineId ?? undefined },
    { enabled: !!activePipelineId }
  );

  const [board, setBoard] = useState<Record<number, Lead[]>>({});

  useEffect(() => {
    if (leadsByStage) {
      const next: Record<number, Lead[]> = {};
      Object.keys(leadsByStage as any).forEach((k) => {
        const n = Number(k);
        next[n] = (leadsByStage as any)[k] ?? [];
      });
      setBoard(next);
    }
  }, [leadsByStage]);

  const updateStatus = trpc.leads.updateStatus.useMutation();
  const reorderKanban = trpc.leads.reorderKanban.useMutation();

  const [activeDragItem, setActiveDragItem] = useState<Lead | null>(null);
  const dragSnapshotRef = useRef<Record<number, Lead[]> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activePipeline = useMemo(() => pipelines?.find((p: any) => p.id === activePipelineId), [pipelines, activePipelineId]);
  const columns = activePipeline?.stages || [];

  const settingsQuery = trpc.settings.get.useQuery();
  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => {
      refetch();
      setWonDialog({ open: false, leadId: null, stageId: null });
      setWonValue("");
      toast.success("¡Venta registrada!");
    },
    onError: (e) => toast.error(e.message),
  });

  // --- helpers ---
  const deepCloneBoard = (b: Record<number, Lead[]>) => {
    const out: Record<number, Lead[]> = {};
    Object.keys(b).forEach((k) => {
      out[Number(k)] = (b[Number(k)] ?? []).map((l) => ({ ...l }));
    });
    return out;
  };

  const findContainer = (id: string | number): number | null => {
    const num = Number(id);

    // container id
    if (Number.isFinite(num) && board[num]) return num;

    // item id
    for (const stageIdStr of Object.keys(board)) {
      const stageId = Number(stageIdStr);
      if ((board[stageId] ?? []).some((l) => l.id === num)) return stageId;
    }

    return null;
  };

  const persistStageOrder = async (stageId: number) => {
    const orderedLeadIds = (board[stageId] ?? []).map((l) => l.id);
    await reorderKanban.mutateAsync({ pipelineStageId: stageId, orderedLeadIds });
  };

  // -- Won Dialog State --
  const [wonDialog, setWonDialog] = useState<{ open: boolean; leadId: number | null; stageId: number | null }>(
    {
      open: false,
      leadId: null,
      stageId: null,
    }
  );
  const [wonValue, setWonValue] = useState("");

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = active.data.current as Lead;
    setActiveDragItem(lead);
    dragSnapshotRef.current = deepCloneBoard(board);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = Number(active.id);
    const overId = over.id;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer) {
      // reorder within column
      const activeIndex = (board[activeContainer] ?? []).findIndex((l) => l.id === activeId);
      const overIndex = (board[overContainer] ?? []).findIndex((l) => l.id === Number(overId));
      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return;

      setBoard((prev) => ({
        ...prev,
        [activeContainer]: arrayMove(prev[activeContainer] ?? [], activeIndex, overIndex),
      }));
      return;
    }

    // move across columns
    setBoard((prev) => {
      const sourceItems = [...(prev[activeContainer] ?? [])];
      const destItems = [...(prev[overContainer] ?? [])];

      const sourceIndex = sourceItems.findIndex((l) => l.id === activeId);
      if (sourceIndex === -1) return prev;

      const [moved] = sourceItems.splice(sourceIndex, 1);
      moved.pipelineStageId = overContainer;

      const destIndex = destItems.findIndex((l) => l.id === Number(overId));
      if (destIndex >= 0) {
        destItems.splice(destIndex, 0, moved);
      } else {
        destItems.push(moved);
      }

      return {
        ...prev,
        [activeContainer]: sourceItems,
        [overContainer]: destItems,
      };
    });
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveDragItem(null);
    if (dragSnapshotRef.current) {
      setBoard(dragSnapshotRef.current);
    }
    dragSnapshotRef.current = null;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) {
      if (dragSnapshotRef.current) setBoard(dragSnapshotRef.current);
      dragSnapshotRef.current = null;
      return;
    }

    const activeId = Number(active.id);
    const overId = over.id;

    const fromStage = findContainer(activeId);
    const toStage = findContainer(overId);

    if (!fromStage || !toStage) {
      dragSnapshotRef.current = null;
      return;
    }

    // If moved to WON and value is required -> revert and ask value
    if (fromStage !== toStage) {
      const targetStage = activePipeline?.stages?.find((s: any) => s.id === toStage);
      const isWon = targetStage?.type === "won";
      const requireValue = settingsQuery.data?.salesConfig?.requireValueOnWon ?? true;

      if (isWon && requireValue) {
        if (dragSnapshotRef.current) setBoard(dragSnapshotRef.current);
        setWonDialog({ open: true, leadId: activeId, stageId: toStage });
        dragSnapshotRef.current = null;
        return;
      }
    }

    try {
      // Persist stage change first
      if (fromStage !== toStage) {
        await updateStatus.mutateAsync({ id: activeId, pipelineStageId: toStage });
      }

      // Persist ordering (both columns affected if moved across)
      if (fromStage === toStage) {
        await persistStageOrder(fromStage);
      } else {
        await persistStageOrder(fromStage);
        await persistStageOrder(toStage);
      }

      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar orden");
      await refetch();
    } finally {
      dragSnapshotRef.current = null;
    }
  };

  const confirmWon = () => {
    if (!wonDialog.leadId || !wonDialog.stageId) return;
    updateLead.mutate({
      id: wonDialog.leadId,
      pipelineStageId: wonDialog.stageId,
      value: parseFloat(wonValue) || 0,
    } as any);
  };

  if (isLoadingPipelines || (activePipelineId && isLoadingLeads)) {
    return (
        <div className="flex items-center justify-center h-full">Cargando tablero...</div>
    );
  }

  return (
      <div className="h-[calc(100vh-100px)] flex flex-col p-4">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pipeline de Ventas</h1>
            <p className="text-muted-foreground">{activePipeline?.name || "Cargando..."}</p>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full overflow-x-auto pb-4">
            {columns.map((stage: any) => (
              <KanbanColumn
                key={stage.id}
                id={String(stage.id)}
                title={stage.name}
                leads={board[stage.id] || []}
              />
            ))}
          </div>

          <DragOverlay
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: { active: { opacity: "0.5" } },
              }),
            }}
          >
            {activeDragItem ? (
              <div className="w-[280px]">
                <LeadCard lead={activeDragItem} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <Dialog open={wonDialog.open} onOpenChange={(open) => !open && setWonDialog((p) => ({ ...p, open: false }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¡Felicidades por la Venta!</DialogTitle>
            <DialogDescription>
              Por favor ingresa el valor total del negocio para calcular comisiones y metas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="value" className="text-right">
                Valor ({settingsQuery.data?.salesConfig?.currencySymbol ?? "G$"})
              </Label>
              <Input
                id="value"
                type="number"
                value={wonValue}
                onChange={(e) => setWonValue(e.target.value)}
                className="col-span-3"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setWonDialog({ open: false, leadId: null, stageId: null })} variant="outline">
              Cancelar
            </Button>
            <Button onClick={confirmWon} disabled={!wonValue || updateLead.isPending}>
              {updateLead.isPending ? "Guardando..." : "Confirmar Venta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
