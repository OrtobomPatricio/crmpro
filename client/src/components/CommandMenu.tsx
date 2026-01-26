import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import {
    Calendar,
    CreditCard,
    LayoutDashboard,
    MessageCircle,
    Moon,
    Plus,
    Search,
    Settings,
    Sun,
    User,
    Users,
} from "lucide-react";
import * as React from "react";
import { useLocation } from "wouter";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";

export function CommandMenu() {
    const [open, setOpen] = React.useState(false);
    const [, setLocation] = useLocation();
    const { theme, toggleTheme } = useTheme();
    const { logout } = useAuth();

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false);
        command();
    }, []);

    return (
        <>
            <div
                className="hidden lg:flex items-center text-sm text-muted-foreground bg-muted/30 px-2 py-1.5 rounded-md border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors gap-2 select-none"
                onClick={() => setOpen(true)}
            >
                <Search className="w-3.5 h-3.5 opacity-50" />
                <span className="mr-4">Buscar...</span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    <span className="text-xs">CTRL</span>K
                </kbd>
            </div>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Escribe un comando o busca..." />
                <CommandList>
                    <CommandEmpty>No se encontraron resultados.</CommandEmpty>

                    <CommandGroup heading="Navegación">
                        <CommandItem onSelect={() => runCommand(() => setLocation("/"))}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            <span>Dashboard</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/leads"))}>
                            <Users className="mr-2 h-4 w-4" />
                            <span>Leads</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/leads?action=new"))}>
                            <Plus className="mr-2 h-4 w-4" />
                            <span>Crear Nuevo Lead</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/chat"))}>
                            <MessageCircle className="mr-2 h-4 w-4" />
                            <span>Chat Inbox</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/scheduling"))}>
                            <Calendar className="mr-2 h-4 w-4" />
                            <span>Agendamiento</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/settings"))}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Configuración</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    <CommandGroup heading="Acciones">
                        <CommandItem onSelect={() => runCommand(() => toggleTheme())}>
                            {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                            <span>Cambiar a modo {theme === 'dark' ? 'claro' : 'oscuro'}</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => logout())}>
                            <User className="mr-2 h-4 w-4" />
                            <span>Cerrar Sesión</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
}
