import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Recording, getStatusLabel } from "@/types/recording";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Video, Clock, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

export const RecentActivityList = () => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchRecordings = async () => {
    try {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecordings(data as unknown as Recording[]);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();

    const channel = supabase
      .channel('recent-activity-changes')
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
  }, []);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')} Min`;
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">Letzte Aktivitäten</CardTitle>
          <p className="text-sm text-muted-foreground">Chronologische Übersicht Ihrer Meeting Aktivitäten</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (recordings.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Letzte Aktivitäten</CardTitle>
        <p className="text-sm text-muted-foreground">Chronologische Übersicht Ihrer Meeting Aktivitäten</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {recordings.map((recording, index) => {
          const isHighlighted = index % 2 === 1;
          
          return (
            <div
              key={recording.id}
              onClick={() => navigate(`/meeting/${recording.id}`)}
              className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors hover:bg-primary/10 ${
                isHighlighted ? 'bg-primary/5' : 'bg-transparent'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="text-muted-foreground">
                  {recording.status === 'done' ? (
                    <Video className="h-5 w-5" />
                  ) : (
                    <Calendar className="h-5 w-5" />
                  )}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {recording.title || 'Unbekanntes Meeting'}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground">
                      {getStatusLabel(recording.status)}
                    </span>
                  </div>
                  {recording.duration && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDuration(recording.duration)}
                    </div>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-0 whitespace-nowrap">
                {formatDistanceToNow(new Date(recording.created_at), { 
                  addSuffix: true, 
                  locale: de 
                })}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
