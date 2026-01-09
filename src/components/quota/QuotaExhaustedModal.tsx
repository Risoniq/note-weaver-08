import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Crown } from "lucide-react";

interface QuotaExhaustedModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuotaExhaustedModal({ open, onClose }: QuotaExhaustedModalProps) {
  const handleUpgrade = () => {
    // TODO: Stripe-Integration für Vollversion
    console.log('Upgrade clicked');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-xl text-center">Kontingent erschöpft</DialogTitle>
          <DialogDescription className="text-center space-y-2">
            <p className="text-base">
              Vielen Dank für die Teilnahme an der Testversion!
            </p>
            <p className="text-sm">
              Dein Meeting-Kontingent ist aufgebraucht. Upgrade auf die Vollversion 
              für unbegrenzte Meeting-Aufnahmen.
            </p>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button onClick={handleUpgrade} className="w-full" size="lg">
            <Crown className="h-4 w-4 mr-2" />
            Vollversion kaufen
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Später
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
