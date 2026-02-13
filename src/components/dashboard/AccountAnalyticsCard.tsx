import { useState, useEffect, useMemo } from "react";
import { TrendingUp, ChevronRight, Users, Clock, CheckSquare, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { calculateAccountAnalytics, formatDuration, type Recording, type AccountAnalytics } from "@/utils/accountAnalytics";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { AccountAnalyticsModal } from "./AccountAnalyticsModal";
import { Skeleton } from "@/components/ui/skeleton";
export const AccountAnalyticsCard = () => {
  const {
    user
  } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    const fetchRecordings = async () => {
      if (!user) return;
      const {
        data,
        error
      } = await supabase.from("recordings").select("id, created_at, duration, transcript_text, action_items, key_points, participants, status, title").eq("user_id", user.id).eq("status", "done").order("created_at", {
        ascending: false
      }).limit(50);
      if (!error && data) {
        setRecordings(data as Recording[]);
      }
      setLoading(false);
    };
    fetchRecordings();
  }, [user]);
  const analytics = useMemo<AccountAnalytics | null>(() => {
    if (recordings.length === 0) return null;
    return calculateAccountAnalytics(recordings, user?.email || null);
  }, [recordings, user?.email]);
  if (loading) {
    return <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-12" />
        <Skeleton className="h-10" />
      </div>;
  }
  if (!analytics || analytics.totalMeetings === 0) {
    return <div className="flex flex-col items-center justify-center py-8 text-center">
        <TrendingUp className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">
          Noch keine abgeschlossenen Meetings
        </p>
        <p className="text-sm text-muted-foreground/70">
          Nach deinem ersten Meeting erscheinen hier Analysen
        </p>
      </div>;
  }

  // Pie Chart Daten
  const speakerChartData = analytics.aggregatedSpeakerShares.slice(0, 5).map(s => ({
    name: s.name,
    value: s.percentage,
    color: s.color
  }));
  const contentChartData = [{
    name: "Business",
    value: analytics.aggregatedContentBreakdown.business,
    color: "hsl(210, 80%, 55%)"
  }, {
    name: "Small Talk",
    value: analytics.aggregatedContentBreakdown.smallTalk,
    color: "hsl(45, 80%, 55%)"
  }];
  return <>
      <div className="space-y-4">
        {/* Mini Pie Charts */}
        <div className="grid grid-cols-2 gap-4">
          {/* Sprechanteile */}
          <div className="bg-background/50 rounded-xl p-3 border border-border/30">
            <p className="text-xs text-muted-foreground mb-1">Sprechanteile</p>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={speakerChartData} cx="50%" cy="50%" innerRadius={15} outerRadius={30} paddingAngle={2} dataKey="value">
                    {speakerChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Business vs Small Talk */}
          <div className="bg-background/50 rounded-xl p-3 border border-border/30">
            <p className="text-xs text-muted-foreground mb-1">Business/Small Talk</p>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={contentChartData} cx="50%" cy="50%" innerRadius={15} outerRadius={30} paddingAngle={2} dataKey="value">
                    {contentChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-3 w-3 text-muted-foreground/50" />
            <span className="font-mono font-light text-lg text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.2)]">{analytics.totalMeetings}</span>
            <span className="uppercase tracking-widest text-[10px] text-muted-foreground">Meetings</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground/50" />
            <span className="font-mono font-light text-lg text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.2)]">{formatDuration(analytics.totalDurationMinutes)}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckSquare className="h-3 w-3 text-muted-foreground/50" />
            <span className="font-mono font-light text-lg text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.2)]">{analytics.totalActionItems}</span>
            <span className="uppercase tracking-widest text-[10px] text-muted-foreground">To-Dos</span>
          </div>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-3 w-3 text-muted-foreground/50" />
            <span className="font-mono font-light text-lg text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.2)]">{analytics.totalKeyPoints}</span>
            <span className="uppercase tracking-widest text-[10px] text-muted-foreground">Key Points</span>
          </div>
        </div>

        {/* CTA Button */}
        <Button variant="outline" className="w-full justify-between group" onClick={() => setModalOpen(true)}>
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Account Analyse öffnen
          </span>
          <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>

      <AccountAnalyticsModal open={modalOpen} onClose={() => setModalOpen(false)} analytics={analytics} />
    </>;
};