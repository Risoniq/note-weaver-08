import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
  id?: string;
}

function toast(opts: ToastOptions) {
  const { title, description, variant, duration, id } = opts;
  const options: Record<string, unknown> = {};
  if (description) options.description = description;
  if (duration) options.duration = duration;
  if (id) options.id = id;

  if (variant === "destructive") {
    return sonnerToast.error(title || description || "", options);
  }
  return sonnerToast(title || description || "", options);
}

function useToast() {
  return {
    toast,
    dismiss: (id?: string) => {
      if (id) sonnerToast.dismiss(id);
      else sonnerToast.dismiss();
    },
    toasts: [] as any[],
  };
}

export { useToast, toast };
