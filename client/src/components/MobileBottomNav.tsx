import { Link, useLocation } from "wouter";
import {
    LayoutDashboard,
    Users,
    MessageCircle,
    Calendar,
    Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

export function MobileBottomNav() {
    const [location] = useLocation();
    const { toggleSidebar } = useSidebar();

    const items = [
        { path: '/', label: 'Inicio', icon: LayoutDashboard },
        { path: '/leads', label: 'Leads', icon: Users },
        { path: '/chat', label: 'Chat', icon: MessageCircle },
        { path: '/scheduling', label: 'Agenda', icon: Calendar },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t border-border z-50 flex items-center justify-around px-2 pb-safe shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
            {items.map((item) => {
                const isActive = location === item.path;
                return (
                    <Link key={item.path} href={item.path}>
                        <div className={cn(
                            "flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-colors w-16",
                            isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                        )}>
                            <item.icon className={cn("h-5 w-5", isActive && "fill-current/10")} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </div>
                    </Link>
                );
            })}

            <button
                onClick={toggleSidebar}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-muted-foreground hover:text-foreground w-16"
            >
                <Menu className="h-5 w-5" />
                <span className="text-[10px] font-medium">Menú</span>
            </button>
        </div>
    );
}
