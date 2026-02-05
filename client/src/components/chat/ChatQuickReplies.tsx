import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Plus, Search, Image as ImageIcon, FileText, Trash2, Edit2, Check } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import axios from "axios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

interface Template {
    id: number;
    name: string;
    content: string;
    type: 'whatsapp' | 'email';
    attachments?: { url: string; name: string; type: string }[] | null;
}

interface ChatQuickRepliesProps {
    onSelect: (content: string, attachments?: { url: string; name: string; type: string }[]) => void;
}

export function ChatQuickReplies({ onSelect }: ChatQuickRepliesProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [formData, setFormData] = useState({ name: "", content: "" });
    const [attachments, setAttachments] = useState<{ url: string; name: string; type: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const utils = trpc.useContext();
    const { data: templates } = trpc.templates.list.useQuery();

    const createMutation = trpc.templates.create.useMutation({
        onSuccess: () => {
            toast.success("Plantilla creada");
            utils.templates.list.invalidate();
            setIsCreateOpen(false);
            resetForm();
        }
    });

    const updateMutation = trpc.templates.update.useMutation({
        onSuccess: () => {
            toast.success("Plantilla actualizada");
            utils.templates.list.invalidate();
            setIsCreateOpen(false);
            resetForm();
        }
    });

    const deleteMutation = trpc.templates.delete.useMutation({
        onSuccess: () => {
            toast.success("Plantilla eliminada");
            utils.templates.list.invalidate();
        }
    });

    const resetForm = () => {
        setFormData({ name: "", content: "" });
        setAttachments([]);
        setEditingTemplate(null);
        setIsEditMode(false);
    };

    const handleOpenCreate = () => {
        resetForm();
        setIsCreateOpen(true);
    };

    const handleEdit = (t: any) => {
        setEditingTemplate(t);
        setFormData({ name: t.name, content: t.content });
        setAttachments((t.attachments as any) || []);
        setIsEditMode(true);
        setIsCreateOpen(true);
    };

    const handleDelete = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("¿Eliminar esta plantilla?")) {
            deleteMutation.mutate({ id });
        }
    };

    const handleSave = () => {
        if (!formData.name || !formData.content) return toast.error("Completa nombre y contenido");

        const payload = {
            name: formData.name,
            content: formData.content,
            type: 'whatsapp' as const,
            attachments: attachments
        };

        if (isEditMode && editingTemplate) {
            updateMutation.mutate({ id: editingTemplate.id, ...payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        const form = new FormData();
        form.append('files', file);

        try {
            const res = await axios.post('/api/upload', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true
            });
            const uploaded = res.data.files[0];
            setAttachments(prev => [...prev, {
                url: uploaded.url || `/api/uploads/${uploaded.filename}`,
                name: uploaded.originalname,
                type: uploaded.mimetype
            }]);
        } catch (err) {
            toast.error("Error subiendo archivo");
        }
    };

    const whatsappTemplates = templates?.filter(t => t.type === 'whatsapp')
        .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.content.toLowerCase().includes(searchTerm.toLowerCase())) || [];

    return (
        <>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10 rounded-full transition-colors">
                        <Zap className="h-5 w-5" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-80 p-0 overflow-hidden shadow-xl border-border/60">
                    <div className="p-3 bg-muted/30 border-b flex items-center justify-between gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Buscar respuestas..."
                                className="h-8 pl-8 text-xs bg-background"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleOpenCreate}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    <ScrollArea className="h-[300px]">
                        <div className="p-1 space-y-1">
                            {whatsappTemplates.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground text-xs">
                                    No hay respuestas rápidas.
                                    <br />
                                    ¡Crea una para empezar!
                                </div>
                            ) : (
                                whatsappTemplates.map(t => (
                                    <div
                                        key={t.id}
                                        className="group flex flex-col gap-1 p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors relative"
                                        onClick={() => {
                                            onSelect(t.content, t.attachments as any);
                                            setIsOpen(false);
                                        }}
                                    >
                                        <div className="flex items-start justify-between">
                                            <span className="font-medium text-sm text-foreground/90">{t.name}</span>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleEdit(t); }}>
                                                    <Edit2 className="h-3 w-3" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive" onClick={(e) => handleDelete(t.id, e)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">{t.content}</p>
                                        {(t.attachments as any)?.length > 0 && (
                                            <div className="flex gap-1 mt-1">
                                                {(t.attachments as any).map((a: any, i: number) => (
                                                    <div key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded border flex items-center gap-1">
                                                        {a.type.startsWith('image') ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                                                        <span className="truncate max-w-[60px]">{a.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </PopoverContent>
            </Popover>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? "Editar Respuesta Rápida" : "Nueva Respuesta Rápida"}</DialogTitle>
                        <DialogDescription>Configura mensajes predefinidos para agilizar tu atención.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Nombre (Atajo)</Label>
                            <Input
                                placeholder="Ej: Bienvenida, Precios..."
                                value={formData.name}
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Mensaje</Label>
                            <Textarea
                                placeholder="Escribe el mensaje aquí..."
                                className="min-h-[100px]"
                                value={formData.content}
                                onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Adjuntos (Opcional)</Label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {attachments.map((a, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-muted px-2 py-1 rounded text-xs border">
                                        <span className="truncate max-w-[120px]">{a.name}</span>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-4 w-4 rounded-full hover:bg-background"
                                            onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                    <ImageIcon className="h-4 w-4 mr-2" />
                                    Agregar Archivo
                                </Button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                            {createMutation.isPending || updateMutation.isPending ? "Guardando..." : "Guardar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
