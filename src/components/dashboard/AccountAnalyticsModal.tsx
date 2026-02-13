import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Users, Clock, CheckSquare, MessageCircleQuestion, TrendingUp, Target, ListTodo, CalendarDays } from "lucide-react";
import { formatDuration, type AccountAnalytics, type ActionItemWithContext } from "@/utils/accountAnalytics";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MeetingChatWidget } from "./MeetingChatWidget";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isThisWeek } from "date-fns";
import { de } from "date-fns/locale";

interface AccountAnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  analytics: AccountAnalytics | null;
}

export const AccountAnalyticsModal = ({
  open,
  onClose,
  analytics
}: AccountAnalyticsModalProps) => {
  const [todoFilter, setTodoFilter] = useState<"week" | "all">("week");

  if (!analytics) return null;

  // Aggregierte Sprechanteile: Eigener Account vs. Andere
  const ownAccountTotal = analytics.aggregatedSpeakerShares.filter(s => !s.isCustomer).reduce((sum, s) => sum + s.percentage, 0);
  const othersTotal = analytics.aggregatedSpeakerShares.filter(s => s.isCustomer).reduce((sum, s) => sum + s.percentage, 0);
  const speakerChartData = [
    { name: "Eigener Account", value: ownAccountTotal, color: "hsl(210, 80%, 55%)" },
    { name: "Andere", value: othersTotal, color: "hsl(150, 70%, 50%)" },
  ];
  const contentChartData = [
    { name: "Business", value: analytics.aggregatedContentBreakdown.business, color: "hsl(210, 80%, 55%)" },
    { name: "Small Talk", value: analytics.aggregatedContentBreakdown.smallTalk, color: "hsl(45, 80%, 55%)" },
  ];

  const eff = analytics.meetingEffectiveness;
  const effectivenessScore = Math.round(
    (eff.assignedPercentage * 0.4) + 
    (eff.followUpPercentage * 0.3) + 
    (eff.nextStepsPercentage * 0.3)
  );
  const effectivenessChartData = [
    { name: "Effektiv", value: effectivenessScore, color: "hsl(150, 70%, 50%)" },
    { name: "Potential", value: 100 - effectivenessScore, color: "hsl(0, 0%, 85%)" },
  ];

  // To-Do Filterung
  const thisWeekItems = analytics.allActionItems.filter(item => {
    try {
      return isThisWeek(parseISO(item.meetingDate), { weekStartsOn: 1 });
    } catch { return false; }
  });
  const displayedItems = todoFilter === "week" ? thisWeekItems : analytics.allActionItems;

  return (
    <Sheet open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-hidden p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Account-Analyse — Alle Meetings
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-6 space-y-8">
            {/* Übersichts-Statistiken */}
            <div className="grid grid-cols-4 gap-3">
              <StatCard icon={<Users className="h-5 w-5" />} value={analytics.totalMeetings} label="Meetings" />
              <StatCard icon={<Clock className="h-5 w-5" />} value={formatDuration(analytics.totalDurationMinutes)} label="Aufnahmezeit" />
              <StatCard icon={<CheckSquare className="h-5 w-5" />} value={analytics.totalActionItems} label="To-Dos" />
              <StatCard icon={<MessageCircleQuestion className="h-5 w-5" />} value={analytics.aggregatedOpenQuestions.length} label="Offene Fragen" />
            </div>

            {/* Pie Charts - 3er Grid */}
            <div className="grid grid-cols-3 gap-4">
              {/* Sprechanteile */}
              <div className="bg-muted/30 rounded-xl p-4">
                <h3 className="font-medium mb-2 text-sm">Sprechanteile</h3>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={speakerChartData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} dataKey="value">
                        {speakerChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1 mt-1">
                  {speakerChartData.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="truncate">{s.name} <span className="font-mono font-light">{s.value}%</span></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Business vs Small Talk */}
              <div className="bg-muted/30 rounded-xl p-4">
                <h3 className="font-medium mb-2 text-sm">Business/Small Talk</h3>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={contentChartData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} dataKey="value">
                        {contentChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-[hsl(210,80%,55%)]" />
                    <span>Business <span className="font-mono font-light">{analytics.aggregatedContentBreakdown.business}%</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-[hsl(45,80%,55%)]" />
                    <span>Small Talk <span className="font-mono font-light">{analytics.aggregatedContentBreakdown.smallTalk}%</span></span>
                  </div>
                </div>
              </div>

              {/* Meeting-Effektivität */}
              <div className="bg-muted/30 rounded-xl p-4">
                <h3 className="font-medium mb-2 text-sm flex items-center gap-1">
                  <Target className="h-3 w-3 text-primary" />
                  Effektivität
                </h3>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={effectivenessChartData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={0} dataKey="value" startAngle={90} endAngle={-270}>
                        {effectivenessChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1 mt-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">To-Dos zugeordnet</span>
                    <span className="font-mono font-light text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.2)]">{eff.assignedPercentage}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Follow-Ups</span>
                    <span className="font-mono font-light text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.2)]">{eff.followUpPercentage}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Nächste Schritte</span>
                    <span className="font-mono font-light text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.2)]">{eff.nextStepsPercentage}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* To-Do Übersicht */}
            <div className="bg-muted/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-primary" />
                  Meine To-Dos
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => setTodoFilter("week")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      todoFilter === "week"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      Diese Woche
                      <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] h-4">
                        {thisWeekItems.length}
                      </Badge>
                    </span>
                  </button>
                  <button
                    onClick={() => setTodoFilter("all")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      todoFilter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      Alle
                      <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] h-4">
                        {analytics.allActionItems.length}
                      </Badge>
                    </span>
                  </button>
                </div>
              </div>

              {displayedItems.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {displayedItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 bg-background/50 rounded-lg px-3 py-2.5">
                      <Checkbox className="mt-0.5 shrink-0" disabled />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm line-clamp-2">{item.text}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="truncate max-w-[200px]">{item.meetingTitle}</span>
                          <span>·</span>
                          <span className="shrink-0">
                            {(() => {
                              try { return format(parseISO(item.meetingDate), 'dd.MM.yyyy', { locale: de }); }
                              catch { return ''; }
                            })()}
                          </span>
                          {item.assignedTo && (
                            <>
                              <span>·</span>
                              <span className="text-primary font-medium truncate max-w-[120px]">→ {item.assignedTo}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {todoFilter === "week" ? "Keine To-Dos diese Woche" : "Keine To-Dos vorhanden"}
                </p>
              )}
            </div>

            {/* Meetings pro Woche - Line Chart */}
            {analytics.weeklyData.length > 1 && (
              <div className="bg-muted/30 rounded-xl p-4">
                <h3 className="font-medium mb-4">Meetings pro Woche</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                      <Tooltip contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} formatter={(value: number) => [`${value} Meetings`, 'Anzahl']} />
                      <Line type="monotone" dataKey="count" stroke="hsl(210, 80%, 55%)" strokeWidth={2} dot={{ fill: 'hsl(210, 80%, 55%)' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Meeting Chat Widget */}
            <MeetingChatWidget />

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

// Stat Card Komponente
const StatCard = ({
  icon,
  value,
  label
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) => (
  <div className="rounded-xl p-3 text-center border border-border/40 bg-transparent">
    <div className="flex justify-center text-muted-foreground/40 mb-1">{icon}</div>
    <p className="text-2xl font-light font-mono tracking-wider text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.3)]">{value}</p>
    <p className="uppercase tracking-[0.15em] text-[10px] text-muted-foreground mt-1">{label}</p>
  </div>
);
