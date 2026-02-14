import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";

const DOMAIN_COLORS = {
  marketing: "#3b82f6",
  produkt: "#8b5cf6",
  sales: "#f59e0b",
  operations: "#22c55e",
};

const STATUS_STYLES: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
  verfolgt: { variant: "default", label: "verfolgt" },
  offen: { variant: "secondary", label: "offen" },
  erledigt: { variant: "outline", label: "erledigt" },
};

interface TopicTracking {
  topic: string;
  meetings: number[];
  status: string;
}

interface DomainDistribution {
  meeting: string;
  marketing: number;
  produkt: number;
  sales: number;
  operations: number;
}

interface Props {
  recordings: any[];
  analysis?: any;
}

export function IFDTimeline({ recordings, analysis }: Props) {
  const domainData: DomainDistribution[] = analysis?.domain_distribution || [];
  const topicTracking: TopicTracking[] = analysis?.topic_tracking || [];

  // Fallback: if no AI analysis yet, show simple recording-based data
  const fallbackData = recordings.map((r) => ({
    meeting: r.title?.slice(0, 20) || new Date(r.created_at).toLocaleDateString("de-DE"),
    marketing: 25,
    produkt: 25,
    sales: 25,
    operations: 25,
  }));

  const chartData = domainData.length > 0 ? domainData : fallbackData;

  if (!chartData.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Bereichs-Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="meeting" className="text-xs" tick={{ fontSize: 11 }} />
            <YAxis className="text-xs" tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(value: number) => `${value}%`} />
            <Legend />
            <Area type="monotone" dataKey="marketing" name="Marketing" stackId="1" fill={DOMAIN_COLORS.marketing} stroke={DOMAIN_COLORS.marketing} fillOpacity={0.7} />
            <Area type="monotone" dataKey="produkt" name="Produkt" stackId="1" fill={DOMAIN_COLORS.produkt} stroke={DOMAIN_COLORS.produkt} fillOpacity={0.7} />
            <Area type="monotone" dataKey="sales" name="Sales" stackId="1" fill={DOMAIN_COLORS.sales} stroke={DOMAIN_COLORS.sales} fillOpacity={0.7} />
            <Area type="monotone" dataKey="operations" name="Operations" stackId="1" fill={DOMAIN_COLORS.operations} stroke={DOMAIN_COLORS.operations} fillOpacity={0.7} />
          </AreaChart>
        </ResponsiveContainer>

        {topicTracking.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Themen-Verfolgung</p>
            <div className="space-y-1">
              {topicTracking.map((t, i) => {
                const style = STATUS_STYLES[t.status] || STATUS_STYLES.offen;
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Badge variant={style.variant} className="text-xs min-w-[70px] justify-center">
                      {style.label}
                    </Badge>
                    <span className="font-medium">{t.topic}</span>
                    <span className="text-muted-foreground text-xs">
                      Meeting {t.meetings.join(", ")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
