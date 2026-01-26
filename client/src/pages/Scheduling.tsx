import { useState, useMemo, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings,
  Trash2,
  Check,
  ChevronsUpDown,
  Search,
  MessageSquare,
  Clock
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function Scheduling() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [isDayViewOpen, setIsDayViewOpen] = useState(false);

  // Dialogs
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isReasonsDialogOpen, setIsReasonsDialogOpen] = useState(false);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [reasonId, setReasonId] = useState<string>("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [notes, setNotes] = useState("");

  // Queries
  const { data: appointments = [], refetch: refetchAppointments } = trpc.scheduling.list.useQuery();
  const { data: reasons = [], refetch: refetchReasons } = trpc.scheduling.listReasons.useQuery();
  const { data: schedRules, refetch: refetchRules } = trpc.settings.getScheduling.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Mutations
  const createAppointment = trpc.scheduling.create.useMutation({
    onSuccess: () => {
      toast.success("Cita agendada correctamente");
      refetchAppointments();
      resetForm();
      setIsNewAppointmentOpen(false);
    },
    onError: (error) => toast.error("Error al agendar: " + error.message),
  });

  const deleteReason = trpc.scheduling.deleteReason.useMutation({
    onSuccess: () => {
      toast.success("Motivo eliminado");
      refetchReasons();
    },
  });

  const createReason = trpc.scheduling.createReason.useMutation({
    onSuccess: () => {
      toast.success("Motivo creado");
      refetchReasons();
    },
  });

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setReasonId("");
    if (!appointmentTime) setAppointmentTime("09:00");
    setNotes("");
  };

  const handleLeadSelect = (lead: any) => {
    setFirstName(lead.name.split(" ")[0] || "");
    setLastName(lead.name.split(" ").slice(1).join(" ") || "");
    setPhone(lead.phone || "");
    setEmail(lead.email || "");
  };

  // Calendar Logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = monthStart.getDay();
  const emptyDays = Array(firstDayOfWeek).fill(null);

  const appointmentsByDate = useMemo(() => {
    const grouped: Record<string, typeof appointments> = {};
    appointments.forEach((apt) => {
      const dateKey = format(new Date(apt.appointmentDate), "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(apt);
    });
    return grouped;
  }, [appointments]);

  const selectedDateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedDateAppointments = selectedDateKey ? appointmentsByDate[selectedDateKey] || [] : [];

  const maxPerSlot = schedRules?.maxPerSlot ?? 6;
  const slotMinutes = schedRules?.slotMinutes ?? 15;
  const allowCustomTime = schedRules?.allowCustomTime ?? true;

  const selectedSlotCount = appointmentTime
    ? selectedDateAppointments.filter((a) => a.appointmentTime === appointmentTime).length
    : 0;
  const slotIsFull = selectedSlotCount >= maxPerSlot;

  const handleCreateAppointment = () => {
    if (!selectedDate || !firstName || !phone || !appointmentTime) {
      toast.error("Complete los campos obligatorios");
      return;
    }
    if (slotIsFull) {
      toast.error("Horario lleno");
      return;
    }

    createAppointment.mutate({
      firstName,
      lastName,
      phone,
      email: email || undefined,
      reasonId: reasonId ? parseInt(reasonId) : undefined,
      appointmentDate: selectedDate.toISOString(),
      appointmentTime,
      notes: notes || undefined,
    });
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setIsDayViewOpen(true);
  };

  const openNewAppointment = (date?: Date) => {
    if (date) setSelectedDate(date);
    // If no date selected, default to today or keep previous
    if (!selectedDate && !date) setSelectedDate(new Date());

    // Reset form but keep date
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setReasonId("");
    if (!appointmentTime) setAppointmentTime("09:00");
    setNotes("");

    setIsDayViewOpen(false); // Close day view if open
    setIsNewAppointmentOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agendamiento</h1>
            <p className="text-muted-foreground">Gestiona tus citas y recordatorios</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => openNewAppointment(new Date())}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Cita
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsConfigOpen(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Configurar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsTemplatesOpen(true)}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Plantillas
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsReasonsDialogOpen(true)}>
              <div className="w-4 h-4 mr-2 rounded-full border border-current" />
              Motivos
            </Button>
          </div>
        </div>

        {/* ... Dialogs for Config, Templates, Reasons remain same ... */}
        <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configuración de Agenda</DialogTitle>
            </DialogHeader>
            <SchedulingConfigForm
              initialData={schedRules}
              onSave={() => {
                refetchRules();
                setIsConfigOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Plantillas de Recordatorio</DialogTitle>
              <DialogDescription>Mensajes automáticos enviados por WhatsApp</DialogDescription>
            </DialogHeader>
            <ReminderTemplatesManager />
          </DialogContent>
        </Dialog>

        <ReasonsManager
          isOpen={isReasonsDialogOpen}
          onClose={() => setIsReasonsDialogOpen(false)}
          reasons={reasons}
          onCreate={createReason.mutate}
          onDelete={deleteReason.mutate}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: es })}
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(d => (
                  <div key={d} className="text-sm font-medium text-muted-foreground py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {emptyDays.map((_, i) => <div key={`empty-${i}`} className="h-24" />)}
                {daysInMonth.map(day => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const dayApts = appointmentsByDate[dateKey] || [];
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={dateKey}
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        "h-24 p-1 rounded-lg cursor-pointer transition-all border relative",
                        isSelected ? "bg-primary/10 border-primary" : "bg-card hover:bg-accent/50 border-transparent",
                        isToday && "ring-2 ring-primary ring-inset"
                      )}
                    >
                      <div className={cn("text-xs font-medium mb-1", isToday ? "text-primary" : "")}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-1 overflow-hidden h-[calc(100%-20px)]">
                        {dayApts.slice(0, 3).map(apt => {
                          const reason = reasons.find(r => r.id === apt.reasonId);
                          return (
                            <div
                              key={apt.id}
                              className="text-[10px] truncate px-1 rounded"
                              style={{
                                backgroundColor: reason?.color ? `${reason.color}20` : "#3b82f620",
                                color: reason?.color || "#3b82f6"
                              }}
                            >
                              {apt.appointmentTime} {apt.firstName}
                            </div>
                          )
                        })}
                        {dayApts.length > 3 && (
                          <div className="text-[10px] text-muted-foreground pl-1">+{dayApts.length - 3} más</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Próximas Citas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Upcoming appointments list (simplified) */}
                <div className="text-sm text-muted-foreground">
                  Selecciona un día en el calendario para ver detalles.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Day View Dialog */}
        <Dialog open={isDayViewOpen} onOpenChange={setIsDayViewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="capitalize">
                {selectedDate ? format(selectedDate, "EEEE d 'de' MMMM", { locale: es }) : "Detalles del día"}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg">Citas Programadas</h3>
                <Button onClick={() => openNewAppointment(selectedDate || new Date())}>
                  <Plus className="w-4 h-4 mr-2" /> Nueva Cita
                </Button>
              </div>

              <div className="border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left border-b">
                      <th className="p-3 font-medium">Hora</th>
                      <th className="p-3 font-medium">Cliente</th>
                      <th className="p-3 font-medium">Motivo</th>
                      <th className="p-3 font-medium">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDateAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                          No hay citas para este día.
                        </td>
                      </tr>
                    ) : (
                      selectedDateAppointments
                        .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime))
                        .map(apt => {
                          const reason = reasons.find(r => r.id === apt.reasonId);
                          return (
                            <tr key={apt.id} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="p-3 font-medium">{apt.appointmentTime}</td>
                              <td className="p-3">
                                <div className="font-medium">{apt.firstName} {apt.lastName}</div>
                                <div className="text-xs text-muted-foreground">{apt.phone}</div>
                              </td>
                              <td className="p-3">
                                {reason && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs"
                                    style={{ backgroundColor: `${reason.color ?? '#3b82f6'}20`, color: reason.color ?? '#3b82f6' }}>
                                    {reason.name}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-muted-foreground max-w-[200px] truncate">
                                {apt.notes || "-"}
                              </td>
                            </tr>
                          )
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* New Appointment Dialog */}
        <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Cita</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    const d = new Date(e.target.value + "T12:00:00"); // Avoid timezone shift
                    setSelectedDate(d);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Buscar Contacto (Opcional)</Label>
                <LeadSearchCombobox onSelect={handleLeadSelect} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Apellido</Label>
                  <Input value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Select value={reasonId} onValueChange={setReasonId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {reasons.map(r => (
                      <SelectItem key={r.id} value={r.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color || "#3b82f6" }} />
                          {r.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={appointmentTime}
                  onChange={e => setAppointmentTime(e.target.value)}
                  step={allowCustomTime ? 60 : slotMinutes * 60}
                />
                {slotIsFull && <p className="text-xs text-red-500">Horario lleno ({selectedSlotCount}/{maxPerSlot})</p>}
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateAppointment} disabled={createAppointment.isPending}>
                {createAppointment.isPending ? "Agendando..." : "Agendar Cita"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// --- Subcomponents ---

function LeadSearchCombobox({ onSelect }: { onSelect: (lead: any) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: leads = [], isLoading } = trpc.leads.search.useQuery(
    { query: debouncedQuery, limit: 5 },
    { enabled: debouncedQuery.length > 1 }
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          <span className="truncate">{query || "Buscar..."}</span>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar nombre o teléfono..." value={query} onValueChange={setQuery} />
          <CommandList>
            {isLoading && <CommandEmpty>Buscando...</CommandEmpty>}
            {leads.length === 0 && !isLoading && <CommandEmpty>No encontrado.</CommandEmpty>}
            <CommandGroup>
              {leads.map((lead) => (
                <CommandItem
                  key={lead.id}
                  onSelect={() => {
                    onSelect(lead);
                    setOpen(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span>{lead.name}</span>
                    <span className="text-xs text-muted-foreground">{lead.phone}</span>
                  </div>
                  <Check className={cn("ml-auto h-4 w-4", "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function SchedulingConfigForm({ initialData, onSave }: { initialData: any, onSave: () => void }) {
  const [form, setForm] = useState({
    slotMinutes: 15,
    maxPerSlot: 1,
    allowCustomTime: true
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        slotMinutes: initialData.slotMinutes ?? 15,
        maxPerSlot: initialData.maxPerSlot ?? 1,
        allowCustomTime: initialData.allowCustomTime ?? true
      });
    }
  }, [initialData]);

  const updateGeneral = trpc.settings.updateGeneral.useMutation({
    onSuccess: () => {
      toast.success("Configuración guardada");
      onSave();
    }
  });

  const handleSave = () => {
    // We only update scheduling part, assuming other parts are optional in updateGeneral
    updateGeneral.mutate({ scheduling: form });
  };

  return (
    <div className="space-y-4 py-4">
      <div className="grid gap-2">
        <Label>Duración del Slot (min)</Label>
        <Input type="number" value={form.slotMinutes} onChange={e => setForm(p => ({ ...p, slotMinutes: Number(e.target.value) }))} />
      </div>
      <div className="grid gap-2">
        <Label>Citas simultáneas (Max per Slot)</Label>
        <Input type="number" value={form.maxPerSlot} onChange={e => setForm(p => ({ ...p, maxPerSlot: Number(e.target.value) }))} />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.allowCustomTime} onCheckedChange={c => setForm(p => ({ ...p, allowCustomTime: c }))} />
        <Label>Permitir hora manual</Label>
      </div>
      <Button className="w-full" onClick={handleSave} disabled={updateGeneral.isPending}>
        {updateGeneral.isPending ? "Guardando..." : "Guardar Cambios"}
      </Button>
    </div>
  )
}

function ReminderTemplatesManager() {
  const { data: templates = [], refetch } = trpc.scheduling.getTemplates.useQuery();
  const saveMutation = trpc.scheduling.saveTemplate.useMutation({ onSuccess: () => { toast.success("Guardado"); refetch(); setEditing(null); } });
  const deleteMutation = trpc.scheduling.deleteTemplate.useMutation({ onSuccess: () => { toast.success("Eliminado"); refetch(); } });

  const [editing, setEditing] = useState<any>(null); // null = list, {} = new, {id...} = edit

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label>Nombre</Label>
          <Input value={editing.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Ej: Recordatorio 24h" />
        </div>
        <div className="grid gap-2">
          <Label>Mensaje</Label>
          <Textarea
            value={editing.content || ""}
            onChange={e => setEditing({ ...editing, content: e.target.value })}
            placeholder="Hola {{name}}, recordá tu cita..."
            rows={4}
          />
          <p className="text-xs text-muted-foreground">Variables: {"{{name}}"}, {"{{date}}"}, {"{{time}}"}</p>
        </div>
        <div className="grid gap-2">
          <Label>Días antes</Label>
          <Input type="number" value={editing.daysBefore ?? 1} onChange={e => setEditing({ ...editing, daysBefore: Number(e.target.value) })} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate(editing as any)} disabled={saveMutation.isPending}>Guardar</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{templates.length} plantillas configuradas</p>
        <Button size="sm" onClick={() => setEditing({ name: "", content: "", daysBefore: 1 })}>
          <Plus className="w-4 h-4 mr-2" /> Nueva
        </Button>
      </div>
      <ScrollArea className="h-[300px] border rounded-md p-2">
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground truncate max-w-[300px]">{t.content}</div>
                <div className="text-xs bg-muted inline-block px-1 rounded mt-1">{t.daysBefore} días antes</div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditing(t)}><Settings className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ id: t.id })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {templates.length === 0 && <div className="text-center py-8 text-muted-foreground">No hay plantillas</div>}
        </div>
      </ScrollArea>
    </div>
  )
}

function ReasonsManager({ isOpen, onClose, reasons, onCreate, onDelete }: any) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Gestionar Motivos</DialogTitle></DialogHeader>
        <div className="flex gap-2 mb-4">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nuevo motivo..." />
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger className="w-16"><div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} /></SelectTrigger>
            <SelectContent>
              {colors.map(c => <SelectItem key={c} value={c}><div className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} /></SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { onCreate({ name, color }); setName(""); }}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {reasons.map((r: any) => (
            <div key={r.id} className="flex justify-between items-center p-2 border rounded">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                <span>{r.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onDelete({ id: r.id })}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
