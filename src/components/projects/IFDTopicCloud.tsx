import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";

const DOMAIN_COLORS: Record<string, string> = {
  marketing: "#3b82f6",
  produkt: "#8b5cf6",
  sales: "#f59e0b",
  operations: "#22c55e",
};

const DOMAIN_LABELS: Record<string, string> = {
  marketing: "Marketing",
  produkt: "Produkt",
  sales: "Sales",
  operations: "Operations",
};

interface Props {
  recordings: any[];
  analysis?: any;
}

export function IFDTopicCloud({ recordings, analysis }: Props) {
  const domainDist: any[] = analysis?.domain_distribution || [];
  const topicTracking: any[] = analysis?.topic_tracking || [];

  if (!domainDist.length && !topicTracking.length) return null;

  // Aggregate domain percentages across all meetings
  const totals = { marketing: 0, produkt: 0, sales: 0, operations: 0 };
  domainDist.forEach((d) => {
    totals.marketing += d.marketing || 0;
    totals.produkt += d.produkt || 0;
    totals.sales += d.sales || 0;
    totals.operations += d.operations || 0;
  });
  const sum = totals.marketing + totals.produkt + totals.sales + totals.operations;

  const pieData = sum > 0
    ? Object.entries(totals).map(([key, val]) => ({
        name: DOMAIN_LABELS[key],
        value: Math.round((val / sum) * 100),
        key,
      }))
    : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Bereichs-Verteilung</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pieData.length > 0 && (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${name} ${value}%`}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.key} fill={DOMAIN_COLORS[entry.key]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value}%`} />
            </PieChart>
          </ResponsiveContainer>
        )}

        {topicTracking.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Themen nach Status</p>
            <div className="flex flex-wrap gap-2">
              {topicTracking.map((t: any, i: number) => (
                <Badge
                  key={i}
                  variant={t.status === "erledigt" ? "outline" : t.status === "verfolgt" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {t.topic} ({t.status})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
