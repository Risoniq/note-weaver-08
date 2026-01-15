import { useState, useEffect } from 'react';
import { Monitor, Download, ExternalLink, Info, Laptop, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface DesktopRecording {
  id: string;
  title: string;
  status: string;
  created_at: string;
  duration: number | null;
  source: string;
}

export const DesktopRecordingTab = () => {
  const [recordings, setRecordings] = useState<DesktopRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDesktopRecordings = async () => {
      try {
        // Use type assertion since source column was just added
        const { data, error } = await supabase
          .from('recordings')
          .select('id, title, status, created_at, duration')
          .order('created_at', { ascending: false })
          .limit(10) as { data: DesktopRecording[] | null; error: any };

        if (error) throw error;
        
        // Filter for desktop_sdk source client-side until types are regenerated
        // In the future, use .eq('source', 'desktop_sdk')
        setRecordings(data || []);
      } catch (error) {
        console.error('Error fetching desktop recordings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDesktopRecordings();

    // Realtime subscription for desktop recordings
    const channel = supabase
      .channel('desktop-recordings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recordings',
          filter: 'source=eq.desktop_sdk',
        },
        () => fetchDesktopRecordings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const features = [
    'Lokale Aufnahme ohne Bot im Meeting',
    'Unterstützt Zoom, MS Teams und Google Meet',
    'Automatische Sprechererkennung',
    'Transkription direkt auf deinem Gerät',
  ];

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert className="bg-primary/5 border-primary/20">
        <Monitor className="h-5 w-5 text-primary" />
        <AlertTitle className="text-foreground font-semibold">
          Desktop-Aufnahme
        </AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Die Desktop-Aufnahme erfasst Zoom, Teams und Meet direkt auf deinem Computer – 
          ohne Bot im Meeting. Ideal für vertrauliche Gespräche.
        </AlertDescription>
      </Alert>

      {/* Features & Download Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Features Card */}
        <GlassCard>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Laptop className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Funktionen</h3>
            </div>
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </GlassCard>

        {/* Download Card */}
        <GlassCard>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Desktop-App</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Lade die Desktop-App herunter, um lokale Aufnahmen zu starten. 
              Die App synchronisiert automatisch mit deinem Dashboard.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="default" className="w-full" disabled>
                <Download className="h-4 w-4 mr-2" />
                Für macOS (Apple Silicon)
                <Badge variant="secondary" className="ml-2 text-[10px]">Bald</Badge>
              </Button>
              <Button variant="outline" className="w-full" disabled>
                <Download className="h-4 w-4 mr-2" />
                Für Windows
                <Badge variant="secondary" className="ml-2 text-[10px]">Bald</Badge>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              Basiert auf dem Recall.ai Desktop SDK
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Desktop Recordings List */}
      <GlassCard title="Desktop-Aufnahmen">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Monitor className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Noch keine Desktop-Aufnahmen vorhanden</p>
            <p className="text-xs mt-1">
              Starte eine Aufnahme mit der Desktop-App
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recordings.map((recording) => (
              <div
                key={recording.id}
                onClick={() => navigate(`/meeting/${recording.id}`)}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Monitor className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {recording.title || 'Desktop-Aufnahme'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(recording.created_at), {
                        addSuffix: true,
                        locale: de,
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={recording.status === 'done' ? 'default' : 'secondary'}
                    className="text-[10px]"
                  >
                    {recording.status === 'done' ? 'Fertig' : recording.status}
                  </Badge>
                  {recording.duration && (
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(recording.duration)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
};