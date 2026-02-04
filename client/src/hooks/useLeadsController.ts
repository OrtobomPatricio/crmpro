import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { normalizePhone, isValidE164 } from "@/lib/phone-utils";
import { useLocation } from "wouter";

export interface Lead {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    country: string;
    status: string;
    pipelineStageId: number | null;
    source: string | null;
    notes: string | null;
    commission: string | null;
    customFields?: Record<string, any>;
    createdAt: Date;
}

export function useLeadsController() {
    const [, setLocation] = useLocation();

    // -- Filters & Search State --
    const [searchTerm, setSearchTerm] = useState("");
    const [stageFilter, setStageFilter] = useState<string>("all");

    // -- Dialog State --
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newLead, setNewLead] = useState({
        name: "",
        phone: "",
        email: "",
        country: "",
        source: "",
        notes: "",
    });
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

    // -- Table State --
    const [sortConfig, setSortConfig] = useState<{ key: keyof Lead; direction: 'asc' | 'desc' } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
    const [leadToDelete, setLeadToDelete] = useState<number | null>(null);

    // -- Data Fetching --
    const utils = trpc.useUtils();

    const { data: leads, isLoading } = trpc.leads.list.useQuery({
        pipelineStageId: stageFilter !== "all" ? Number(stageFilter) : undefined,
    });

    const { data: pipelines } = trpc.pipelines.list.useQuery();
    const defaultPipeline = pipelines?.find(p => p.isDefault) || pipelines?.[0];
    const stages = defaultPipeline?.stages || [];

    const { data: customFieldDefs } = trpc.customFields.list.useQuery();

    // -- Mutations --
    const createLeadMutation = trpc.leads.create.useMutation({
        onSuccess: (data) => {
            utils.leads.list.invalidate();
            setIsAddDialogOpen(false);
            setNewLead({ name: "", phone: "", email: "", country: "", source: "", notes: "" });
            setCustomFieldValues({});
            toast.success("Lead creado exitosamente", {
                action: {
                    label: "Iniciar Chat",
                    onClick: () => setLocation(`/chat?leadId=${data.id}`),
                },
                duration: 5000,
            });
        },
        onError: (error) => toast.error("Error al crear el lead: " + error.message),
    });

    const updateStatusMutation = trpc.leads.updateStatus.useMutation({
        onSuccess: () => {
            utils.leads.list.invalidate();
            toast.success("Estado actualizado");
        },
        onError: (error) => toast.error(error.message),
    });

    const deleteLeadMutation = trpc.leads.delete.useMutation({
        onSuccess: () => {
            utils.leads.list.invalidate();
            toast.success("Lead eliminado");
            setLeadToDelete(null);
            setSelectedLeads(prev => prev.filter(id => id !== leadToDelete));
        },
        onError: (error) => toast.error(error.message),
    });

    // -- Handlers --
    const handleCreateLead = () => {
        if (!newLead.name || !newLead.phone || !newLead.country) {
            toast.error("Por favor completa los campos requeridos");
            return;
        }
        const normalizedPhone = normalizePhone(newLead.phone);
        if (!isValidE164(normalizedPhone)) {
            toast.error("El número de teléfono no es válido (E.164). Ejemplo: +595981123456");
            return;
        }

        createLeadMutation.mutate({
            name: newLead.name,
            phone: normalizedPhone,
            email: newLead.email || undefined,
            country: newLead.country,
            source: newLead.source || undefined,
            notes: newLead.notes || undefined,
            customFields: customFieldValues,
        });
    };

    const handleDeleteConfirm = () => {
        if (leadToDelete) deleteLeadMutation.mutate({ id: leadToDelete });
    };

    const handleSort = (key: keyof Lead) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const toggleSelectAll = (paginatedIds: number[]) => {
        if (selectedLeads.length === paginatedIds.length && paginatedIds.length > 0) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(paginatedIds);
        }
    };

    const toggleSelectLead = (id: number) => {
        if (selectedLeads.includes(id)) {
            setSelectedLeads(selectedLeads.filter(l => l !== id));
        } else {
            setSelectedLeads([...selectedLeads, id]);
        }
    };

    // -- Computed Properties (Filtering & Sorting) --
    const processedLeads = useMemo(() => {
        if (!leads) return [];

        let filtered = (leads as Lead[]).filter(
            (lead) =>
                lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lead.phone.includes(searchTerm) ||
                (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        if (sortConfig) {
            filtered.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (aValue === bValue) return 0;
                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }, [leads, searchTerm, sortConfig]);

    const totalPages = Math.ceil(processedLeads.length / pageSize);
    const paginatedLeads = processedLeads.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    // -- Side Effects --
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("action") === "new") {
            setIsAddDialogOpen(true);
            window.history.replaceState({}, "", window.location.pathname);
        }
    }, []);

    return {
        // Data
        leads: processedLeads,
        paginatedLeads,
        stages,
        customFieldDefs,
        isLoading,

        // Pagination
        currentPage,
        setCurrentPage,
        totalPages,
        pageSize,

        // Selection
        selectedLeads,
        toggleSelectAll,
        toggleSelectLead,

        // Sorting
        sortConfig,
        handleSort,

        // State
        searchTerm,
        setSearchTerm,
        stageFilter,
        setStageFilter,
        isAddDialogOpen,
        setIsAddDialogOpen,
        newLead,
        setNewLead,
        customFieldValues,
        setCustomFieldValues,
        leadToDelete,
        setLeadToDelete,

        // Actions
        handleCreateLead,
        isCreating: createLeadMutation.isPending,
        updateStatus: updateStatusMutation.mutate,
        handleDeleteConfirm,
        isDeleting: deleteLeadMutation.isPending,
    };
}
