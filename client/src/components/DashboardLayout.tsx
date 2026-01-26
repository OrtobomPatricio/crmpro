import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/contexts/ThemeContext";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Users,
  LayoutGrid,
  BarChart3,
  Activity,
  Keyboard,
  MessageCircle,
  Send,
  Moon,
  Sun,
  FileText,
  Workflow,
  Calendar,
  Phone,
  ChevronDown,
  ChevronRight,
  Settings,
  Database,
} from "lucide-react";
import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";
import { KeyboardShortcutsDialog, useKeyboardShortcuts } from "./KeyboardShortcuts";
import WelcomeTour from "./WelcomeTour";
import { usePermissions } from "@/_core/hooks/usePermissions";

type MenuItem = {
  icon: any;
  label: string;
  path: string;
  roles?: string[];
  requiredPerm?: string;
};

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", requiredPerm: "dashboard.view" },
  { icon: Users, label: "Leads", path: "/leads", requiredPerm: "leads.view" },
  { icon: LayoutGrid, label: "Kanban", path: "/kanban", requiredPerm: "kanban.view" },
  { icon: MessageCircle, label: "Chat", path: "/chat", requiredPerm: "chat.view" },
  { icon: Calendar, label: "Agendamiento", path: "/scheduling", requiredPerm: "scheduling.view" },
  { icon: Send, label: "Campañas", path: "/campaigns", requiredPerm: "campaigns.view" },
  { icon: FileText, label: "Plantillas", path: "/templates", requiredPerm: "campaigns.view" },
  { icon: Workflow, label: "Automatización", path: "/automations", requiredPerm: "campaigns.view" },
  { icon: Activity, label: "Monitoreo", path: "/monitoring", requiredPerm: "monitoring.view" },
  { icon: BarChart3, label: "Analytics", path: "/analytics", requiredPerm: "analytics.view" },
  { icon: FileText, label: "Reportes", path: "/reports", requiredPerm: "reports.view" },
  { icon: Workflow, label: "Integraciones", path: "/integrations", requiredPerm: "integrations.view" },
  { icon: LayoutGrid, label: "Pipelines", path: "/settings/pipelines", requiredPerm: "kanban.manage" },
  { icon: Database, label: "Backups", path: "/backup", roles: ["owner", "admin"] },
  { icon: Settings, label: "Configuración", path: "/settings", requiredPerm: "settings.view" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => {
    // Show tour for new users
    if (user && !user.hasSeenTour) {
      setShowTour(true);
    }
  }, [user]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <MessageCircle className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent text-center">
              Imagine Lab CRM
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Sistema completo de gestión de leads y campañas de WhatsApp
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all"
          >
            Iniciar Sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent sidebarWidth={sidebarWidth} setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
      {showTour && <WelcomeTour onComplete={() => setShowTour(false)} />}
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: ReactNode;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  sidebarWidth,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const { can, isLoading: permsLoading } = usePermissions();

  // Menu visibility (roles + permissions matrix)
  const role = (user as any)?.role as string | undefined;
  const visibleMenuItems = menuItems.filter((item) => {
    // 1) Explicit role restriction (hard gate)
    if (item.roles && item.roles.length > 0) {
      if (!role) return false;
      if (!item.roles.includes(role)) return false;
    }

    // 2) Permission restriction (soft gate, waits for permissions to load)
    if (item.requiredPerm) {
      if (permsLoading) return true; // don't flash-hide while loading
      return can(item.requiredPerm);
    }

    return true;
  });

  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  const { isShortcutsOpen, setIsShortcutsOpen } = useKeyboardShortcuts();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div
        className={`sticky top-0 h-screen hidden md:block shrink-0 ${isResizing ? '' : 'transition-[width] duration-300'}`}
        style={{ width: isCollapsed ? "3rem" : `${sidebarWidth}px` }}
        ref={sidebarRef}
      >
        <Sidebar
          collapsible="icon"
          className="h-full w-full border-r"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-purple-500/20">
                    <MessageCircle className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-semibold tracking-tight truncate text-sm">
                    Imagine Lab CRM
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {visibleMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all duration-200 font-normal hover:bg-primary/10 ${isActive
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground'
                        }`}
                    >
                      <item.icon
                        className={`h-[18px] w-[18px] transition-colors ${isActive ? "text-primary" : ""}`}
                      />
                      <span className={isActive ? "font-medium" : ""}>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Canales conectados */}
            {!isCollapsed && (
              <div className="px-2 py-3 border-t border-border mt-2">
                <ChannelsSection />
              </div>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => setIsShortcutsOpen(true)}
                  className="cursor-pointer"
                >
                  <Keyboard className="mr-2 h-4 w-4" />
                  <span>Atajos de teclado</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 hover:w-1.5 transition-all z-50 ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
        />
      </div>

      <SidebarInset>
        {/* Top Header Bar */}
        <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-2">
            {isMobile && <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />}
            <div className="flex items-center gap-3">
              <span className="tracking-tight text-foreground font-medium">
                {activeMenuItem?.label ?? "Menu"}
              </span>
            </div>
          </div>

          {/* Theme Toggle Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full bg-card/50 border-border/50 hover:bg-card hover:border-primary/50 transition-all duration-300"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 text-yellow-400" />
            ) : (
              <Moon className="h-5 w-5 text-purple-500" />
            )}
          </Button>
        </div>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>

      <KeyboardShortcutsDialog
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </>
  );
}

// Channels Section Component
function ChannelsSection() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [, setLocation] = useLocation();
  const { data: channels = [] } = trpc.whatsappNumbers.list.useQuery();

  const connectedChannels = channels.filter((ch: { isConnected: boolean }) => ch.isConnected);

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2 px-1"
      >
        <span className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5" />
          Canales ({connectedChannels.length})
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>

      {isExpanded && (
        <div className="space-y-1">
          {connectedChannels.length > 0 ? (
            connectedChannels.map((channel: { id: number; displayName: string | null; phoneNumber: string; status: string }) => (
              <button
                key={channel.id}
                onClick={() => setLocation('/chat')}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-primary/10 transition-colors text-left"
              >
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="truncate text-xs">
                  {channel.displayName || channel.phoneNumber}
                </span>
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground px-2 py-1">
              No hay canales conectados
            </p>
          )}
          <button
            onClick={() => setLocation('/monitoring')}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <span>+ Conectar canal</span>
          </button>
        </div>
      )}
    </div>
  );
}
