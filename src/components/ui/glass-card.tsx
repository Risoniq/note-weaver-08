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
  return;
});
GlassCard.displayName = "GlassCard";
export { GlassCard };