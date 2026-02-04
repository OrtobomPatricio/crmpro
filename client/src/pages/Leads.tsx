import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AMERICAS_COUNTRIES } from "@/_core/data/americasCountries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useLocation } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useLeadsController, type Lead } from "@/hooks/useLeadsController";

// UI Config
const statusConfig: Record<string, { label: string; className: string }> = {
  new: { label: "Nuevo", className: "bg-info/15 text-info border-info/20 hover:bg-info/25" },
  contacted: { label: "Contactado", className: "bg-warning/15 text-warning border-warning/20 hover:bg-warning/25" },
  qualified: { label: "Calificado", className: "bg-primary/15 text-primary border-primary/20 hover:bg-primary/25" },
  negotiation: { label: "Negociación", className: "bg-primary/25 text-primary border-primary/30 hover:bg-primary/35" },
  won: { label: "Ganado", className: "bg-success/15 text-success border-success/20 hover:bg-success/25" },
  lost: { label: "Perdido", className: "bg-destructive/15 text-destructive border-destructive/20 hover:bg-destructive/25" },
};

const countries = AMERICAS_COUNTRIES.map((c) => ({ value: c.value, label: c.label }));

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

import { Skeleton } from "@/components/ui/skeleton";

function LeadStatusBadge({ lead, stages }: { lead: Lead; stages: any[] }) {
  const stage = lead.pipelineStageId ? stages.find((s) => s.id === lead.pipelineStageId) : null;

  if (stage) {
    return (
      <Badge
        variant="outline"
        className="bg-secondary/50 text-secondary-foreground"
        style={{
          borderColor: stage.color,
          color: stage.color,
        }}
      >
        {stage.name}
      </Badge>
    );
  }

  const config = statusConfig[lead.status];
  return (
    <Badge variant="outline" className={config?.className || ""}>
      {config?.label || lead.status}
    </Badge>
  );
}

export default function Leads() {
  const controller = useLeadsController();
  const [, setLocation] = useLocation();

  if (controller.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-[180px]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Create Dialog */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">Gestiona y contacta a tus clientes potenciales.</p>
        </div>

        <Dialog open={controller.isAddDialogOpen} onOpenChange={controller.setIsAddDialogOpen}>
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

            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
              {/* Basic Fields */}
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={controller.newLead.name}
                  onChange={(e) => controller.setNewLead({ ...controller.newLead, name: e.target.value })}
                  placeholder="Nombre completo"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono *</Label>
                <Input
                  id="phone"
                  value={controller.newLead.phone}
                  onChange={(e) => controller.setNewLead({ ...controller.newLead, phone: e.target.value })}
                  placeholder="+507 6123-4567"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={controller.newLead.email}
                  onChange={(e) => controller.setNewLead({ ...controller.newLead, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="country">País *</Label>
                <Select
                  value={controller.newLead.country}
                  onValueChange={(value) => controller.setNewLead({ ...controller.newLead, country: value })}
                >
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

              {/* Extras */}
              <div className="grid gap-2">
                <Label htmlFor="source">Fuente</Label>
                <Input
                  id="source"
                  value={controller.newLead.source || ""}
                  onChange={(e) => controller.setNewLead({ ...controller.newLead, source: e.target.value })}
                  placeholder="Facebook, Referido, etc."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={controller.newLead.notes || ""}
                  onChange={(e) => controller.setNewLead({ ...controller.newLead, notes: e.target.value })}
                  placeholder="Notas adicionales..."
                />
              </div>

              {/* Custom Fields */}
              {controller.customFieldDefs?.map((field: any) => (
                <div key={field.id} className="grid gap-2">
                  <Label htmlFor={`field-${field.id}`}>{field.name}</Label>
                  {field.type === 'select' && field.options ? (
                    <Select
                      value={controller.customFieldValues[field.id] || ""}
                      onValueChange={(val) => controller.setCustomFieldValues(prev => ({ ...prev, [field.id]: val }))}
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
                      value={controller.customFieldValues[field.id] || ""}
                      onChange={(e) => controller.setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                      placeholder={field.name}
                    />
                  )}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => controller.setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={controller.handleCreateLead} disabled={controller.isCreating}>
                {controller.isCreating ? "Creando..." : "Crear Lead"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, teléfono o email..."
                value={controller.searchTerm}
                onChange={(e) => controller.setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={controller.stageFilter} onValueChange={controller.setStageFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las etapas</SelectItem>
                {controller.stages.map((stage) => (
                  <SelectItem key={stage.id} value={String(stage.id)}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {controller.selectedLeads.length > 0 && (
            <div className="mt-4 p-2 bg-muted/50 rounded-md flex items-center gap-2 text-sm text-muted-foreground animate-in slide-in-from-top-2">
              <span className="font-medium text-foreground">{controller.selectedLeads.length} seleccionados</span>
              <div className="h-4 w-px bg-border mx-2" />
              <Button variant="ghost" size="sm" className="h-7 text-xs" disabled>
                Eliminar (Próximamente)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Lista de Leads</CardTitle>
          <CardDescription>
            {controller.leads.length} resultados encontrados.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {controller.leads.length === 0 ? (
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
                          checked={
                            controller.selectedLeads.length === controller.paginatedLeads.length &&
                            controller.paginatedLeads.length > 0
                          }
                          onCheckedChange={() => controller.toggleSelectAll(controller.paginatedLeads.map(l => l.id))}
                        />
                      </TableHead>
                      <TableHead className="w-[250px]">
                        <Button variant="ghost" className="h-8 -ml-3" onClick={() => controller.handleSort('name')}>
                          Nombre
                          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                        </Button>
                      </TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>País</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>
                        <Button variant="ghost" className="h-8 -ml-3" onClick={() => controller.handleSort('commission')}>
                          Comisión
                          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button variant="ghost" className="h-8 -ml-3" onClick={() => controller.handleSort('createdAt')}>
                          Fecha
                          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {controller.paginatedLeads.map((lead) => (
                      <TableRow key={lead.id} className="group">
                        <TableCell>
                          <Checkbox
                            checked={controller.selectedLeads.includes(lead.id)}
                            onCheckedChange={() => controller.toggleSelectLead(lead.id)}
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
                          <LeadStatusBadge lead={lead} stages={controller.stages} />
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
                              onClick={() => setLocation(`/chat?leadId=${lead.id}`)}
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
                                {controller.stages.map((stage: any) => (
                                  <DropdownMenuItem
                                    key={stage.id}
                                    onClick={() =>
                                      controller.updateStatus({
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
                                  onClick={() => controller.setLeadToDelete(lead.id)}
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
                  Página {controller.currentPage} de {controller.totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => controller.setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={controller.currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => controller.setCurrentPage(p => Math.min(controller.totalPages, p + 1))}
                    disabled={controller.currentPage === controller.totalPages}
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

      <ConfirmDialog
        open={!!controller.leadToDelete}
        onOpenChange={(open) => !open && controller.setLeadToDelete(null)}
        onConfirm={controller.handleDeleteConfirm}
        title="¿Eliminar Lead?"
        description="Esta acción eliminará permanentemente al lead y todo su historial. No se puede deshacer."
        confirmText="Eliminar"
        variant="destructive"
        isLoading={controller.isDeleting}
      />
    </div>
  );
}
