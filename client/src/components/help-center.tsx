import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HelpCircle, Search, PlayCircle, FileText, ExternalLink } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Mock data for help articles and videos
// In a real app, this could be fetched from an API or a markdown file
const HELP_TOPICS = [
  {
    id: "getting-started",
    title: "Primeros Pasos",
    items: [
      { id: "tour", title: "Configurar mi Cuenta", type: "article", content: "Aprende a configurar tu perfil, contraseña y preferencias generales." },
      { id: "setup", title: "Importar Leads (CSV)", type: "article", content: "Guía paso a paso para importar tu base de datos de clientes." },
    ]
  },
  {
    id: "crm-core",
    title: "Gestión de Leads",
    items: [
      { id: "create-lead", title: "Crear un Nuevo Lead", type: "article", content: "Puedes crear leads manualmente o importarlos desde CSV." },
      { id: "kanban", title: "Cómo usar el Kanban", type: "video", url: "#", duration: "3:45" },
      { id: "status", title: "Estados y Pipelines", type: "article", content: "Personaliza tus embudos de venta y etapas." },
    ]
  },
  {
    id: "whatsapp-module",
    title: "WhatsApp & Chat",
    items: [
      { id: "connect", title: "Conectar Número (QR)", type: "article", content: "Escanea el código QR en la sección de Canales para conectar tu número." },
      { id: "templates", title: "Plantillas de Mensaje", type: "article", content: "Las plantillas deben ser aprobadas por Meta antes de usarse." },
      { id: "inbox", title: "Bandeja de Entrada Unificada", type: "video", url: "#", duration: "5:10" },
    ]
  },
  {
    id: "automation",
    title: "Automatización",
    items: [
      { id: "workflows", title: "Crear tu primer Workflow", type: "article", content: "Automatiza respuestas y cambios de estado." },
      { id: "integrations", title: "Conectar con n8n", type: "article", content: "Extiende la funcionalidad conectando webhooks externos." },
    ]
  }
];

export function HelpCenter({ open, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange! : setInternalOpen;

  const filteredTopics = HELP_TOPICS.map(topic => ({
    ...topic,
    items: topic.items.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(topic => topic.items.length > 0);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-xl bg-primary text-primary-foreground hover:scale-110 transition-all duration-300 shadow-primary/25 border-4 border-background"
          size="icon"
        >
          <HelpCircle className="h-7 w-7" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col h-full bg-background/95 backdrop-blur-sm border-l shadow-2xl">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <HelpCircle className="h-6 w-6" />
            Centro de Ayuda
          </SheetTitle>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="¿Qué estás buscando?"
              className="pl-10 h-10 bg-muted/50 border-input/50 focus:bg-background transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-6 -mr-6 pt-6">
          <div className="space-y-6 pb-6">
            {/* Quick Links / Featured */}
            {!searchQuery && (
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/20 cursor-pointer transition-all border-primary/10 hover:border-primary/30 group">
                  <PlayCircle className="h-8 w-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-base mb-1">Video Tutoriales</h4>
                  <p className="text-xs text-muted-foreground">Aprende visualmente</p>
                </div>
                <div className="p-4 rounded-xl border bg-gradient-to-br from-blue-500/5 to-blue-500/10 hover:from-blue-500/10 hover:to-blue-500/20 cursor-pointer transition-all border-blue-500/10 hover:border-blue-500/30 group">
                  <FileText className="h-8 w-8 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-base mb-1">Documentación</h4>
                  <p className="text-xs text-muted-foreground">Guías detalladas</p>
                </div>
              </div>
            )}

            <Accordion type="multiple" defaultValue={HELP_TOPICS.map(t => t.id)} className="w-full space-y-4">
              {filteredTopics.map((topic) => (
                <AccordionItem key={topic.id} value={topic.id} className="border rounded-lg px-2 overflow-hidden bg-card/50">
                  <AccordionTrigger className="hover:no-underline py-3 px-2 hover:bg-muted/50 rounded-md transition-colors">
                    <span className="font-semibold text-base flex items-center gap-2">
                      {topic.title}
                      <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {topic.items.length}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-3 px-2">
                    <div className="grid gap-2">
                      {topic.items.map((item) => (
                        <div key={item.id} className="group flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 cursor-pointer border border-transparent hover:border-border/50 transition-all">
                          {item.type === 'video' ? (
                            <div className="mt-0.5 min-w-8 min-h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shadow-sm">
                              <PlayCircle className="h-4 w-4" />
                            </div>
                          ) : (
                            <div className="mt-0.5 min-w-8 min-h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                              <FileText className="h-4 w-4" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h5 className="text-sm font-semibold leading-none mb-1.5 group-hover:text-primary transition-colors truncate">
                              {item.title}
                            </h5>
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              {item.type === 'video' ? `Video Tutorial • ${item.duration}` : item.content}
                            </p>
                          </div>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity mt-1 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {filteredTopics.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <div className="bg-muted rounded-full p-4 mb-4">
                  <Search className="h-8 w-8 opacity-50" />
                </div>
                <p className="font-medium">No encontramos resultados para "{searchQuery}"</p>
                <p className="text-sm">Intenta con otros términos</p>
              </div>
            )}
          </div>
        </div>
        <div className="pt-6 mt-2 border-t text-center space-y-2">
          <Button variant="outline" className="w-full gap-2">
            Contactar Soporte Técnico
            <ExternalLink className="h-4 w-4" />
          </Button>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium pt-2">Imagine Lab CRM v1.0</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
