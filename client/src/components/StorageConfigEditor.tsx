import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Cloud, HardDrive, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface StorageConfigEditorProps {
    query: any;
    updateMutation: any;
}

export function StorageConfigEditor({ query, updateMutation }: StorageConfigEditorProps) {
    const [form, setForm] = useState({
        provider: "forge" as "forge" | "s3",
        bucket: "",
        region: "",
        accessKey: "",
        secretKey: "",
        endpoint: "",
        publicUrl: "",
    });

    useEffect(() => {
        if (query.data?.storageConfig) {
            setForm({
                provider: query.data.storageConfig.provider || "forge",
                bucket: query.data.storageConfig.bucket || "",
                region: query.data.storageConfig.region || "",
                accessKey: query.data.storageConfig.accessKey || "",
                secretKey: query.data.storageConfig.secretKey || "",
                endpoint: query.data.storageConfig.endpoint || "",
                publicUrl: query.data.storageConfig.publicUrl || "",
            });
        }
    }, [query.data]);

    const handleSave = () => {
        updateMutation.mutate({ storageConfig: form }, {
            onSuccess: () => {
                toast.success("Configuración de almacenamiento guardada");
            },
            onError: (e: any) => {
                toast.error(`Error: ${e.message}`);
            },
        });
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Proveedor de Almacenamiento</CardTitle>
                    <CardDescription>
                        Configura dónde se almacenarán los archivos adjuntos y multimedia
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Proveedor</Label>
                        <Select value={form.provider} onValueChange={(v: any) => setForm(p => ({ ...p, provider: v }))}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="forge">
                                    <div className="flex items-center gap-2">
                                        <HardDrive className="w-4 h-4" />
                                        Laravel Forge (Servidor Local)
                                    </div>
                                </SelectItem>
                                <SelectItem value="s3">
                                    <div className="flex items-center gap-2">
                                        <Cloud className="w-4 h-4" />
                                        Amazon S3 / Compatible
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {form.provider === "forge" && (
                        <Alert>
                            <HardDrive className="h-4 w-4" />
                            <AlertDescription>
                                Los archivos se almacenarán en el directorio local del servidor. Asegúrate de tener suficiente espacio en disco.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {form.provider === "s3" && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Configuración de S3</CardTitle>
                            <CardDescription>
                                Credenciales y configuración para Amazon S3 o servicios compatibles (DigitalOcean Spaces, Wasabi, etc.)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="bucket">Bucket Name</Label>
                                    <Input
                                        id="bucket"
                                        placeholder="mi-crm-uploads"
                                        value={form.bucket}
                                        onChange={(e) => setForm(p => ({ ...p, bucket: e.target.value }))}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="region">Region</Label>
                                    <Input
                                        id="region"
                                        placeholder="us-east-1"
                                        value={form.region}
                                        onChange={(e) => setForm(p => ({ ...p, region: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="accessKey">Access Key ID</Label>
                                <Input
                                    id="accessKey"
                                    placeholder="AKIAIOSFODNN7EXAMPLE"
                                    value={form.accessKey}
                                    onChange={(e) => setForm(p => ({ ...p, accessKey: e.target.value }))}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="secretKey">Secret Access Key</Label>
                                <Input
                                    id="secretKey"
                                    type="password"
                                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                    value={form.secretKey}
                                    onChange={(e) => setForm(p => ({ ...p, secretKey: e.target.value }))}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="endpoint">Endpoint (opcional)</Label>
                                <Input
                                    id="endpoint"
                                    placeholder="https://nyc3.digitaloceanspaces.com"
                                    value={form.endpoint}
                                    onChange={(e) => setForm(p => ({ ...p, endpoint: e.target.value }))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Solo necesario para servicios compatibles con S3 (no AWS S3)
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="publicUrl">Public URL (opcional)</Label>
                                <Input
                                    id="publicUrl"
                                    placeholder="https://cdn.miempresa.com"
                                    value={form.publicUrl}
                                    onChange={(e) => setForm(p => ({ ...p, publicUrl: e.target.value }))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    URL pública para acceder a los archivos (CDN)
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Estado de Configuración</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                <span className="text-sm">
                                    Proveedor: <strong>{form.provider === "s3" ? "Amazon S3" : "Forge Local"}</strong>
                                </span>
                            </div>
                            {form.bucket && (
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    <span className="text-sm">
                                        Bucket: <strong>{form.bucket}</strong>
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            <div className="flex justify-end gap-2">
                <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending || (form.provider === "s3" && (!form.bucket || !form.accessKey || !form.secretKey))}
                >
                    {updateMutation.isPending ? "Guardando..." : "Guardar Configuración"}
                </Button>
            </div>
        </div>
    );
}
