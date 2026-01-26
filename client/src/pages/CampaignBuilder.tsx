
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
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
    CheckCircle,
    ChevronRight,
    ChevronLeft,
    Users,
    MessageSquare,
    LayoutTemplate
} from "lucide-react";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { EmailEditor, EmailEditorHandle } from "@/components/email-editor";

const STEPS = [
    { id: 1, title: "Detalles", icon: LayoutTemplate },
    { id: 2, title: "Audiencia", icon: Users },
    { id: 3, title: "Contenido", icon: MessageSquare },
    { id: 4, title: "Revisar", icon: CheckCircle },
];

export default function CampaignBuilder() {
    const [, setLocation] = useLocation();
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        name: "",
        type: "whatsapp",
        pipelineStageId: undefined as string | undefined,
        templateId: undefined as string | undefined,
        message: "",
    });

    const utils = trpc.useUtils();

    // Queries
    const { data: pipelines } = trpc.pipelines.list.useQuery();
    const { data: templates } = trpc.templates.list.useQuery();

    // Dynamic audience calculation
    const { data: audiencePreview } = trpc.campaigns.calculateAudience.useQuery(
        { pipelineStageId: formData.pipelineStageId ? Number(formData.pipelineStageId) : undefined },
        { enabled: !!formData.pipelineStageId }
    );

    // Mutations
    const createCampaign = trpc.campaigns.create.useMutation({
        onSuccess: (data) => {
            // Automatically launch? Or just save as draft? Let's save as draft then launch logic if needed.
            // For this wizard, "Finalizar" might mean create & launch or just create.
            // Let's assume just create draft for now, then user can launch from list or we add a "Launch now" check.
            toast.success("Campaña creada correctamente");
            setLocation("/campaigns");
        },
        onError: (err) => toast.error(err.message)
    });

    const launchCampaign = trpc.campaigns.launch.useMutation();

    const emailEditorRef = useRef<EmailEditorHandle>(null);

    const handleNext = async () => {
        if (currentStep === 3 && formData.type === 'email' && emailEditorRef.current) {
            // Export HTML before proceeding to review
            const { html } = await emailEditorRef.current.exportHtml();
            setFormData(prev => ({ ...prev, message: html }));
        }
        if (currentStep < 4) setCurrentStep(c => c + 1);
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(c => c - 1);
    };

    const handleFinish = async () => {
        // 1. Create Campaign
        const result = await createCampaign.mutateAsync({
            name: formData.name,
            type: formData.type as "whatsapp" | "email",
            message: formData.message,
            templateId: formData.templateId ? Number(formData.templateId) : undefined,
            audienceConfig: {
                pipelineStageId: formData.pipelineStageId ? Number(formData.pipelineStageId) : undefined
            }
        });

        // 2. Launch (Optional, if we added a checkbox. For now just create).
    };

    // Helper to flat list stages
    const allStages = pipelines?.flatMap(p => p.stages) || [];

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Nueva Campaña</h1>
                    <p className="text-muted-foreground">Configura tu campaña en 4 pasos simples</p>
                </div>

                {/* Steps Indicator */}
                <div className="flex items-center justify-between relative">
                    <div className="absolute left-0 top-1/2 w-full h-0.5 bg-gray-200 -z-10" />
                    {STEPS.map((step) => {
                        const Icon = step.icon;
                        const isActive = step.id === currentStep;
                        const isCompleted = step.id < currentStep;
                        return (
                            <div key={step.id} className="flex flex-col items-center bg-background px-4">
                                <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                            ${isActive ? 'border-primary bg-primary text-primary-foreground' :
                                        isCompleted ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 text-gray-400'}
                        `}>
                                    {isCompleted ? <CheckCircle className="h-6 w-6" /> : <Icon className="h-5 w-5" />}
                                </div>
                                <span className={`text-xs mt-2 font-medium ${isActive ? 'text-primary' : 'text-gray-500'}`}>
                                    {step.title}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Content Area */}
                <Card className="min-h-[400px] flex flex-col">
                    <CardHeader>
                        <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
                        <CardDescription>
                            {currentStep === 1 && "Define los datos básicos de la campaña."}
                            {currentStep === 2 && "Selecciona a quién quieres enviar el mensaje."}
                            {currentStep === 3 && "Escribe tu mensaje o selecciona una plantilla."}
                            {currentStep === 4 && "Revisa que todo esté correcto antes de crear."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        {currentStep === 1 && (
                            <div className="space-y-4 max-w-md">
                                <div className="grid gap-2">
                                    <Label>Nombre de la campaña</Label>
                                    <Input
                                        placeholder="Ej: Oferta Verano 2026"
                                        value={formData.name}
                                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Canal de envío</Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={val => setFormData(prev => ({ ...prev, type: val }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                            <SelectItem value="email">Email Marketing</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="space-y-6 max-w-md">
                                <div className="grid gap-2">
                                    <Label>Filtrar por etapa del Pipeline</Label>
                                    <Select
                                        value={formData.pipelineStageId}
                                        onValueChange={val => setFormData(prev => ({ ...prev, pipelineStageId: val }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar etapa..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {allStages.map(stage => (
                                                <SelectItem key={stage.id} value={String(stage.id)}>
                                                    {stage.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {formData.pipelineStageId && (
                                    <div className="p-4 bg-muted/50 rounded-lg border flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/10 rounded-full">
                                                <Users className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">Destinatarios estimados</p>
                                                <p className="text-xs text-muted-foreground">Basado en los filtros actuales</p>
                                            </div>
                                        </div>
                                        <div className="text-2xl font-bold">
                                            {audiencePreview?.count ?? 0}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className={`space-y-4 ${formData.type === 'email' ? 'max-w-4xl' : 'max-w-xl'}`}>
                                {formData.type === 'whatsapp' ? (
                                    <>
                                        <div className="grid gap-2">
                                            <Label>Plantilla (Opcional)</Label>
                                            <Select
                                                value={formData.templateId}
                                                onValueChange={val => {
                                                    const tpl = templates?.find(t => String(t.id) === val);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        templateId: val,
                                                        message: tpl ? tpl.content : prev.message
                                                    }));
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Cargar desde plantilla..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {templates?.map(t => (
                                                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>Mensaje</Label>
                                            <Textarea
                                                className="min-h-[200px]"
                                                placeholder="Hola {{name}}, tenemos una oferta para ti..."
                                                value={formData.message}
                                                onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                                            />
                                            <p className="text-xs text-muted-foreground text-right">
                                                {formData.message.length} caracteres
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-[600px]">
                                        <EmailEditor ref={emailEditorRef} />
                                    </div>
                                )}
                            </div>
                        )}

                        {currentStep === 4 && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 border rounded-lg space-y-2">
                                        <Label className="text-muted-foreground">Nombre</Label>
                                        <p className="font-medium">{formData.name}</p>
                                    </div>
                                    <div className="p-4 border rounded-lg space-y-2">
                                        <Label className="text-muted-foreground">Canal</Label>
                                        <p className="font-medium capitalize">{formData.type}</p>
                                    </div>
                                </div>

                                <div className="p-4 border rounded-lg space-y-2 bg-muted/20">
                                    <div className="flex justify-between items-center mb-2">
                                        <Label className="text-muted-foreground">Audiencia</Label>
                                        <Badge variant="secondary">{audiencePreview?.count ?? 0} destinatarios</Badge>
                                    </div>
                                    <p className="text-sm">
                                        Etapa: {allStages.find(s => String(s.id) === formData.pipelineStageId)?.name || 'Todos'}
                                    </p>
                                </div>

                                <div className="p-4 border rounded-lg space-y-2">
                                    <Label className="text-muted-foreground">Vista previa del mensaje</Label>
                                    <div className="p-3 bg-green-50 rounded-md text-sm whitespace-pre-wrap border border-green-100">
                                        {formData.message}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-between border-t p-6">
                        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Anterior
                        </Button>

                        {currentStep === 4 ? (
                            <Button onClick={handleFinish} disabled={createCampaign.isPending}>
                                {createCampaign.isPending ? "Creando..." : "Crear Campaña"}
                            </Button>
                        ) : (
                            <Button onClick={handleNext} disabled={
                                (currentStep === 1 && !formData.name) ||
                                (currentStep === 3 && !formData.message)
                            }>
                                Siguiente
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </DashboardLayout>
    );
}
