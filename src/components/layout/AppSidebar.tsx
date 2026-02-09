import { useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  FileText, 
  Settings, 
  Shield, 
  LogOut,
  Mic,
  FolderKanban
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Aufnahmen", url: "/recordings", icon: FileText },
  { title: "Einstellungen", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isAdmin } = useAdminCheck();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const allMenuItems = isAdmin 
    ? [...menuItems, { title: "Admin", url: "/admin", icon: Shield }]
    : menuItems;

  return (
    <Sidebar 
      className={cn(
        "border-r-0",
        "bg-white/75 dark:bg-slate-900/75",
        "backdrop-blur-[30px]",
        "border-r border-white/20 dark:border-white/5"
      )}
      collapsible="icon"
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
            <Mic className="h-5 w-5 text-primary" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-base text-foreground">
              Meeting Recorder
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarMenu>
          {allMenuItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.title}
                >
                  <NavLink
                    to={item.url}
                    className={cn(
                      "rounded-xl transition-all duration-200",
                      "hover:bg-white/50 dark:hover:bg-white/5"
                    )}
                    activeClassName={cn(
                      "bg-white/70 dark:bg-white/10",
                      "shadow-sm"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-white/20 dark:border-white/5">
        {user && !isCollapsed && (
          <div className="px-3 py-2 mb-2 text-sm text-muted-foreground truncate">
            {user.email}
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start rounded-xl",
            "hover:bg-white/50 dark:hover:bg-white/5",
            isCollapsed && "justify-center"
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span className="ml-3">Abmelden</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
