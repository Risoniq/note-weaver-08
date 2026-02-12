import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Recording } from "@/types/recording";
import { RecordingCard } from "./RecordingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Users } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useTeamleadCheck } from "@/hooks/useTeamleadCheck";


interface RecordingsListProps {
  viewMode?: 'personal' | 'team';
  searchQuery?: string;
  selectedMember?: string;
  memberEmails?: Map<string, string>;
}

interface RecordingWithOwner extends Recording {
  owner_email?: string;
  is_own?: boolean;
}

export const RecordingsList = ({ viewMode = 'personal', searchQuery = '', selectedMember = 'all', memberEmails }: RecordingsListProps) => {
  const [recordings, setRecordings] = useState<RecordingWithOwner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { isImpersonating, impersonatedUserId } = useImpersonation();
  const { isAdmin } = useAdminCheck();
  const { isTeamlead } = useTeamleadCheck();

  const fetchRecordings = async () => {
    try {
      // If admin is impersonating, use edge function to fetch target user's recordings
      if (isAdmin && isImpersonating && impersonatedUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('admin-view-user-data', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: { 
            target_user_id: impersonatedUserId, 
            data_type: 'recordings' 
          },
        });

        if (error) {
          console.error('Error fetching impersonated recordings:', error);
        } else {
          setRecordings((data?.recordings || []) as unknown as RecordingWithOwner[]);
        }
        setIsLoading(false);
        return;
      }

      // Admin (not impersonating) or Teamlead viewing team recordings
      if ((isAdmin && !isImpersonating) || (isTeamlead && viewMode === 'team')) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('teamlead-recordings', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) {
          console.error('Error fetching team/admin recordings:', error);
        } else {
          setRecordings((data?.recordings || []) as RecordingWithOwner[]);
        }
        setIsLoading(false);
        return;
      }

      // Normal flow for current user
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecordings(data as unknown as RecordingWithOwner[]);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();

    // Realtime subscription for updates (only for non-impersonated and non-team view)
    if (!isImpersonating && viewMode !== 'team' && !isAdmin) {
      const channel = supabase
        .channel('recordings-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'recordings' },
          () => {
            fetchRecordings();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAdmin, isImpersonating, impersonatedUserId, isTeamlead, viewMode]);

  const filteredRecordings = useMemo(() => {
    let result = recordings;

    if (selectedMember !== 'all') {
      result = result.filter((r) => (r as any).user_id === selectedMember);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title?.toLowerCase().includes(query) ||
          r.transcript_text?.toLowerCase().includes(query) ||
          r.summary?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [recordings, searchQuery, selectedMember]);

  if (isLoading) {
    return (
      <div className="w-full">
        <h2 className="text-xl font-semibold text-foreground mb-4">Aufnahmen</h2>
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (filteredRecordings.length === 0) {
    return (
      <div className="w-full">
        <h2 className="text-xl font-semibold text-foreground mb-4">Aufnahmen</h2>
        <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-border rounded-xl bg-muted/30">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-center">
            {searchQuery.trim()
              ? 'Keine Aufnahmen gefunden. Versuche andere Suchbegriffe.'
              : viewMode === 'team' 
                ? 'Noch keine Team-Aufnahmen vorhanden.'
                : 'Noch keine Aufnahmen vorhanden.'}
            {!searchQuery.trim() && <><br />Starte deinen ersten Meeting-Bot oben.</>}
          </p>
        </div>
      </div>
    );
  }

  const isTeamView = viewMode === 'team' || (isAdmin && !isImpersonating);

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        {isTeamView && <Users className="h-5 w-5" />}
        {isTeamView ? 'Team-Aufnahmen' : 'Aufnahmen'} ({filteredRecordings.length})
      </h2>
      <div className="flex flex-col gap-3">
        {filteredRecordings.map((recording) => (
          <RecordingCard
            key={recording.id}
            recording={recording}
            onClick={() => navigate(`/meeting/${recording.id}`)}
            ownerEmail={isTeamView && recording.owner_email && !recording.is_own ? recording.owner_email : undefined}
          />
        ))}
      </div>
    </div>
  );
};
