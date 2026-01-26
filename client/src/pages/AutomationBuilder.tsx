
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
    ArrowRight,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    MessageSquare,
    Plus,
    Settings2,
    Tag,
    Trash2,
    Zap
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface Action {
    id: string;
    type: string;
    config: any;
}

const STEPS = [
    { id: 1, title: "Detalles", icon: Settings2 },
    { id: 2, title: "Disparador", icon: Zap },
    { id: 3, title: "Acciones", icon: ArrowRight },
];

export default function AutomationBuilder() {
    const [, setLocation] = useLocation();
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        triggerType: "lead_created",
        triggerConfig: {} as any,
        actions: [] as Action[],
    });

    const utils = trpc.useUtils();
    const { data: templates } = trpc.templates.list.useQuery();
    const { data: pipelines } = trpc.pipelines.list.useQuery();

    const createWorkflow = trpc.workflows.create.useMutation({
        onSuccess: () => {
            utils.workflows.list.invalidate();
            toast.success("Automatización creada");
            setLocation("/automations");
        },
        onError: (err) => toast.error(err.message),
    });

    const handleNext = () => { if (currentStep < 3) setCurrentStep(c => c + 1); };
    const handleBack = () => { if (currentStep > 1) setCurrentStep(c => c - 1); };

    const addAction = (type: string) => {
        setFormData(prev => ({
            ...prev,
            actions: [...prev.actions, { id: Math.random().toString(36), type, config: {} }]
        }));
    };

    const removeAction = (id: string) => {
        setFormData(prev => ({
            ...prev,
            actions: prev.actions.filter(a => a.id !== id)
        }));
    };

    const updateActionConfig = (id: string, key: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            actions: prev.actions.map(a => a.id === id ? { ...a, config: { ...a.config, [key]: value } } : a)
        }));
    };

    const handleSave = () => {
        createWorkflow.mutate({
            name: formData.name,
            description: formData.description,
            triggerType: formData.triggerType as any,
            triggerConfig: formData.triggerConfig,
            actions: formData.actions.map(a => ({ type: a.type, ...a.config }))
        });
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Nueva Automatización</h1>
                    <p className="text-muted-foreground">Configura reglas automáticas</p>
                </div>

                {/* Steps */}
                <div className="flex items-center justify-between relative mb-8">
                    <div className="absolute left-0 top-1/2 w-full h-0.5 bg-gray-200 -z-10" />
                    {STEPS.map((step) => {
                        const isActive = step.id === currentStep;
                        const isCompleted = step.id < currentStep;
                        const Icon = step.icon;
                        return (
                            <div key={step.id} className="flex flex-col items-center bg-background px-4">
                                <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                            ${isActive ? 'border-primary bg-primary text-primary-foreground' :
                                        isCompleted ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 text-gray-400'}
                        `}>
                                    {isCompleted ? <CheckCircle className="h-6 w-6" /> : <Icon className="h-5 w-5" />}
                                </div>
                                <span className="text-xs mt-2 font-medium text-muted-foreground">{step.title}</span>
                            </div>
                        );
                    })}
                </div>

                <Card className="min-h-[400px] flex flex-col">
                    <CardHeader>
                        <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
                        <CardDescription>Paso {currentStep} de 3</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-6">
                        {currentStep === 1 && (
                            <>
                                <div className="grid gap-2">
                                    <Label>Nombre</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ej: Bienvenida Lead Nuevo"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Descripción</Label>
                                    <Textarea
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Breve descripción de lo que hace esta regla..."
                                    />
                                </div>
                            </>
                        )}

                        {currentStep === 2 && (
                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>Cuando suceda esto...</Label>
                                    <Select
                                        value={formData.triggerType}
                                        onValueChange={val => setFormData({ ...formData, triggerType: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="lead_created">Nuevo Lead Creado</SelectItem>
                                            <SelectItem value="lead_updated">Lead Actualizado (Cambio de Etapa)</SelectItem>
                                            <SelectItem value="msg_received">Mensaje Recibido</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {formData.triggerType === "lead_updated" && (
                                    <div className="grid gap-2 p-4 bg-muted/30 rounded-lg border">
                                        <Label>Filtro: Etapa destino</Label>
                                        <Select
                                            value={formData.triggerConfig.pipelineStageId}
                                            onValueChange={val => setFormData({ ...formData, triggerConfig: { ...formData.triggerConfig, pipelineStageId: val } })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Cualquier etapa" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {pipelines?.flatMap(p => p.stages).map(s => (
                                                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div>
                                <div className="mb-6 flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => addAction("send_whatsapp")}>
                                        <MessageSquare className="mr-2 h-4 w-4" /> Enviar WhatsApp
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => addAction("add_tag")}>
                                        <Tag className="mr-2 h-4 w-4" /> Agregar Etiqueta
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    {formData.actions.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                            No hay acciones definidas. Agrega una arriba.
                                        </div>
                                    )}
                                    {formData.actions.map((action, index) => (
                                        <div key={action.id} className="p-4 border rounded-lg relative bg-card">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute top-2 right-2 text-destructive"
                                                onClick={() => removeAction(action.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>

                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="bg-primary/10 p-2 rounded text-primary text-xs font-bold">
                                                    PASO {index + 1}
                                                </div>
                                                <h4 className="font-medium">
                                                    {action.type === 'send_whatsapp' ? 'Enviar Mensaje WhatsApp' : 'Agregar Etiqueta'}
                                                </h4>
                                            </div>

                                            {action.type === 'send_whatsapp' && (
                                                <div className="grid gap-2">
                                                    <Label>Plantilla</Label>
                                                    <Select
                                                        value={action.config.templateId}
                                                        onValueChange={val => updateActionConfig(action.id, 'templateId', val)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar plantilla..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {templates?.map(t => (
                                                                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}

                                            {action.type === 'add_tag' && (
                                                <div className="grid gap-2">
                                                    <Label>Nombre de la etiqueta</Label>
                                                    <Input
                                                        placeholder="Ej: Interesado"
                                                        value={action.config.tag || ''}
                                                        onChange={e => updateActionConfig(action.id, 'tag', e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-between border-t p-6">
                        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
                            <ChevronLeft className="mr-2 h-4 w-4" /> Anterior
                        </Button>
                        {currentStep === 3 ? (
                            <Button onClick={handleSave} disabled={createWorkflow.isPending || !formData.name}>
                                {createWorkflow.isPending ? 'Guardando...' : 'Crear Automatización'}
                            </Button>
                        ) : (
                            <Button onClick={handleNext}>
                                Siguiente <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </DashboardLayout>
    );
}
