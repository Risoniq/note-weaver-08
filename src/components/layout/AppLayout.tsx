import { ReactNode, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Settings, Shield, Mic, Video, FolderKanban, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { SessionTimeoutWarning } from "@/components/session/SessionTimeoutWarning";
import { useQuickRecordingContext } from "@/contexts/QuickRecordingContext";
import { useUserQuota } from "@/hooks/useUserQuota";
import { QuotaExhaustedModal } from "@/components/quota/QuotaExhaustedModal";
import { RecordingModeDialog } from "@/components/recording/RecordingModeDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserBranding } from "@/hooks/useUserBranding";

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Aufnahmen", url: "/recordings", icon: Video },
  { title: "Projekte", url: "/projects", icon: FolderKanban },
  { title: "Einstellungen", url: "/settings", icon: Settings },
];

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const { isAdmin } = useAdminCheck();
  const { quota } = useUserQuota();
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const { isRecording, openModeDialog, stopRecording } = useQuickRecordingContext();
  const { showWarning, remainingSeconds, extendSession } = useSessionTimeout({ paused: isRecording });

  return (
    <div className={cn(
      "min-h-screen flex flex-col w-full",
      "bg-gradient-to-b from-sky-50 via-slate-50 to-slate-100",
      "dark:from-slate-900 dark:via-slate-900 dark:to-slate-950",
      isRecording && "pt-10" // offset for recording banner
    )}>
      {/* Impersonation Banner */}
      <ImpersonationBanner />
      
      {/* Header Navigation */}
      <header className={cn(
        "h-16 flex items-center justify-between px-6 shrink-0",
        "bg-white/60 dark:bg-slate-900/60",
        "backdrop-blur-[20px]",
        "border-b border-white/30 dark:border-white/10"
      )}>
        {/* Logo - ThemeToggle links */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="font-semibold text-lg hidden sm:block text-muted-foreground">Meeting Recorder</span>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                data-tour={item.url === "/settings" ? "settings-nav" : undefined}
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

          {/* Quick Recording Mic Button */}
          {isRecording ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={stopRecording}
                  className={cn(
                    "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                    "bg-destructive/10 text-destructive hover:bg-destructive/20"
                  )}
                >
                  <span className="absolute inset-0 rounded-xl border-2 border-destructive animate-pulse" />
                  <Square className="h-4 w-4 fill-current" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Aufnahme beenden</TooltipContent>
            </Tooltip>
          ) : (
            <RecordingModeDialog>
              <button
                onClick={() => {
                  if (quota?.is_exhausted) { setShowQuotaModal(true); return; }
                  openModeDialog();
                }}
                className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 text-muted-foreground hover:bg-white/50 dark:hover:bg-white/5 hover:text-foreground"
                title="Schnellaufnahme starten"
              >
                <Mic className="h-5 w-5" />
              </button>
            </RecordingModeDialog>
          )}
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

      <SessionTimeoutWarning
        open={showWarning}
        remainingSeconds={remainingSeconds}
        onExtend={extendSession}
      />

      <QuotaExhaustedModal
        open={showQuotaModal}
        onClose={() => setShowQuotaModal(false)}
      />
    </div>
  );
}
