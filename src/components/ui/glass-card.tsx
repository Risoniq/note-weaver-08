import * as React from "react";
import { cn } from "@/lib/utils";
interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  variant?: "ultraThin" | "thin" | "regular" | "thick";
}
const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(({
  className,
  title,
  variant = "thick",
  children,
  ...props
}, ref) => {
  const variantStyles = {
    ultraThin: "bg-white/40 dark:bg-slate-800/40 backdrop-blur-[40px]",
    thin: "bg-white/60 dark:bg-slate-800/60 backdrop-blur-[30px]",
    regular: "bg-white/75 dark:bg-slate-800/75 backdrop-blur-[25px]",
    thick: "bg-white/85 dark:bg-slate-800/85 backdrop-blur-[20px]"
  };
  return <div ref={ref} className={cn("rounded-[20px] p-6 border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] text-primary bg-[#a5bce3]", variantStyles[variant], className)} {...props}>
        {title && <h3 className="text-lg font-semibold mb-4 text-primary-foreground">{title}</h3>}
        {children}
      </div>;
});
GlassCard.displayName = "GlassCard";
export { GlassCard };