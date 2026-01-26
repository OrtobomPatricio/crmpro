
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
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
    FileText,
    Copy
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Templates() {
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        content: "",
        type: "whatsapp",
    });

    const utils = trpc.useUtils();
    const { data: templates, isLoading } = trpc.templates.list.useQuery();

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
            variables: [] // Extract from content in backend or frontend? Let's just pass empty for now or parse regex.
        });
    };

    const insertVariable = (variable: string) => {
        setFormData(prev => ({
            ...prev,
            content: prev.content + ` {{${variable}}} `
        }));
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Plantillas de Mensaje</h1>
                        <p className="text-muted-foreground">
                            Crea mensajes reutilizables para tus campañas
                        </p>
                    </div>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Nueva Plantilla
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                                <DialogTitle>Crear Plantilla</DialogTitle>
                                <DialogDescription>
                                    Define un mensaje reutilizable. Usa variables como {"{{name}}"} para personalizar.
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

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {isLoading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)
                    ) : templates?.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            No hay plantillas creadas.
                        </div>
                    ) : (
                        templates?.map((tpl) => (
                            <Card key={tpl.id} className="relative group hover:border-primary/50 transition-colors">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-base">{tpl.name}</CardTitle>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                            onClick={() => deleteTemplate.mutate({ id: tpl.id })}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <CardDescription className="text-xs uppercase">{tpl.type}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4 bg-muted/30 p-2 rounded border">
                                        {tpl.content}
                                    </p>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
