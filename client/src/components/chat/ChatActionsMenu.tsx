import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, UserPlus, Archive, Ban, User } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

interface ChatActionsMenuProps {
    conversationId: number;
    currentAssignedId: number | null | undefined;
}

export function ChatActionsMenu({ conversationId, currentAssignedId }: ChatActionsMenuProps) {
    const utils = trpc.useContext();
    const [isTransferOpen, setIsTransferOpen] = useState(false);
    const [selectedAgentId, setSelectedAgentId] = useState<string>(currentAssignedId?.toString() || "");

    const { data: agents } = trpc.team.listUsers.useQuery();

    const assignMutation = trpc.chat.assign.useMutation({
        onSuccess: () => {
            toast.success("Chat reasignado correctamente");
            setIsTransferOpen(false);
            utils.chat.getById.invalidate({ id: conversationId });
            utils.chat.listConversations.invalidate();
        },
        onError: (err) => toast.error("Error al reasignar", { description: err.message })
    });

    const statusMutation = trpc.chat.updateStatus.useMutation({
        onSuccess: (data, variables) => {
            const action = variables.status === 'blocked' ? "bloqueado" : "archivado";
            toast.success(`Chat ${action} correctamente`);
            utils.chat.getById.invalidate({ id: conversationId });
            utils.chat.listConversations.invalidate();
        },
        onError: (err) => toast.error("Error al actualizar estado", { description: err.message })
    });

    const handleAssign = () => {
        if (!selectedAgentId) return;
        assignMutation.mutate({
            conversationId,
            assignedToId: parseInt(selectedAgentId)
        });
    };

    const handleArchive = () => {
        if (confirm("¿Estás seguro de archivar este chat? Desaparecerá de la lista principal.")) {
            statusMutation.mutate({ conversationId, status: "archived" });
        }
    };

    const handleBlock = () => {
        if (confirm("¿Bloquear este contacto? No recibirás más mensajes.")) {
            statusMutation.mutate({ conversationId, status: "blocked" });
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones del Chat</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsTransferOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Transferir Agente
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleArchive}>
                        <Archive className="mr-2 h-4 w-4" />
                        Archivar Chat
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleBlock} className="text-destructive focus:text-destructive">
                        <Ban className="mr-2 h-4 w-4" />
                        Bloquear Contacto
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Transfer Dialog */}
            <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Transferir Chat</DialogTitle>
                        <DialogDescription>
                            Selecciona el agente al que deseas asignar esta conversación.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Agente Destino</Label>
                            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar agente..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {agents?.map(agent => (
                                        <SelectItem key={agent.id} value={agent.id.toString()}>
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 opacity-50" />
                                                <span>{agent.name}</span>
                                                <span className="text-xs text-muted-foreground ml-auto uppercase">{agent.role}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTransferOpen(false)}>Cancelar</Button>
                        <Button onClick={handleAssign} disabled={assignMutation.isPending}>
                            {assignMutation.isPending ? "Asignando..." : "Confirmar Transferencia"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
