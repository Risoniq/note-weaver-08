import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { 
  Users, 
  HelpCircle, 
  MessageSquare, 
  Lightbulb,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { 
  performDeepDiveAnalysis, 
  DeepDiveAnalysis,
  SpeakerShare,
  ContentBreakdown 
} from "@/utils/deepDiveAnalysis";
import { MeetingChatWidget } from "./MeetingChatWidget";

interface DeepDiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcript: string | null;
  userEmail: string | null;
  meetingTitle?: string;
  summary?: string;
  keyPoints?: string[];
  actionItems?: string[];
}

// Custom Tooltip für Pie Charts
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
        <p className="text-sm font-medium">{payload[0].name}</p>
        <p className="text-xs text-muted-foreground">
          {payload[0].value}%
        </p>
      </div>
    );
  }
  return null;
};

// Sprecher Pie Chart
const SpeakerPieChart = ({ data }: { data: SpeakerShare[] }) => {
  const chartData = data.map(speaker => ({
    name: speaker.name,
    value: speaker.percentage,
    fill: speaker.color,
  }));

  return (
    <div className="flex flex-col">
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
              label={({ value }) => `${value}%`}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 mt-2 px-1">
        {data.map((speaker, index) => (
          <div key={index} className="flex items-center gap-1.5 min-w-0">
            <div 
              className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
              style={{ backgroundColor: speaker.color }}
            />
            <span className="text-[11px] text-muted-foreground truncate">
              {speaker.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Content Breakdown Pie Chart
const ContentPieChart = ({ data }: { data: ContentBreakdown }) => {
  const chartData = [
    { name: 'Business', value: data.business, fill: 'hsl(210, 80%, 55%)' },
    { name: 'Small Talk', value: data.smallTalk, fill: 'hsl(45, 80%, 55%)' },
  ];

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            label={({ name, value }) => `${value}%`}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-3 rounded-full bg-[hsl(210,80%,55%)]" />
          <span className="text-muted-foreground">Business ({data.business}%)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-3 rounded-full bg-[hsl(45,80%,55%)]" />
          <span className="text-muted-foreground">Small Talk ({data.smallTalk}%)</span>
        </div>
      </div>
    </div>
  );
};

export const DeepDiveModal = ({ 
  open, 
  onOpenChange, 
  transcript,
  userEmail,
  meetingTitle,
  summary,
  keyPoints,
  actionItems
}: DeepDiveModalProps) => {
  const analysis = useMemo((): DeepDiveAnalysis | null => {
    if (!transcript) return null;
    return performDeepDiveAnalysis(transcript, userEmail);
  }, [transcript, userEmail]);

  if (!analysis) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Deep Dive Analyse</SheetTitle>
            <SheetDescription>
              Kein Transkript für die Analyse verfügbar.
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Deep Dive Analyse
              </SheetTitle>
              <SheetDescription>
                Detaillierte Einblicke in Ihr Meeting
              </SheetDescription>
            </SheetHeader>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sprechanteile */}
              <Card className="border rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Sprechanteile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysis.speakerShares.length > 0 ? (
                    <SpeakerPieChart data={analysis.speakerShares} />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                      Keine Sprecherdaten verfügbar
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Small Talk vs. Business */}
              <Card className="border rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-accent" />
                    Inhalt vs. Small Talk
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ContentPieChart data={analysis.contentBreakdown} />
                </CardContent>
              </Card>
            </div>


            {/* Kundenbedürfnisse */}
            <Card className="border rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-success" />
                  Erkannte Kundenbedürfnisse
                  <Badge variant="secondary" className="ml-auto rounded-full">
                    {analysis.customerNeeds.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.customerNeeds.length > 0 ? (
                  <div className="space-y-3">
                    {analysis.customerNeeds.map((need, index) => (
                      <div 
                        key={index} 
                        className="p-3 rounded-xl bg-success/10 border border-success/20"
                      >
                        <p className="text-sm text-foreground font-medium">
                          {need.need}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Von: <span className="font-medium">{need.speaker}</span>
                        </p>
                        {need.context && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            Kontext: "{need.context}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Keine expliziten Kundenbedürfnisse erkannt
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Meeting Chat Widget */}
            <MeetingChatWidget 
              transcript={transcript}
              meetingTitle={meetingTitle}
              summary={summary}
              keyPoints={keyPoints}
              actionItems={actionItems}
            />

            {/* Zusammenfassung Stats */}
            <Card className="border rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">
                      {analysis.speakerShares.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Sprecher</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-accent">
                      {analysis.contentBreakdown.business}%
                    </p>
                    <p className="text-xs text-muted-foreground">Business-Inhalt</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">
                      {analysis.customerNeeds.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Bedürfnisse</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
