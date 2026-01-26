import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import { AMERICAS_COUNTRIES } from "@/_core/data/americasCountries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Filter,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";

type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "negotiation"
  | "won"
  | "lost";

interface Lead {
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

const statusConfig: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: "Nuevo", className: "bg-info/15 text-info border-info/20 hover:bg-info/25" },
  contacted: { label: "Contactado", className: "bg-warning/15 text-warning border-warning/20 hover:bg-warning/25" },
  qualified: { label: "Calificado", className: "bg-primary/15 text-primary border-primary/20 hover:bg-primary/25" },
  negotiation: {
    label: "Negociación",
    className: "bg-primary/25 text-primary border-primary/30 hover:bg-primary/35",
  },
  won: { label: "Ganado", className: "bg-success/15 text-success border-success/20 hover:bg-success/25" },
  lost: { label: "Perdido", className: "bg-destructive/15 text-destructive border-destructive/20 hover:bg-destructive/25" },
};

const countries = AMERICAS_COUNTRIES.map((c) => ({ value: c.value, label: c.label }));

export default function Leads() {
  return (
    <DashboardLayout>
      <LeadsContent />
    </DashboardLayout>
  );
}

function LeadsContent() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newLead, setNewLead] = useState({
    name: "",
    phone: "",
    email: "",
    country: "",
    source: "",
    notes: "",
  });

  // Advanced Table State
  const [sortConfig, setSortConfig] = useState<{ key: keyof Lead; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);

  const utils = trpc.useUtils();
  const { data: leads, isLoading } = trpc.leads.list.useQuery({
    pipelineStageId: stageFilter !== "all" ? Number(stageFilter) : undefined,
  });
  const { data: pipelines } = trpc.pipelines.list.useQuery();
  const defaultPipeline = pipelines?.find(p => p.isDefault) || pipelines?.[0];
  const stages = defaultPipeline?.stages || [];

  const { data: customFieldDefs } = trpc.customFields.list.useQuery();
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // Auto-open dialog if URL has ?action=new
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new") {
      setIsAddDialogOpen(true);
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const createLead = trpc.leads.create.useMutation({
    onSuccess: (data) => {
      utils.leads.list.invalidate();
      setIsAddDialogOpen(false);
      setNewLead({ name: "", phone: "", email: "", country: "", source: "", notes: "" });

      toast.success("Lead creado exitosamente", {
        action: {
          label: "Iniciar Chat",
          onClick: () => setLocation(`/chat?leadId=${data.id}`),
        },
        duration: 5000,
      });
    },
    onError: (error) => {
      toast.error("Error al crear el lead: " + error.message);
    },
  });

  const updateStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      toast.success("Estado actualizado");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteLead = trpc.leads.delete.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      toast.success("Lead eliminado");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleCreateLead = () => {
    if (!newLead.name || !newLead.phone || !newLead.country) {
      toast.error("Por favor completa los campos requeridos");
      return;
    }
    createLead.mutate({
      name: newLead.name,
      phone: newLead.phone,
      email: newLead.email || undefined,
      country: newLead.country,
      source: newLead.source || undefined,
      notes: newLead.notes || undefined,
      customFields: customFieldValues,
    });
  };

  // Sorting Logic
  const handleSort = (key: keyof Lead) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filtering, Sorting & Pagination
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

  const toggleSelectAll = () => {
    if (selectedLeads.length === paginatedLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(paginatedLeads.map(l => l.id));
    }
  };

  const toggleSelectLead = (id: number) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter(l => l !== id));
    } else {
      setSelectedLeads([...selectedLeads, id]);
    }
  };

  const formatCommission = (commission: string | null) => {
    if (!commission) return "0 G$";
    const num = Number.parseFloat(commission);
    if (Number.isNaN(num)) return "0 G$";
    return `${num.toLocaleString()} G$`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">Gestiona y contacta a tus clientes potenciales.</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Lead
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Lead</DialogTitle>
              <DialogDescription>Agrega un nuevo lead al sistema.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  placeholder="Nombre completo"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono *</Label>
                <Input
                  id="phone"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  placeholder="+507 6123-4567"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="country">País *</Label>
                <Select value={newLead.country} onValueChange={(value) => setNewLead({ ...newLead, country: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un país" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="source">Fuente</Label>
                <Input
                  id="source"
                  value={newLead.source}
                  onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                  placeholder="Facebook, Referido, etc."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                  placeholder="Notas adicionales..."
                />
              </div>

              {customFieldDefs?.map((field: any) => (
                <div key={field.id} className="grid gap-2">
                  <Label htmlFor={`field-${field.id}`}>{field.name}</Label>
                  {field.type === 'select' && field.options ? (
                    <Select
                      value={customFieldValues[field.id] || ""}
                      onValueChange={(val) => setCustomFieldValues(prev => ({ ...prev, [field.id]: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((opt: string) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`field-${field.id}`}
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={customFieldValues[field.id] || ""}
                      onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                      placeholder={field.name}
                    />
                  )}
                </div>
              ))}
            </div>


            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateLead} disabled={createLead.isPending}>
                {createLead.isPending ? "Creando..." : "Crear Lead"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, teléfono o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={stageFilter} onValueChange={(value) => setStageFilter(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las etapas</SelectItem>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={String(stage.id)}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLeads.length > 0 && (
            <div className="mt-4 p-2 bg-muted/50 rounded-md flex items-center gap-2 text-sm text-muted-foreground animate-in slide-in-from-top-2">
              <span className="font-medium text-foreground">{selectedLeads.length} seleccionados</span>
              <div className="h-4 w-px bg-border mx-2" />
              <Button variant="ghost" size="sm" className="h-7 text-xs" disabled>
                Eliminar (Próximamente)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Leads Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Lista de Leads</CardTitle>
          <CardDescription>
            {processedLeads.length} resultados encontrados.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {processedLeads.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-lg">No se encontraron leads</h3>
              <p className="text-muted-foreground">Intenta ajustar los filtros o agrega un nuevo lead.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[30px]">
                        <Checkbox
                          checked={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-[250px]">
                        <Button variant="ghost" className="h-8 -ml-3" onClick={() => handleSort('name')}>
                          Nombre
                          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                        </Button>
                      </TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>País</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>
                        <Button variant="ghost" className="h-8 -ml-3" onClick={() => handleSort('commission')}>
                          Comisión
                          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" className="h-8 -ml-3" onClick={() => handleSort('createdAt')}>
                          Fecha
                          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {paginatedLeads.map((lead) => (
                      <TableRow key={lead.id} className="group">
                        <TableCell>
                          <Checkbox
                            checked={selectedLeads.includes(lead.id)}
                            onCheckedChange={() => toggleSelectLead(lead.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-base">{lead.name}</div>
                          <div className="text-xs text-muted-foreground">{lead.source || "Sin fuente"}</div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {lead.phone}
                            </div>
                            {lead.email && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {lead.email}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {lead.country}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              lead.pipelineStageId
                                ? "bg-secondary text-secondary-foreground border-border"
                                : statusConfig[lead.status as LeadStatus]?.className
                            }
                            style={lead.pipelineStageId ? {
                              borderColor: stages.find((s: any) => s.id === lead.pipelineStageId)?.color || undefined,
                              color: stages.find((s: any) => s.id === lead.pipelineStageId)?.color || undefined,
                            } : undefined}
                          >
                            {stages.find((s: any) => s.id === lead.pipelineStageId)?.name || lead.status}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatCommission(lead.commission)}
                          </div>
                        </TableCell>

                        <TableCell className="text-muted-foreground text-sm">{formatDate(lead.createdAt)}</TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-whatsapp hover:text-whatsapp hover:bg-whatsapp/10"
                              onClick={() => setLocation('/chat')}
                              title="Iniciar Chat en WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>

                              <DropdownMenuContent align="end">
                                {stages.map((stage: any) => (
                                  <DropdownMenuItem
                                    key={stage.id}
                                    onClick={() =>
                                      updateStatus.mutate({
                                        id: lead.id,
                                        pipelineStageId: stage.id,
                                      })
                                    }
                                    disabled={lead.pipelineStageId === stage.id}
                                  >
                                    Mover a {stage.name}
                                  </DropdownMenuItem>
                                ))}

                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                  onClick={() => deleteLead.mutate({ id: lead.id })}
                                >
                                  Eliminar Lead
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-2">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
