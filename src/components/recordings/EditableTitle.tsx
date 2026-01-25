import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditableTitleProps {
  recordingId: string;
  title: string | null;
  meetingId: string;
  onTitleChange?: (newTitle: string) => void;
}

export const EditableTitle = ({ 
  recordingId, 
  title, 
  meetingId,
  onTitleChange 
}: EditableTitleProps) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title || '');
  const [isSaving, setIsSaving] = useState(false);

  // Sync local state when title prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditedTitle(title || '');
    }
  }, [title, isEditing]);

  const displayTitle = title || `Meeting ${meetingId.slice(0, 8)}`;

  const handleSave = async () => {
    const trimmedTitle = editedTitle.trim();
    
    if (trimmedTitle === (title || '')) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    
    const { error } = await supabase
      .from('recordings')
      .update({ title: trimmedTitle || null })
      .eq('id', recordingId);

    setIsSaving(false);

    if (error) {
      console.error('Failed to update title:', error);
      toast({
        title: "Fehler",
        description: "Titel konnte nicht gespeichert werden",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Titel aktualisiert",
      description: "Der Meeting-Titel wurde gespeichert",
    });
    
    setIsEditing(false);
    onTitleChange?.(trimmedTitle);
  };

  const handleCancel = () => {
    setEditedTitle(title || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <Input
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Meeting-Titel eingeben..."
          className="text-xl font-semibold h-auto py-1"
          autoFocus
          disabled={isSaving}
        />
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleSave}
          disabled={isSaving}
          className="shrink-0 h-8 w-8"
        >
          <Check className="h-4 w-4 text-primary" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleCancel}
          disabled={isSaving}
          className="shrink-0 h-8 w-8"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group flex-1 min-w-0">
      <h2 
        className="text-xl font-semibold truncate cursor-pointer hover:text-primary transition-colors"
        onClick={() => setIsEditing(true)}
        title={displayTitle}
      >
        {displayTitle}
      </h2>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => setIsEditing(true)}
        className="shrink-0 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
};
