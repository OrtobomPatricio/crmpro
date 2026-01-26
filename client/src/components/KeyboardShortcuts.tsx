import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

interface Shortcut {
  keys: string[];
  description: string;
  action: () => void;
}

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsProps) {
  const shortcuts = [
    { keys: ["Ctrl", "H"], description: "Ir al Dashboard" },
    { keys: ["Ctrl", "L"], description: "Ir a Leads" },
    { keys: ["Ctrl", "B"], description: "Ir al Tablero Kanban" },
    { keys: ["Ctrl", "C"], description: "Ir a Campañas" },
    { keys: ["Ctrl", "M"], description: "Ir a Monitoreo" },
    { keys: ["Ctrl", "A"], description: "Ir a Analytics" },
    { keys: ["Ctrl", "K"], description: "Mostrar atajos de teclado" },
    { keys: ["Esc"], description: "Cerrar diálogos" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atajos de Teclado</DialogTitle>
          <DialogDescription>
            Navega más rápido usando estos atajos
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50"
            >
              <span className="text-sm">{shortcut.description}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, keyIndex) => (
                  <span key={keyIndex}>
                    <Kbd>{key}</Kbd>
                    {keyIndex < shortcut.keys.length - 1 && (
                      <span className="mx-1 text-muted-foreground">+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useKeyboardShortcuts() {
  const [, setLocation] = useLocation();
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl + Key shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "h":
            e.preventDefault();
            setLocation("/");
            break;
          case "l":
            e.preventDefault();
            setLocation("/leads");
            break;
          case "b":
            e.preventDefault();
            setLocation("/kanban");
            break;
          case "c":
            e.preventDefault();
            setLocation("/campaigns");
            break;
          case "m":
            e.preventDefault();
            setLocation("/monitoring");
            break;
          case "a":
            e.preventDefault();
            setLocation("/analytics");
            break;
          case "k":
            e.preventDefault();
            setIsShortcutsOpen(true);
            break;
        }
      }

      // Escape to close dialogs
      if (e.key === "Escape") {
        setIsShortcutsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setLocation]);

  return {
    isShortcutsOpen,
    setIsShortcutsOpen,
  };
}
