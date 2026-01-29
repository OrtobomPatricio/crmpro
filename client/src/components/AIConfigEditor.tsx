import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface AIConfigEditorProps {
    query: any;
    updateMutation: any;
}

export function AIConfigEditor({ query, updateMutation }: AIConfigEditorProps) {
    const [form, setForm] = useState({
        provider: "openai" as "openai" | "anthropic",
        apiKey: "",
        model: "",
    });

    useEffect(() => {
        if (query.data?.aiConfig) {
            setForm({
                provider: query.data.aiConfig.provider || "openai",
                apiKey: query.data.aiConfig.apiKey || "",
                model: query.data.aiConfig.model || "",
            });
        }
    }, [query.data]);

    const handleSave = () => {
        updateMutation.mutate({ aiConfig: form }, {
            onSuccess: () => {
                toast.success("Configuración de IA guardada");
            },
            onError: (e: any) => {
                toast.error(`Error: ${e.message}`);
            },
        });
    };

    const modelOptions = {
        openai: [
            { value: "gpt-4", label: "GPT-4 (Más potente)" },
            { value: "gpt-4-turbo-preview", label: "GPT-4 Turbo (Rápido)" },
            { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Económico)" },
        ],
        anthropic: [
            { value: "claude-3-opus", label: "Claude 3 Opus (Mejor)" },
            { value: "claude-3-sonnet", label: "Claude 3 Sonnet (Balanceado)" },
            { value: "claude-3-haiku", label: "Claude 3 Haiku (Rápido)" },
        ],
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5" />
                        Configuración de Inteligencia Artificial
                    </CardTitle>
                    <CardDescription>
                        Conecta un modelo de IA para respuestas automáticas y asistencia inteligente
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <Sparkles className="h-4 w-4" />
                        <AlertDescription>
                            La IA puede ayudar a generar respuestas sugeridas, resumir conversaciones y clasificar leads automáticamente.
                        </AlertDescription>
                    </Alert>

                    <div className="grid gap-2">
                        <Label>Proveedor de IA</Label>
                        <Select value={form.provider} onValueChange={(v: any) => setForm(p => ({ ...p, provider: v, model: "" }))}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="openai">OpenAI (GPT-4, GPT-3.5)</SelectItem>
                                <SelectItem value="anthropic">Anthropic (Claude 3)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="model">Modelo</Label>
                        <Select value={form.model} onValueChange={(v) => setForm(p => ({ ...p, model: v }))}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar modelo" />
                            </SelectTrigger>
                            <SelectContent>
                                {modelOptions[form.provider].map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="apiKey">API Key</Label>
                        <Input
                            id="apiKey"
                            type="password"
                            placeholder={form.provider === "openai" ? "sk-..." : "sk-ant-..."}
                            value={form.apiKey}
                            onChange={(e) => setForm(p => ({ ...p, apiKey: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                            {form.provider === "openai"
                                ? "Obtén tu API key en platform.openai.com"
                                : "Obtén tu API key en console.anthropic.com"
                            }
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending || !form.apiKey || !form.model}
                >
                    {updateMutation.isPending ? "Guardando..." : "Guardar Configuración"}
                </Button>
            </div>
        </div>
    );
}
