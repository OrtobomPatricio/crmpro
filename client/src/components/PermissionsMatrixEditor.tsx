import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PermissionsMatrixEditorProps {
    initialMatrix: Record<string, string[]>;
    onSave: (matrix: Record<string, string[]>) => void;
    isLoading: boolean;
}

export function PermissionsMatrixEditor({
    initialMatrix,
    onSave,
    isLoading
}: PermissionsMatrixEditorProps) {
    const [matrix, setMatrix] = useState(initialMatrix);
    const [newRoleName, setNewRoleName] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        setMatrix(initialMatrix);
    }, [initialMatrix]);

    const roles = useMemo(() => {
        const standard = ["admin", "supervisor", "agent", "viewer"];
        const custom = Object.keys(matrix).filter(r => !standard.includes(r) && r !== 'owner').sort();
        return [...standard, ...custom];
    }, [matrix]);

    const DOMAINS = [
        { key: "dashboard", label: "Dashboard", actions: ["view"] },
        { key: "leads", label: "Leads", actions: ["view", "create", "update", "delete", "export", "import", "assign"] },
        { key: "kanban", label: "Kanban", actions: ["view", "create", "update", "delete", "move"] },
        { key: "chat", label: "Chat", actions: ["view", "send", "assign"] },
        { key: "campaigns", label: "Campañas", actions: ["view", "create", "update", "delete"] },
        { key: "scheduling", label: "Agenda", actions: ["view", "create", "update", "delete"] },
        { key: "monitoring", label: "Monitoreo", actions: ["view", "manage"] },
        { key: "analytics", label: "Analíticas", actions: ["view"] },
        { key: "reports", label: "Reportes", actions: ["view", "export"] },
        { key: "integrations", label: "Integraciones", actions: ["view", "manage"] },
        { key: "settings", label: "Configuración", actions: ["view", "manage"] },
        { key: "users", label: "Usuarios", actions: ["view", "manage"] },
    ];

    const ACTION_LABELS: Record<string, string> = {
        view: "Ver",
        create: "Crear",
        update: "Editar",
        delete: "Eliminar",
        send: "Enviar",
        export: "Exportar",
        import: "Importar",
        assign: "Asignar",
        move: "Mover Etapa",
        manage: "Gestionar"
    };

    const hasPermission = (role: string, domain: string, action: string) => {
        const perms = matrix[role] || [];
        if (perms.includes("*")) return true;
        if (perms.includes(`${domain}.*`)) return true;
        return perms.includes(`${domain}.${action}`);
    };

    const togglePermission = (role: string, domain: string, action: string, checked: boolean) => {
        setMatrix(prev => {
            let current = [...(prev[role] || [])];
            const wildcard = `${domain}.*`;
            const specific = `${domain}.${action}`;

            if (current.includes("*")) return prev;

            if (checked) {
                if (!current.includes(specific) && !current.includes(wildcard)) {
                    current.push(specific);
                }
            } else {
                if (current.includes(wildcard)) {
                    current = current.filter(p => p !== wildcard);
                    const domainConfig = DOMAINS.find(d => d.key === domain);
                    if (domainConfig) {
                        domainConfig.actions.forEach(a => {
                            if (a !== action) current.push(`${domain}.${a}`);
                        });
                    }
                } else {
                    current = current.filter(p => p !== specific);
                }
            }
            return { ...prev, [role]: current };
        });
    };

    const toggleAllInDomain = (role: string, domain: string, checked: boolean) => {
        setMatrix(prev => {
            let current = [...(prev[role] || [])];
            const wildcard = `${domain}.*`;

            if (current.includes("*")) return prev;

            current = current.filter(p => !p.startsWith(`${domain}.`));

            if (checked) {
                current.push(wildcard);
            }

            return { ...prev, [role]: current };
        });
    };

    const addRole = () => {
        if (!newRoleName.trim()) return;
        const key = newRoleName.trim().toLowerCase().replace(/\s+/g, "_");

        if (matrix[key] || ["owner", "admin", "supervisor", "agent", "viewer"].includes(key)) {
            toast.error("El rol ya existe o es reservado");
            return;
        }

        setMatrix(prev => ({ ...prev, [key]: [] }));
        setNewRoleName("");
        setIsAdding(false);
        toast.success(`Rol "${newRoleName}" agregado`);
    };

    const deleteRole = (role: string) => {
        if (confirm(`¿Estás seguro de eliminar el rol "${role}"?`)) {
            setMatrix(prev => {
                const next = { ...prev };
                delete next[role];
                return next;
            });
            toast.success("Rol eliminado");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-muted/20 p-2 rounded-md">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Roles Personalizados:</span>
                    {!isAdding ? (
                        <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}>
                            <Plus className="w-3 h-3 mr-1" /> Nuevo Rol
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Input
                                value={newRoleName}
                                onChange={e => setNewRoleName(e.target.value)}
                                placeholder="Nombre del rol"
                                className="h-8 w-40"
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && addRole()}
                            />
                            <Button size="sm" onClick={addRole}>Crear</Button>
                            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>Cancelar</Button>
                        </div>
                    )}
                </div>
            </div>

            <Tabs defaultValue="agent" className="w-full">
                <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0 justify-start">
                    {roles.map(role => (
                        <div key={role} className="relative group">
                            <TabsTrigger
                                value={role}
                                className="capitalize data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border"
                            >
                                {role}
                            </TabsTrigger>
                            {!["admin", "supervisor", "agent", "viewer"].includes(role) && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteRole(role);
                                    }}
                                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Eliminar rol"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </TabsList>

                {roles.map(role => (
                    <TabsContent key={role} value={role} className="mt-4">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[180px]">Módulo</TableHead>
                                        <TableHead className="text-center">Todo</TableHead>
                                        <TableHead>Acciones Específicas</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {DOMAINS.map((domain) => {
                                        const allChecked = matrix[role]?.includes(`${domain}.*`) || matrix[role]?.includes("*");

                                        return (
                                            <TableRow key={domain.key}>
                                                <TableCell className="font-medium">{domain.label}</TableCell>
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={allChecked}
                                                        onCheckedChange={(c) => toggleAllInDomain(role, domain.key, c as boolean)}
                                                        disabled={matrix[role]?.includes("*")}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-4">
                                                        {domain.actions.map(action => (
                                                            <div key={action} className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`${role}-${domain.key}-${action}`}
                                                                    checked={hasPermission(role, domain.key, action)}
                                                                    onCheckedChange={(c) => togglePermission(role, domain.key, action, c as boolean)}
                                                                    disabled={allChecked || matrix[role]?.includes("*")}
                                                                />
                                                                <Label htmlFor={`${role}-${domain.key}-${action}`} className="cursor-pointer">
                                                                    {ACTION_LABELS[action]}
                                                                </Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                ))}
            </Tabs>

            <div className="flex justify-end">
                <Button onClick={() => onSave(matrix)} disabled={isLoading}>
                    {isLoading ? "Guardando..." : "Guardar Cambios"}
                </Button>
            </div>
        </div>
    );
}
