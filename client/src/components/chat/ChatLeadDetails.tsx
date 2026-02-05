import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Phone, Mail, MapPin, Tag, Briefcase, Save, Loader2, DollarSign } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface ChatLeadDetailsProps {
    leadId: number;
    className?: string;
}

export function ChatLeadDetails({ leadId, className }: ChatLeadDetailsProps) {
    const utils = trpc.useContext();

    // Fetch Data
    const { data: lead, isLoading: isLoadingLead } = trpc.leads.getById.useQuery({ id: leadId });
    const { data: pipelines } = trpc.pipelines.list.useQuery();

    // Mutations
    const updateLead = trpc.leads.update.useMutation({
        onSuccess: () => {
            toast({ title: "Lead actualizado", description: "Los cambios se han guardado correctamente." });
            utils.leads.getById.invalidate({ id: leadId });
            utils.chat.listConversations.invalidate(); // Update list if name changed
        },
        onError: (err) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    });

    // Local State for Form
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        country: "",
        source: "",
        notes: "",
        pipelineStageId: undefined as number | undefined,
        value: "0"
    });

    // Sync state with fetched data
    useEffect(() => {
        if (lead) {
            setFormData({
                name: lead.name,
                phone: lead.phone,
                email: lead.email || "",
                country: lead.country || "",
                source: lead.source || "",
                notes: lead.notes || "",
                pipelineStageId: lead.pipelineStageId || undefined,
                value: lead.value || "0"
            });
        }
    }, [lead]);

    // Handle Save
    const handleSave = () => {
        if (!lead) return;

        updateLead.mutate({
            id: lead.id,
            name: formData.name,
            phone: formData.phone,
            email: formData.email || null, // handle empty string as null
            country: formData.country,
            source: formData.source,
            notes: formData.notes,
            pipelineStageId: formData.pipelineStageId,
            value: Number(formData.value) || 0
        });
    };

    // Helper to get all stages flattened
    const allStages = pipelines?.flatMap(p => p.stages) || [];
    const currentStage = allStages.find(s => s.id === formData.pipelineStageId);

    if (isLoadingLead) {
        return (
            <Card className="h-full border-l rounded-none border-border/50 bg-background/50 backdrop-blur-sm">
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            </Card>
        );
    }

    if (!lead) {
        return (
            <Card className="h-full border-l rounded-none border-border/50 p-4">
                <div className="text-center text-muted-foreground">Lead no encontrado</div>
            </Card>
        );
    }

    return (
        <div className={`flex flex-col h-full border-l bg-background w-80 overflow-hidden ${className}`}>
            <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                <h3 className="font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Detalles del Lead
                </h3>
                <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateLead.isLoading}
                    className="h-8 w-8 p-0 sm:w-auto sm:px-3 sm:gap-2"
                >
                    {updateLead.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span className="hidden sm:inline">Guardar</span>
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* STATUS / STAGE */}
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Etapa</Label>
                    <Select
                        value={formData.pipelineStageId?.toString()}
                        onValueChange={(val) => setFormData({ ...formData, pipelineStageId: parseInt(val) })}
                    >
                        <SelectTrigger className="w-full bg-secondary/20 border-secondary/20">
                            <SelectValue placeholder="Seleccionar etapa" />
                        </SelectTrigger>
                        <SelectContent>
                            {pipelines?.map(pipeline => (
                                <div key={pipeline.id}>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                                        {pipeline.name}
                                    </div>
                                    {pipeline.stages.map(stage => (
                                        <SelectItem key={stage.id} value={stage.id.toString()}>
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                                                {stage.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </div>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Separator />

                {/* BASIC INFO */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3.5 w-3.5" /> Nombre
                        </Label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" /> Teléfono
                        </Label>
                        <Input
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" /> Email
                        </Label>
                        <Input
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="email@ejemplo.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" /> País
                        </Label>
                        <Input
                            value={formData.country}
                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                            placeholder="País"
                        />
                    </div>
                </div>

                <Separator />

                {/* DEAL INFO */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-muted-foreground">
                            <DollarSign className="h-3.5 w-3.5" /> Valor del Deal
                        </Label>
                        <Input
                            type="number"
                            value={formData.value}
                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-muted-foreground">
                            <Briefcase className="h-3.5 w-3.5" /> Fuente
                        </Label>
                        <Input
                            value={formData.source}
                            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                            placeholder="Origen del lead"
                        />
                    </div>
                </div>

                <Separator />

                {/* ADDITIONAL */}
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Notas</Label>
                    <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="min-h-[100px] resize-none"
                        placeholder="Escribe notas importantes sobre este lead..."
                    />
                </div>

            </div>
        </div>
    );
}
