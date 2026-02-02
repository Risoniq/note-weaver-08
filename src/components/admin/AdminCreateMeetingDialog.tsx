import { useState, useRef } from 'react';
import { Upload, FileText, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { withTokenRefresh } from '@/lib/retryWithTokenRefresh';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  email: string;
}

interface AdminCreateMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  onSuccess: () => void;
}

export const AdminCreateMeetingDialog = ({
  open,
  onOpenChange,
  users,
  onSuccess,
}: AdminCreateMeetingDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [meetingDate, setMeetingDate] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');

  const resetForm = () => {
    setSelectedUserId('');
    setTitle('');
    setTranscriptText('');
    setTranscriptFile(null);
    setMeetingDate(undefined);
    setInputMode('text');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.txt')) {
      toast({
        title: 'Ungültiges Dateiformat',
        description: 'Bitte laden Sie eine .txt Datei hoch.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Datei zu groß',
        description: 'Die Datei darf maximal 5MB groß sein.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const text = await file.text();
      setTranscriptFile(file);
      setTranscriptText(text);
      setInputMode('file');
    } catch (err) {
      toast({
        title: 'Fehler beim Lesen',
        description: 'Die Datei konnte nicht gelesen werden.',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async () => {
    // Validate
    if (!selectedUserId) {
      toast({
        title: 'Benutzer auswählen',
        description: 'Bitte wählen Sie einen Benutzer aus.',
        variant: 'destructive',
      });
      return;
    }

    if (!transcriptText || transcriptText.trim().length < 100) {
      toast({
        title: 'Transkript zu kurz',
        description: 'Das Transkript muss mindestens 100 Zeichen haben.',
        variant: 'destructive',
      });
      return;
    }

    if (transcriptText.length > 500000) {
      toast({
        title: 'Transkript zu lang',
        description: 'Das Transkript darf maximal 500.000 Zeichen haben.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({
          title: 'Nicht angemeldet',
          description: 'Bitte melden Sie sich erneut an.',
          variant: 'destructive',
        });
        return;
      }

      const response = await withTokenRefresh(
        () => supabase.functions.invoke('admin-create-meeting', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: {
            target_user_id: selectedUserId,
            title: title.trim() || undefined,
            transcript_text: transcriptText.trim(),
            meeting_date: meetingDate?.toISOString(),
          },
        })
      );

      if (response.error) {
        throw new Error(response.error.message || 'Fehler beim Anlegen des Meetings');
      }

      toast({
        title: 'Meeting angelegt',
        description: `Das Meeting wurde erfolgreich für den Benutzer angelegt und analysiert.`,
      });

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error('Error creating meeting:', err);
      toast({
        title: 'Fehler',
        description: err.message || 'Meeting konnte nicht angelegt werden',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Meeting für Benutzer anlegen</DialogTitle>
          <DialogDescription>
            Legen Sie ein neues Meeting mit Transkript für einen Benutzer an. Die KI analysiert das Transkript automatisch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User Selection */}
          <div className="space-y-2">
            <Label htmlFor="user-select">Benutzer *</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="user-select">
                <SelectValue placeholder="Benutzer auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title (optional) */}
          <div className="space-y-2">
            <Label htmlFor="title">Meeting-Titel (optional)</Label>
            <Input
              id="title"
              placeholder="Wird von KI generiert wenn leer..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              Lassen Sie das Feld leer, um einen Titel basierend auf dem Inhalt zu generieren.
            </p>
          </div>

          {/* Meeting Date (optional) */}
          <div className="space-y-2">
            <Label>Meeting-Datum (optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !meetingDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {meetingDate ? format(meetingDate, "PPP", { locale: de }) : "Datum auswählen..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={meetingDate}
                  onSelect={setMeetingDate}
                  initialFocus
                  locale={de}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Transcript Input */}
          <div className="space-y-2">
            <Label>Transkript *</Label>
            
            {/* Toggle between text and file */}
            <div className="flex gap-2 mb-3">
              <Button
                type="button"
                variant={inputMode === 'text' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setInputMode('text');
                  setTranscriptFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <FileText className="h-4 w-4 mr-1" />
                Text eingeben
              </Button>
              <Button
                type="button"
                variant={inputMode === 'file' ? 'default' : 'outline'}
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Datei hochladen
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
            />

            {transcriptFile && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{transcriptFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 px-2"
                  onClick={() => {
                    setTranscriptFile(null);
                    setTranscriptText('');
                    setInputMode('text');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  Entfernen
                </Button>
              </div>
            )}

            <Textarea
              placeholder="Fügen Sie hier das Meeting-Transkript ein... (min. 100 Zeichen)"
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {transcriptText.length.toLocaleString('de-DE')} / 500.000 Zeichen
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isLoading}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !selectedUserId || !transcriptText}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Wird angelegt...
              </>
            ) : (
              'Meeting anlegen'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
