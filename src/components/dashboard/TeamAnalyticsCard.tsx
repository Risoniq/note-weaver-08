import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Users, Clock, CheckSquare, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTeamleadCheck } from "@/hooks/useTeamleadCheck";
import { calculateAccountAnalytics, formatDuration, type Recording, type AccountAnalytics } from "@/utils/accountAnalytics";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const TeamAnalyticsCard = () => {
  const { isTeamlead, teamId, teamName } = useTeamleadCheck();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [memberEmails, setMemberEmails] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeamRecordings = async () => {
      if (!isTeamlead || !teamId) {
        setLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('teamlead-recordings', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!error && data) {
          setRecordings(data.recordings?.filter((r: any) => r.status === 'done') || []);
          
          // Build email map from members
          const emailMap = new Map<string, string>();
          for (const member of data.members || []) {
            emailMap.set(member.user_id, member.email);
          }
          setMemberEmails(emailMap);
        }
      } catch (err) {
        console.error('Error fetching team recordings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamRecordings();
  }, [isTeamlead, teamId]);

  const analytics = useMemo<AccountAnalytics | null>(() => {
    if (recordings.length === 0) return null;
    return calculateAccountAnalytics(recordings, null);
  }, [recordings]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-12" />
      </div>
    );
  }

  if (!analytics || analytics.totalMeetings === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">
          Noch keine Team-Meetings
        </p>
        <p className="text-sm text-muted-foreground/70">
          Nach abgeschlossenen Meetings erscheinen hier Team-Analysen
        </p>
      </div>
    );
  }

  // Group recordings by user for member breakdown
  const memberStats = useMemo(() => {
    const stats = new Map<string, { count: number; duration: number }>();
    for (const rec of recordings) {
      const userId = (rec as any).user_id;
      if (!userId) continue;
      const current = stats.get(userId) || { count: 0, duration: 0 };
      current.count += 1;
      current.duration += rec.duration || 0;
      stats.set(userId, current);
    }
    return Array.from(stats.entries()).map(([userId, data]) => ({
      userId,
      email: memberEmails.get(userId) || 'Unbekannt',
      count: data.count,
      duration: data.duration,
    })).sort((a, b) => b.duration - a.duration);
  }, [recordings, memberEmails]);

  // Pie Chart data for member distribution
  const memberChartData = memberStats.slice(0, 5).map((m, i) => ({
    name: m.email.split('@')[0],
    value: Math.round(m.duration / 60),
    color: `hsl(${210 + i * 30}, 70%, 50%)`,
  }));

  const contentChartData = [
    { name: "Business", value: analytics.aggregatedContentBreakdown.business, color: "hsl(210, 80%, 55%)" },
    { name: "Small Talk", value: analytics.aggregatedContentBreakdown.smallTalk, color: "hsl(45, 80%, 55%)" },
  ];

  return (
    <div className="space-y-4">
      {/* Team Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          <Users className="h-3 w-3 mr-1" />
          {teamName}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {memberStats.length} Mitglieder aktiv
        </span>
      </div>

      {/* Mini Pie Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Member Distribution */}
        <div className="bg-background/50 rounded-xl p-3 border border-border/30">
          <p className="text-xs text-muted-foreground mb-1">Mitglieder-Aktivität</p>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={memberChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={15}
                  outerRadius={30}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {memberChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
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
                <Pie
                  data={contentChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={15}
                  outerRadius={30}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {contentChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{analytics.totalMeetings}</span>
          <span className="text-muted-foreground">Meetings</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{formatDuration(analytics.totalDurationMinutes)}</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{analytics.totalActionItems}</span>
          <span className="text-muted-foreground">To-Dos</span>
        </div>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{analytics.totalKeyPoints}</span>
          <span className="text-muted-foreground">Key Points</span>
        </div>
      </div>

      {/* Top Members */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Top-Mitglieder nach Zeit</p>
        {memberStats.slice(0, 3).map((member) => (
          <div key={member.userId} className="flex items-center justify-between text-xs">
            <span className="truncate">{member.email}</span>
            <span className="text-muted-foreground">
              {formatDuration(Math.round(member.duration / 60))} • {member.count} Meetings
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
