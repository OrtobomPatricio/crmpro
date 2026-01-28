
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
    Plus,
    Trash2,
    CheckCircle,
    XCircle,
    Clock,
    RefreshCw,
    Globe
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function Templates() {
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        content: "",
        type: "whatsapp",
    });

    const utils = trpc.useUtils();

    // Local Templates
    const { data: localTemplates, isLoading: isLoadingLocal } = trpc.templates.list.useQuery();

    // Meta Templates
    const {
        data: metaTemplates,
        isLoading: isLoadingMeta,
        refetch: refetchMeta,
        isRefetching: isRefetchingMeta,
        error: metaError
    } = trpc.whatsapp.listTemplates.useQuery(undefined, {
        refetchOnWindowFocus: false,
        retry: false
    });

    const createTemplate = trpc.templates.create.useMutation({
        onSuccess: () => {
            utils.templates.list.invalidate();
            setIsOpen(false);
            setFormData({ name: "", content: "", type: "whatsapp" });
            toast.success("Plantilla creada");
        },
        onError: (err) => toast.error(err.message),
    });

    const deleteTemplate = trpc.templates.delete.useMutation({
        onSuccess: () => {
            utils.templates.list.invalidate();
            toast.success("Plantilla eliminada");
        },
    });

    const handleCreate = () => {
        if (!formData.name || !formData.content) return;
        createTemplate.mutate({
            name: formData.name,
            content: formData.content,
            type: formData.type as "whatsapp" | "email",
            variables: []
        });
    };

    const insertVariable = (variable: string) => {
        setFormData(prev => ({
            ...prev,
            content: prev.content + ` {{${variable}}} `
        }));
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "APPROVED":
                return <Badge variant="default" className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Aprobada</Badge>;
            case "REJECTED":
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rechazada</Badge>;
            case "PENDING":
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Plantillas de Mensaje</h1>
                    <p className="text-muted-foreground">
                        Gestiona tus plantillas locales y oficiales de WhatsApp
                    </p>
                </div>
                <div className="flex gap-2">
                    {/* Actions based on Tab? For now keeping Create separated */}
                </div>
            </div>

            <Tabs defaultValue="local" className="w-full">
                <div className="flex justify-between items-center mb-4">
                    <TabsList>
                        <TabsTrigger value="local">Mis Plantillas (Local)</TabsTrigger>
                        <TabsTrigger value="meta">Oficiales (Meta)</TabsTrigger>
                    </TabsList>

                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Nueva Plantilla Local
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                                <DialogTitle>Crear Plantilla Local</DialogTitle>
                                <DialogDescription>
                                    Define un mensaje reutilizable para uso interno.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Nombre</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ej: Bienvenida Cliente Nuevo"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="content">Contenido</Label>
                                    <div className="flex gap-2 mb-2">
                                        <Button variant="outline" size="sm" onClick={() => insertVariable("name")}>+ Nombre</Button>
                                        <Button variant="outline" size="sm" onClick={() => insertVariable("company")}>+ Empresa</Button>
                                    </div>
                                    <Textarea
                                        id="content"
                                        value={formData.content}
                                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                        placeholder="Hola {{name}}, gracias por contactarnos..."
                                        rows={6}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                                <Button onClick={handleCreate}>Guardar Plantilla</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <TabsContent value="local" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {isLoadingLocal ? (
                            [1, 2, 3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)
                        ) : localTemplates?.length === 0 ? (
                            <div className="col-span-full text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                                No hay plantillas locales creadas.
                            </div>
                        ) : (
                            localTemplates?.map((tpl) => (
                                <Card key={tpl.id} className="relative group hover:border-primary/50 transition-colors">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-base truncate pr-6" title={tpl.name}>{tpl.name}</CardTitle>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive absolute top-4 right-4"
                                                onClick={() => deleteTemplate.mutate({ id: tpl.id })}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <CardDescription className="text-xs uppercase font-semibold text-primary">{tpl.type}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4 bg-muted/40 p-3 rounded-md text-xs font-mono">
                                            {tpl.content}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="meta" className="space-y-4">
                    <div className="flex justify-end mb-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetchMeta()}
                            disabled={isRefetchingMeta}
                            className="gap-2"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefetchingMeta ? 'animate-spin' : ''}`} />
                            Sincronizar con Meta
                        </Button>
                    </div>

                    {metaError && (
                        <div className="p-4 rounded-md bg-destructive/10 text-destructive mb-4 text-sm flex items-center gap-2">
                            <XCircle className="w-4 h-4" />
                            No se pudieron cargar las plantillas de Meta. Verifica tu conexión a WhatsApp en Configuración.
                        </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {isLoadingMeta ? (
                            [1, 2, 3].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />)
                        ) : metaTemplates?.length === 0 ? (
                            <div className="col-span-full text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                                No se encontraron plantillas en Meta o no estás conectado.
                            </div>
                        ) : (
                            metaTemplates?.map((tpl: any) => (
                                <Card key={tpl.id} className="overflow-hidden border-l-4 border-l-transparent hover:border-l-primary transition-all">
                                    <CardHeader className="pb-3 bg-muted/5">
                                        <div className="flex justify-between items-start gap-2">
                                            <div>
                                                <CardTitle className="text-base font-semibold">{tpl.name}</CardTitle>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                    <Globe className="w-3 h-3" />
                                                    {tpl.language}
                                                </div>
                                            </div>
                                            {getStatusBadge(tpl.status)}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-4 text-sm">
                                        <div className="bg-muted/30 p-3 rounded-md text-xs space-y-2">
                                            {tpl.components?.find((c: any) => c.type === 'HEADER') && (
                                                <p className="font-bold text-foreground/80">
                                                    {tpl.components.find((c: any) => c.type === 'HEADER').text || '[Media Header]'}
                                                </p>
                                            )}
                                            <p className="whitespace-pre-wrap text-muted-foreground">
                                                {tpl.components?.find((c: any) => c.type === 'BODY')?.text}
                                            </p>
                                            {tpl.components?.find((c: any) => c.type === 'FOOTER') && (
                                                <p className="text-[10px] text-muted-foreground/60 pt-1 border-t mt-1">
                                                    {tpl.components.find((c: any) => c.type === 'FOOTER').text}
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                    <CardFooter className="bg-muted/5 py-2 px-4 text-xs text-muted-foreground flex justify-between">
                                        <span className="capitalize">{tpl.category}</span>
                                        <span className="font-mono opacity-50">ID: {tpl.id}</span>
                                    </CardFooter>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
