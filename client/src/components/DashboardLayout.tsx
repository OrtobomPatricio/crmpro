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
  Slash,
} from "lucide-react";
import { CSSProperties, ReactNode, useEffect, useRef, useState, Fragment } from "react";
import { useLocation, Link } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";
import { KeyboardShortcutsDialog, useKeyboardShortcuts } from "./KeyboardShortcuts";
import WelcomeTour from "./WelcomeTour";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { TeamChatWidget } from "@/components/team-chat";
import { CommandMenu } from "./CommandMenu";
import { MobileBottomNav } from "./MobileBottomNav";
import { HelpCenter } from "@/components/help-center";

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
  { icon: Database, label: "Backups", path: "/backup", requiredPerm: "backups.view", roles: ["owner", "admin"] },
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);

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
      <TeamChatWidget helpCenterOpen={isHelpOpen} />
      <HelpCenter open={isHelpOpen} onOpenChange={setIsHelpOpen} />
      <MobileBottomNav />
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
      // Emergency override: Owner and Admin see everything prevents lockout
      if (role === 'owner' || role === 'admin') return true;

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
  const isMobile = useIsMobile();
  const { isShortcutsOpen, setIsShortcutsOpen } = useKeyboardShortcuts();
  const { theme, toggleTheme } = useTheme();

  // Generate Breadcrumbs
  const getBreadcrumbs = () => {
    const active = menuItems.find(item => item.path === location);
    if (!active) return [{ label: "CRM", path: "/" }, { label: "Página desconocida", path: "#" }];

    // Add hierarchical logic here if needed (e.g. Campaigns > Edit)
    const crumbs = [{ label: "CRM", path: "/" }];

    if (location !== "/") {
      crumbs.push({ label: active.label, path: active.path });
    } else {
      crumbs.push({ label: "Dashboard", path: "/" });
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

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
          className="h-full w-full border-r bg-sidebar"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
                  <MessageCircle className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              </button>
              {!isCollapsed ? (
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold tracking-tight truncate text-sm text-sidebar-foreground leading-none">
                    Imagine Lab
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider mt-0.5">
                    Pro CRM
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-1 mt-2">
            <SidebarMenu className="px-2">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-1 hidden group-data-[collapsible=icon]:hidden">
                Principal
              </div>
              {visibleMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-9 transition-all duration-200 font-normal hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-sidebar-foreground/80'
                        }`}
                    >
                      <item.icon
                        className={`h-4 w-4 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <span className={isActive ? "font-medium" : ""}>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>


          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border bg-sidebar/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-sidebar-accent transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-8 w-8 rounded-lg border border-sidebar-border shrink-0">
                    <AvatarFallback className="rounded-lg text-xs font-medium bg-sidebar-accent text-sidebar-foreground">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-sidebar-foreground">
                      {user?.name || "-"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate mt-1">
                      {user?.email || "-"}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:hidden ml-auto" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" side="right">
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

      <SidebarInset className="pb-16 md:pb-0">
        {/* Top Header Bar */}
        <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40 gap-4">
          <div className="flex items-center gap-2 overflow-hidden">
            {/* Mobile Sidebar Trigger (Optional, since we have bottom nav) */}
            {/* <SidebarTrigger className="md:hidden h-8 w-8" /> */}

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground overflow-hidden whitespace-nowrap mask-linear-fade">
              {breadcrumbs.map((crumb, index) => (
                <Fragment key={crumb.path}>
                  {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />}
                  <Link href={crumb.path}>
                    <span className={`hover:text-foreground transition-colors cursor-pointer ${index === breadcrumbs.length - 1 ? "font-medium text-foreground" : ""}`}>
                      {crumb.label}
                    </span>
                  </Link>
                </Fragment>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Command Menu */}
            <CommandMenu />

            {/* Theme Toggle Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full bg-background border-border/50 hover:bg-accent hover:text-accent-foreground transition-all duration-300 h-8 w-8"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-yellow-400" />
              ) : (
                <Moon className="h-4 w-4 text-purple-500" />
              )}
            </Button>
          </div>
        </div>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
      </SidebarInset>

      <KeyboardShortcutsDialog
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </>
  );
}


