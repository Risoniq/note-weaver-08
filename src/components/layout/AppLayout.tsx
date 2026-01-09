import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className={cn(
        "min-h-screen flex w-full",
        "bg-gradient-to-b from-sky-50 via-slate-50 to-slate-100",
        "dark:from-slate-900 dark:via-slate-900 dark:to-slate-950"
      )}>
        <AppSidebar />
        
        <main className="flex-1 flex flex-col min-h-screen">
          {/* Header with trigger */}
          <header className={cn(
            "h-14 flex items-center px-4 shrink-0",
            "bg-white/40 dark:bg-slate-900/40",
            "backdrop-blur-[20px]",
            "border-b border-white/20 dark:border-white/5"
          )}>
            <SidebarTrigger className="h-9 w-9" />
          </header>
          
          {/* Main content area */}
          <div className="flex-1 p-6 overflow-auto">
            <div className={cn(
              "min-h-full rounded-3xl p-6",
              "bg-white/40 dark:bg-slate-800/40",
              "backdrop-blur-[40px]",
              "border border-white/30 dark:border-white/5"
            )}>
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
