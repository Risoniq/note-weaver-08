import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Copy, Check, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface EmailEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
  onEmailUpdate: (newEmail: string) => void;
  recordingContext?: {
    title?: string;
    summary?: string;
    key_points?: string[];
    action_items?: string[];
  };
}

export function EmailEditModal({
  open,
  onOpenChange,
  currentEmail,
  onEmailUpdate,
  recordingContext,
}: EmailEditModalProps) {
  const [instructions, setInstructions] = useState("");
  const [editedEmail, setEditedEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleEditWithAI = async () => {
    if (!instructions.trim()) {
      toast.error("Bitte gib Anweisungen für die Bearbeitung ein");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("edit-email-ai", {
        body: {
          email: currentEmail,
          instructions: instructions.trim(),
          recording_context: recordingContext,
        },
      });

      if (error) {
        console.error("Edit email error:", error);
        toast.error("Fehler bei der E-Mail-Bearbeitung");
        return;
      }

      if (data?.edited_email) {
        setEditedEmail(data.edited_email);
        toast.success("E-Mail wurde bearbeitet");
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (err) {
      console.error("Error editing email:", err);
      toast.error("Fehler bei der Verbindung zum Server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (editedEmail) {
      onEmailUpdate(editedEmail);
      toast.success("E-Mail wurde übernommen");
      handleClose();
    }
  };

  const handleCopy = () => {
    const textToCopy = editedEmail || currentEmail;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success("In Zwischenablage kopiert");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setInstructions("");
    setEditedEmail("");
    onOpenChange(false);
  };

  const exampleInstructions = [
    "Mache die E-Mail formeller",
    "Füge eine Deadline für die To-Dos hinzu",
    "Kürze die Zusammenfassung",
    "Füge konkrete Termine hinzu",
    "Betone die Dringlichkeit",
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            E-Mail mit KI bearbeiten
          </DialogTitle>
          <DialogDescription>
            Gib Anweisungen ein, wie die E-Mail angepasst werden soll.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Anweisungen */}
          <div className="space-y-2">
            <Label htmlFor="instructions">Anweisungen</Label>
            <Textarea
              id="instructions"
              placeholder="z.B. 'Mache die E-Mail formeller' oder 'Füge eine Deadline für die To-Dos hinzu'"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="min-h-[80px]"
            />
            {/* Quick Suggestions */}
            <div className="flex flex-wrap gap-1.5">
              {exampleInstructions.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => setInstructions(example)}
                  className="text-xs px-2 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleEditWithAI}
            disabled={isLoading || !instructions.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Bearbeite...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Mit KI bearbeiten
              </>
            )}
          </Button>

          {/* Aktuelle E-Mail */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Aktuelle E-Mail</Label>
            <div className="max-h-40 overflow-y-auto rounded-xl bg-secondary/30 p-3">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">
                {currentEmail}
              </pre>
            </div>
          </div>

          {/* Bearbeitete E-Mail */}
          {editedEmail && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Bearbeitete E-Mail
              </Label>
              <div className="max-h-60 overflow-y-auto rounded-xl bg-primary/5 border border-primary/20 p-3">
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">
                  {editedEmail}
                </pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleClose} className="sm:mr-auto">
            Abbrechen
          </Button>
          <Button variant="outline" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Kopiert
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Kopieren
              </>
            )}
          </Button>
          {editedEmail && (
            <Button onClick={handleApply}>
              <Check className="h-4 w-4 mr-2" />
              Übernehmen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
