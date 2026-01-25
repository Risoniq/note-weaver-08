import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Calendar, FileText, Settings, Shield, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Kalender", url: "/calendar", icon: Calendar },
  { title: "Transkripte", url: "/transcripts", icon: FileText },
  { title: "Einstellungen", url: "/settings", icon: Settings },
];

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const { isAdmin } = useAdminCheck();

  return (
    <div className={cn(
      "min-h-screen flex flex-col w-full",
      "bg-gradient-to-b from-sky-50 via-slate-50 to-slate-100",
      "dark:from-slate-900 dark:via-slate-900 dark:to-slate-950"
    )}>
      {/* Header Navigation */}
      <header className={cn(
        "h-16 flex items-center justify-between px-6 shrink-0",
        "bg-white/60 dark:bg-slate-900/60",
        "backdrop-blur-[20px]",
        "border-b border-white/30 dark:border-white/10"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Mic className="h-5 w-5 text-primary" />
          </div>
          <span className="font-semibold text-lg hidden sm:block">Meeting Recorder</span>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200",
                  isActive
                    ? "bg-white/80 dark:bg-white/10 shadow-sm text-primary"
                    : "text-muted-foreground hover:bg-white/50 dark:hover:bg-white/5 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden md:block">{item.title}</span>
              </NavLink>
            );
          })}
          
          {isAdmin && (
            <NavLink
              to="/admin"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200",
                location.pathname === "/admin"
                  ? "bg-white/80 dark:bg-white/10 shadow-sm text-primary"
                  : "text-muted-foreground hover:bg-white/50 dark:hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Shield className="h-4 w-4" />
              <span className="hidden md:block">Admin</span>
            </NavLink>
          )}
          
          <ThemeToggle />
        </nav>
      </header>
      
      {/* Main content area */}
      <main className="flex-1 p-6 overflow-auto">
        <div className={cn(
          "min-h-full rounded-3xl p-6",
          "bg-white/40 dark:bg-slate-800/40",
          "backdrop-blur-[40px]",
          "border border-white/30 dark:border-white/5"
        )}>
          {children}
        </div>
      </main>
    </div>
  );
}
