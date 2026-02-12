import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Share2, X, Loader2, UserPlus, Mail } from "lucide-react";

interface ShareRecordingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingId: string;
}

interface SharedUser {
  id: string;
  email: string;
  shared_with: string;
  created_at: string;
}

export const ShareRecordingDialog = ({ open, onOpenChange, recordingId }: ShareRecordingDialogProps) => {
  const [email, setEmail] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shares, setShares] = useState<SharedUser[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchShares = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("share-recording", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: "list", recording_id: recordingId },
      });

      if (error) throw error;
      if (data?.success) {
        setShares(data.shares || []);
      }
    } catch (err) {
      console.error("Error fetching shares:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchShares();
      setEmail("");
    }
  }, [open, recordingId]);

  const handleShare = async () => {
    if (!email.trim()) return;
    setIsSharing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sitzung abgelaufen");
        return;
      }

      const { data, error } = await supabase.functions.invoke("share-recording", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: "share", recording_id: recordingId, email: email.trim() },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Meeting geteilt mit ${data.shared_with_email}`);
        setEmail("");
        fetchShares();
      } else {
        toast.error(data?.error || "Teilen fehlgeschlagen");
      }
    } catch (err) {
      console.error("Share error:", err);
      toast.error("Teilen fehlgeschlagen");
    } finally {
      setIsSharing(false);
    }
  };

  const handleUnshare = async (shareId: string) => {
    setRemovingId(shareId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("share-recording", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: "unshare", share_id: shareId },
      });

      if (error) throw error;
      if (data?.success) {
        toast.success("Freigabe entfernt");
        setShares((prev) => prev.filter((s) => s.id !== shareId));
      }
    } catch (err) {
      console.error("Unshare error:", err);
      toast.error("Entfernen fehlgeschlagen");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Meeting teilen
          </DialogTitle>
          <DialogDescription>
            Teile dieses Meeting mit anderen Nutzern per E-Mail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Share input */}
          <div className="space-y-2">
            <Label htmlFor="share-email">E-Mail-Adresse</Label>
            <div className="flex gap-2">
              <Input
                id="share-email"
                type="email"
                placeholder="kollege@firma.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleShare()}
              />
              <Button onClick={handleShare} disabled={isSharing || !email.trim()} size="sm">
                {isSharing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Current shares */}
          <div className="space-y-2">
            <Label>Geteilt mit</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : shares.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Noch mit niemandem geteilt.
              </p>
            ) : (
              <div className="space-y-2">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{share.email}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleUnshare(share.id)}
                      disabled={removingId === share.id}
                    >
                      {removingId === share.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
