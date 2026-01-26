import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import { AMERICAS_COUNTRIES } from "@/_core/data/americasCountries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  DollarSign,
  Filter,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
} from "lucide-react";
import { useState } from "react";
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
  status: string; // Deprecated, use pipelineStageId
  pipelineStageId: number | null;
  source: string | null;
  notes: string | null;
  commission: string | null;
  customFields?: Record<string, any>;
  createdAt: Date;
}

const statusConfig: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: "Nuevo", className: "bg-blue-100 text-blue-800" },
  contacted: { label: "Contactado", className: "bg-yellow-100 text-yellow-800" },
  qualified: { label: "Calificado", className: "bg-purple-100 text-purple-800" },
  negotiation: {
    label: "Negociación",
    className: "bg-orange-100 text-orange-800",
  },
  won: { label: "Ganado", className: "bg-green-100 text-green-800" },
  lost: { label: "Perdido", className: "bg-red-100 text-red-800" },
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

  const utils = trpc.useUtils();
  const { data: leads, isLoading } = trpc.leads.list.useQuery({
    pipelineStageId: stageFilter !== "all" ? Number(stageFilter) : undefined,
  });
  const { data: pipelines } = trpc.pipelines.list.useQuery();
  const defaultPipeline = pipelines?.find(p => p.isDefault) || pipelines?.[0];
  const stages = defaultPipeline?.stages || [];

  const { data: customFieldDefs } = trpc.customFields.list.useQuery();
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      setIsAddDialogOpen(false);
      setNewLead({ name: "", phone: "", email: "", country: "", source: "", notes: "" });
      toast.success("Lead creado exitosamente");
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

  const typedLeads = (leads ?? []) as Lead[];
  const filteredLeads = typedLeads.filter(
    (lead) =>
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">Gestiona todos tus leads en un solo lugar</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
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

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
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
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Leads</CardTitle>
          <CardDescription>{filteredLeads.length} leads encontrados</CardDescription>
        </CardHeader>

        <CardContent>
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No se encontraron leads</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Comisión</TableHead>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {lead.phone}
                          </div>
                          {lead.email && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {lead.country}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          style={{
                            backgroundColor: stages.find((s: any) => s.id === lead.pipelineStageId)?.color ?? "#e2e8f0",
                            color: "#1e293b"
                          }}
                        >
                          {stages.find((s: any) => s.id === lead.pipelineStageId)?.name || lead.status}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1 text-green-600 font-medium">
                          <DollarSign className="h-3 w-3" />
                          {formatCommission(lead.commission)}
                        </div>
                      </TableCell>

                      <TableCell>
                        {lead.source ? (
                          <Badge variant="outline">{lead.source}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-muted-foreground">{formatDate(lead.createdAt)}</TableCell>

                      <TableCell>
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
                              className="text-destructive"
                              onClick={() => deleteLead.mutate({ id: lead.id })}
                            >
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div >
  );
}
