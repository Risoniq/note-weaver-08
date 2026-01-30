import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid 
} from "recharts";
import { 
  Users, Clock, CheckSquare, Lightbulb, 
  MessageCircleQuestion, HeartHandshake, TrendingUp 
} from "lucide-react";
import { formatDuration, type AccountAnalytics } from "@/utils/accountAnalytics";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AccountAnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  analytics: AccountAnalytics | null;
}

export const AccountAnalyticsModal = ({ open, onClose, analytics }: AccountAnalyticsModalProps) => {
  if (!analytics) return null;

  // Aggregierte Sprechanteile: Eigener Account vs. Andere
  const ownAccountTotal = analytics.aggregatedSpeakerShares
    .filter(s => !s.isCustomer)
    .reduce((sum, s) => sum + s.percentage, 0);
  const othersTotal = analytics.aggregatedSpeakerShares
    .filter(s => s.isCustomer)
    .reduce((sum, s) => sum + s.percentage, 0);

  const speakerChartData = [
    { name: "Eigener Account", value: ownAccountTotal, color: "hsl(210, 80%, 55%)" },
    { name: "Andere", value: othersTotal, color: "hsl(150, 70%, 50%)" },
  ];

  const contentChartData = [
    { name: "Business", value: analytics.aggregatedContentBreakdown.business, color: "hsl(210, 80%, 55%)" },
    { name: "Small Talk", value: analytics.aggregatedContentBreakdown.smallTalk, color: "hsl(45, 80%, 55%)" },
  ];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden p-0">
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
              <StatCard 
                icon={<Users className="h-5 w-5" />}
                value={analytics.totalMeetings}
                label="Meetings"
              />
              <StatCard 
                icon={<Clock className="h-5 w-5" />}
                value={formatDuration(analytics.totalDurationMinutes)}
                label="Aufnahmezeit"
              />
              <StatCard 
                icon={<CheckSquare className="h-5 w-5" />}
                value={analytics.totalActionItems}
                label="To-Dos"
              />
              <StatCard 
                icon={<MessageCircleQuestion className="h-5 w-5" />}
                value={analytics.aggregatedOpenQuestions.length}
                label="Offene Fragen"
              />
            </div>

            {/* Pie Charts */}
            <div className="grid grid-cols-2 gap-6">
              {/* Sprechanteile: Eigener Account vs. Andere */}
              <div className="bg-muted/30 rounded-xl p-4">
                <h3 className="font-medium mb-3">Sprechanteile</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={speakerChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {speakerChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                  {speakerChartData.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: s.color }}
                      />
                      <span>{s.name} {s.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Business vs Small Talk */}
              <div className="bg-muted/30 rounded-xl p-4">
                <h3 className="font-medium mb-3">Business vs. Small Talk</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={contentChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
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
                <div className="flex justify-center gap-4 mt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-[hsl(210,80%,55%)]" />
                    <span>Business {analytics.aggregatedContentBreakdown.business}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-[hsl(45,80%,55%)]" />
                    <span>Small Talk {analytics.aggregatedContentBreakdown.smallTalk}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Meetings pro Woche - Line Chart */}
            {analytics.weeklyData.length > 1 && (
              <div className="bg-muted/30 rounded-xl p-4">
                <h3 className="font-medium mb-4">Meetings pro Woche</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="week" 
                        tick={{ fontSize: 12 }} 
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }} 
                        stroke="hsl(var(--muted-foreground))"
                        allowDecimals={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [`${value} Meetings`, 'Anzahl']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="hsl(210, 80%, 55%)" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(210, 80%, 55%)' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top Sprecher */}
            <div className="bg-muted/30 rounded-xl p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Top Sprecher
              </h3>
              <div className="space-y-2">
                {analytics.aggregatedSpeakerShares.slice(0, 5).map((speaker, i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-between text-sm bg-background/50 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: speaker.color }}
                      />
                      <span className="truncate max-w-[200px]">{speaker.name}</span>
                    </div>
                    <span className="text-muted-foreground">{speaker.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Kundenbedürfnisse */}
            <div className="bg-muted/30 rounded-xl p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <HeartHandshake className="h-4 w-4 text-primary" />
                Häufigste Bedürfnisse
              </h3>
              {analytics.aggregatedCustomerNeeds.length > 0 ? (
                <div className="space-y-2">
                  {analytics.aggregatedCustomerNeeds.slice(0, 5).map((need, i) => (
                    <div 
                      key={i} 
                      className="text-sm bg-background/50 rounded-lg px-3 py-2"
                    >
                      <p className="line-clamp-2">{need.need}</p>
                      <p className="text-xs text-muted-foreground mt-1">— {need.speaker}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Keine Kundenbedürfnisse erkannt
                </p>
              )}
            </div>

            {/* Offene Fragen */}
            {analytics.aggregatedOpenQuestions.length > 0 && (
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Offene Fragen aus allen Meetings
                </h3>
                <div className="space-y-2">
                  {analytics.aggregatedOpenQuestions.slice(0, 5).map((q, i) => (
                    <div 
                      key={i} 
                      className="text-sm bg-background/50 rounded-lg px-3 py-2"
                    >
                      <p className="line-clamp-2">{q.question}</p>
                      <p className="text-xs text-muted-foreground mt-1">— {q.speaker}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
  <div className="bg-muted/30 rounded-xl p-3 text-center">
    <div className="flex justify-center text-primary mb-1">{icon}</div>
    <p className="text-xl font-semibold">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);
