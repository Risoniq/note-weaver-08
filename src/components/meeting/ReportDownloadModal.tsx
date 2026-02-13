import { useState, useRef, useCallback } from "react";
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
import { Download, FileText, Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { VisualReportView } from "./VisualReportView";
import { createRoot } from "react-dom/client";

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
  userEmail?: string | null;
}

interface ReportOptions {
  format: "txt" | "md" | "pdf";
  includeSummary: boolean;
  includeKeyPoints: boolean;
  includeActionItems: boolean;
  includeTranscript: boolean;
  includeParticipants: boolean;
  includeEmail: boolean;
  includeMetadata: boolean;
  includeDebugInfo: boolean;
  includeRawData: boolean;
}

export function ReportDownloadModal({
  open,
  onOpenChange,
  recording,
  followUpEmail,
  userEmail,
}: ReportDownloadModalProps) {
  const { isAdmin } = useAdminCheck();
  const [isGenerating, setIsGenerating] = useState(false);

  const [options, setOptions] = useState<ReportOptions>({
    format: "pdf",
    includeSummary: true,
    includeKeyPoints: true,
    includeActionItems: true,
    includeTranscript: true,
    includeParticipants: true,
    includeEmail: false,
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

  const generateTextReport = (): string => {
    const lines: string[] = [];
    const title = recording.title || `Meeting ${recording.id.slice(0, 8)}`;
    const date = format(new Date(recording.created_at), "dd. MMMM yyyy, HH:mm 'Uhr'", { locale: de });
    const separator = options.format === "md" ? "---" : "═".repeat(50);
    const heading = (text: string) =>
      options.format === "md" ? `## ${text}` : `\n${text}\n${"─".repeat(text.length)}`;

    if (options.format === "md") {
      lines.push(`# ${title}`, `*Datum: ${date}*`);
    } else {
      lines.push("═".repeat(50), title.toUpperCase(), `Datum: ${date}`, "═".repeat(50));
    }
    lines.push("");

    if (options.includeParticipants && recording.participants?.length) {
      lines.push(heading("Teilnehmer"));
      recording.participants.forEach((p, i) => {
        lines.push(options.format === "md" ? `- ${p.name}` : `  ${i + 1}. ${p.name}`);
      });
      lines.push("");
    }

    if (options.includeSummary && recording.summary) {
      lines.push(heading("Zusammenfassung"), recording.summary, "");
    }

    if (options.includeKeyPoints && recording.key_points?.length) {
      lines.push(heading("Key Points"));
      recording.key_points.forEach((point, i) => {
        lines.push(options.format === "md" ? `${i + 1}. ${point}` : `  ${i + 1}. ${point}`);
      });
      lines.push("");
    }

    if (options.includeActionItems && recording.action_items?.length) {
      lines.push(heading("To-Dos / Action Items"));
      recording.action_items.forEach((item) => {
        lines.push(options.format === "md" ? `- [ ] ${item}` : `  □ ${item}`);
      });
      lines.push("");
    }

    if (options.includeEmail && followUpEmail) {
      lines.push(heading("Follow-Up E-Mail"), followUpEmail, "");
    }

    if (options.includeTranscript && recording.transcript_text) {
      lines.push(separator, heading("Vollständiges Transkript"), "");
      const transcript = recording.transcript_text;
      const sepIdx = transcript.indexOf("---");
      lines.push(sepIdx !== -1 ? transcript.substring(sepIdx + 3).trim() : transcript, "");
    }

    if (options.includeMetadata && isAdmin) {
      lines.push(separator, heading("Metadaten (Admin)"));
      lines.push(`Recording ID: ${recording.id}`, `Created: ${recording.created_at}`);
      lines.push(`Duration: ${recording.duration ? Math.floor(recording.duration / 60) : 0} Minuten`);
      lines.push(`Word Count: ${recording.word_count || 0}`);
      if (recording.meeting_url) lines.push(`Meeting URL: ${recording.meeting_url}`);
      lines.push("");
    }

    if (options.includeDebugInfo && isAdmin) {
      lines.push(heading("Debug Info (Admin)"));
      lines.push(`Participants Count: ${recording.participants?.length || 0}`);
      lines.push(`Key Points Count: ${recording.key_points?.length || 0}`);
      lines.push(`Action Items Count: ${recording.action_items?.length || 0}`);
      lines.push(`Has Transcript: ${!!recording.transcript_text}`);
      lines.push(`Transcript Length: ${recording.transcript_text?.length || 0} chars`, "");
    }

    if (options.includeRawData && isAdmin) {
      lines.push(heading("Rohdaten (Admin)"), "```json", JSON.stringify(recording, null, 2), "```", "");
    }

    lines.push(separator, `Generiert am: ${format(new Date(), "dd.MM.yyyy HH:mm 'Uhr'", { locale: de })}`);
    return lines.join("\n");
  };

  const handleDownloadPDF = useCallback(async () => {
    setIsGenerating(true);
    try {
      // Create off-screen container
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      document.body.appendChild(container);

      // Render visual report into container
      const root = createRoot(container);
      root.render(
        <VisualReportView
          recording={recording}
          userEmail={userEmail || null}
          options={{
            includeSummary: options.includeSummary,
            includeKeyPoints: options.includeKeyPoints,
            includeActionItems: options.includeActionItems,
            includeTranscript: options.includeTranscript,
            includeParticipants: options.includeParticipants,
          }}
        />
      );

      // Wait for Recharts SVGs to render
      await new Promise((r) => setTimeout(r, 1000));

      const element = container.querySelector("#visual-report-container") as HTMLElement;
      if (!element) {
        toast.error("Report konnte nicht generiert werden");
        return;
      }

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Handle multi-page if content is longer than A4
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `meeting-bericht-${recording.id.slice(0, 8)}.pdf`;
      pdf.save(fileName);

      // Cleanup
      root.unmount();
      document.body.removeChild(container);

      toast.success("Visueller Bericht als PDF heruntergeladen");
      onOpenChange(false);
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("PDF-Erstellung fehlgeschlagen");
    } finally {
      setIsGenerating(false);
    }
  }, [recording, userEmail, options, onOpenChange]);

  const handleDownload = () => {
    if (options.format === "pdf") {
      handleDownloadPDF();
      return;
    }

    const content = generateTextReport();
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
              onValueChange={(v) => updateOption("format", v as "txt" | "md" | "pdf")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF (Visueller Bericht)</SelectItem>
                <SelectItem value="txt">Text (.txt)</SelectItem>
                <SelectItem value="md">Markdown (.md)</SelectItem>
              </SelectContent>
            </Select>
            {options.format === "pdf" && (
              <p className="text-xs text-muted-foreground">
                Enthält Charts und KPI-Karten wie in der Dashboard-Analyse.
              </p>
            )}
          </div>

          {/* Content Options */}
          <div className="space-y-3">
            <Label>Inhalt</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={options.includeSummary} onCheckedChange={(c) => updateOption("includeSummary", !!c)} />
                <span className="text-sm">Zusammenfassung</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={options.includeKeyPoints} onCheckedChange={(c) => updateOption("includeKeyPoints", !!c)} />
                <span className="text-sm">Key Points</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={options.includeActionItems} onCheckedChange={(c) => updateOption("includeActionItems", !!c)} />
                <span className="text-sm">To-Dos / Action Items</span>
              </label>
              {options.format !== "pdf" && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox checked={options.includeTranscript} onCheckedChange={(c) => updateOption("includeTranscript", !!c)} />
                  <span className="text-sm">Vollständiges Transkript</span>
                </label>
              )}
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={options.includeParticipants} onCheckedChange={(c) => updateOption("includeParticipants", !!c)} />
                <span className="text-sm">Teilnehmerliste</span>
              </label>
              {followUpEmail && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox checked={options.includeEmail} onCheckedChange={(c) => updateOption("includeEmail", !!c)} />
                  <span className="text-sm">Follow-Up E-Mail</span>
                </label>
              )}
            </div>
          </div>

          {/* Admin Options */}
          {isAdmin && options.format !== "pdf" && (
            <div className="border-t pt-4 space-y-3">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Settings className="h-4 w-4" />
                Erweiterte Optionen (Admin)
              </Label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox checked={options.includeMetadata} onCheckedChange={(c) => updateOption("includeMetadata", !!c)} />
                  <span className="text-sm text-muted-foreground">Metadaten (IDs, Timestamps)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox checked={options.includeDebugInfo} onCheckedChange={(c) => updateOption("includeDebugInfo", !!c)} />
                  <span className="text-sm text-muted-foreground">Debug-Informationen</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox checked={options.includeRawData} onCheckedChange={(c) => updateOption("includeRawData", !!c)} />
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
          <Button onClick={handleDownload} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {isGenerating ? "Wird erstellt..." : "Herunterladen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
