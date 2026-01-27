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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileText, Settings } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useAdminCheck } from "@/hooks/useAdminCheck";

interface ReportDownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recording: {
    id: string;
    title?: string | null;
    created_at: string;
    summary?: string | null;
    key_points?: string[] | null;
    action_items?: string[] | null;
    transcript_text?: string | null;
    participants?: { id: string; name: string }[] | null;
    duration?: number | null;
    word_count?: number | null;
    meeting_url?: string | null;
  };
  followUpEmail?: string;
}

interface ReportOptions {
  format: "txt" | "md";
  includeSummary: boolean;
  includeKeyPoints: boolean;
  includeActionItems: boolean;
  includeTranscript: boolean;
  includeParticipants: boolean;
  includeEmail: boolean;
  // Admin options
  includeMetadata: boolean;
  includeDebugInfo: boolean;
  includeRawData: boolean;
}

export function ReportDownloadModal({
  open,
  onOpenChange,
  recording,
  followUpEmail,
}: ReportDownloadModalProps) {
  const { isAdmin } = useAdminCheck();
  
  const [options, setOptions] = useState<ReportOptions>({
    format: "txt",
    includeSummary: true,
    includeKeyPoints: true,
    includeActionItems: true,
    includeTranscript: true,
    includeParticipants: true,
    includeEmail: false,
    // Admin options default off
    includeMetadata: false,
    includeDebugInfo: false,
    includeRawData: false,
  });

  const updateOption = <K extends keyof ReportOptions>(
    key: K,
    value: ReportOptions[K]
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const generateReport = (): string => {
    const lines: string[] = [];
    const title = recording.title || `Meeting ${recording.id.slice(0, 8)}`;
    const date = format(new Date(recording.created_at), "dd. MMMM yyyy, HH:mm 'Uhr'", { locale: de });
    const separator = options.format === "md" ? "---" : "═".repeat(50);
    const heading = (text: string) =>
      options.format === "md" ? `## ${text}` : `\n${text}\n${"─".repeat(text.length)}`;

    // Header
    if (options.format === "md") {
      lines.push(`# ${title}`);
      lines.push(`*Datum: ${date}*`);
    } else {
      lines.push("═".repeat(50));
      lines.push(title.toUpperCase());
      lines.push(`Datum: ${date}`);
      lines.push("═".repeat(50));
    }
    lines.push("");

    // Participants
    if (options.includeParticipants && recording.participants?.length) {
      lines.push(heading("Teilnehmer"));
      recording.participants.forEach((p, i) => {
        lines.push(options.format === "md" ? `- ${p.name}` : `  ${i + 1}. ${p.name}`);
      });
      lines.push("");
    }

    // Summary
    if (options.includeSummary && recording.summary) {
      lines.push(heading("Zusammenfassung"));
      lines.push(recording.summary);
      lines.push("");
    }

    // Key Points
    if (options.includeKeyPoints && recording.key_points?.length) {
      lines.push(heading("Key Points"));
      recording.key_points.forEach((point, i) => {
        lines.push(options.format === "md" ? `${i + 1}. ${point}` : `  ${i + 1}. ${point}`);
      });
      lines.push("");
    }

    // Action Items
    if (options.includeActionItems && recording.action_items?.length) {
      lines.push(heading("To-Dos / Action Items"));
      recording.action_items.forEach((item) => {
        lines.push(options.format === "md" ? `- [ ] ${item}` : `  □ ${item}`);
      });
      lines.push("");
    }

    // Follow-Up Email
    if (options.includeEmail && followUpEmail) {
      lines.push(heading("Follow-Up E-Mail"));
      lines.push(followUpEmail);
      lines.push("");
    }

    // Transcript
    if (options.includeTranscript && recording.transcript_text) {
      lines.push(separator);
      lines.push(heading("Vollständiges Transkript"));
      lines.push("");
      // Remove metadata header if present
      const transcript = recording.transcript_text;
      const separatorIndex = transcript.indexOf("---");
      const cleanTranscript = separatorIndex !== -1 
        ? transcript.substring(separatorIndex + 3).trim() 
        : transcript;
      lines.push(cleanTranscript);
      lines.push("");
    }

    // Admin: Metadata
    if (options.includeMetadata && isAdmin) {
      lines.push(separator);
      lines.push(heading("Metadaten (Admin)"));
      lines.push(`Recording ID: ${recording.id}`);
      lines.push(`Created: ${recording.created_at}`);
      lines.push(`Duration: ${recording.duration ? Math.floor(recording.duration / 60) : 0} Minuten`);
      lines.push(`Word Count: ${recording.word_count || 0}`);
      if (recording.meeting_url) {
        lines.push(`Meeting URL: ${recording.meeting_url}`);
      }
      lines.push("");
    }

    // Admin: Debug Info
    if (options.includeDebugInfo && isAdmin) {
      lines.push(heading("Debug Info (Admin)"));
      lines.push(`Participants Count: ${recording.participants?.length || 0}`);
      lines.push(`Key Points Count: ${recording.key_points?.length || 0}`);
      lines.push(`Action Items Count: ${recording.action_items?.length || 0}`);
      lines.push(`Has Transcript: ${!!recording.transcript_text}`);
      lines.push(`Transcript Length: ${recording.transcript_text?.length || 0} chars`);
      lines.push("");
    }

    // Admin: Raw Data
    if (options.includeRawData && isAdmin) {
      lines.push(heading("Rohdaten (Admin)"));
      lines.push("```json");
      lines.push(JSON.stringify(recording, null, 2));
      lines.push("```");
      lines.push("");
    }

    // Footer
    lines.push(separator);
    lines.push(`Generiert am: ${format(new Date(), "dd.MM.yyyy HH:mm 'Uhr'", { locale: de })}`);

    return lines.join("\n");
  };

  const handleDownload = () => {
    const content = generateReport();
    const extension = options.format === "md" ? "md" : "txt";
    const mimeType = options.format === "md" ? "text/markdown" : "text/plain";
    const fileName = `meeting-bericht-${recording.id.slice(0, 8)}.${extension}`;

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Bericht als ${extension.toUpperCase()} heruntergeladen`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Bericht herunterladen
          </DialogTitle>
          <DialogDescription>
            Wähle aus, welche Inhalte der Bericht enthalten soll.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Dateiformat</Label>
            <Select
              value={options.format}
              onValueChange={(v) => updateOption("format", v as "txt" | "md")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="txt">Text (.txt)</SelectItem>
                <SelectItem value="md">Markdown (.md)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Content Options */}
          <div className="space-y-3">
            <Label>Inhalt</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={options.includeSummary}
                  onCheckedChange={(c) => updateOption("includeSummary", !!c)}
                />
                <span className="text-sm">Zusammenfassung</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={options.includeKeyPoints}
                  onCheckedChange={(c) => updateOption("includeKeyPoints", !!c)}
                />
                <span className="text-sm">Key Points</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={options.includeActionItems}
                  onCheckedChange={(c) => updateOption("includeActionItems", !!c)}
                />
                <span className="text-sm">To-Dos / Action Items</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={options.includeTranscript}
                  onCheckedChange={(c) => updateOption("includeTranscript", !!c)}
                />
                <span className="text-sm">Vollständiges Transkript</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={options.includeParticipants}
                  onCheckedChange={(c) => updateOption("includeParticipants", !!c)}
                />
                <span className="text-sm">Teilnehmerliste</span>
              </label>
              {followUpEmail && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={options.includeEmail}
                    onCheckedChange={(c) => updateOption("includeEmail", !!c)}
                  />
                  <span className="text-sm">Follow-Up E-Mail</span>
                </label>
              )}
            </div>
          </div>

          {/* Admin Options - Only visible for admins */}
          {isAdmin && (
            <div className="border-t pt-4 space-y-3">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Settings className="h-4 w-4" />
                Erweiterte Optionen (Admin)
              </Label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={options.includeMetadata}
                    onCheckedChange={(c) => updateOption("includeMetadata", !!c)}
                  />
                  <span className="text-sm text-muted-foreground">Metadaten (IDs, Timestamps)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={options.includeDebugInfo}
                    onCheckedChange={(c) => updateOption("includeDebugInfo", !!c)}
                  />
                  <span className="text-sm text-muted-foreground">Debug-Informationen</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={options.includeRawData}
                    onCheckedChange={(c) => updateOption("includeRawData", !!c)}
                  />
                  <span className="text-sm text-muted-foreground">Rohdaten (JSON)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Herunterladen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
