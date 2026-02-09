import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  recordings: any[];
}

export function IFDTimeline({ recordings }: Props) {
  const data = recordings.map((r) => {
    const participants = Array.isArray(r.participants)
      ? r.participants.filter((p: any) => p && p.name && !["User-ID", "User-Email", "Recording-ID", "Erstellt"].includes(p.name)).length
      : Array.isArray(r.calendar_attendees)
        ? r.calendar_attendees.length
        : 0;

    return {
      name: r.title?.slice(0, 20) || new Date(r.created_at).toLocaleDateString("de-DE"),
      actionItems: r.action_items?.length || 0,
      keyPoints: r.key_points?.length || 0,
      participants,
      duration: r.duration ? Math.round(r.duration / 60) : 0,
      wordCount: r.word_count || 0,
    };
  });

  if (!data.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Fortschritts-Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" className="text-xs" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" className="text-xs" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="actionItems" name="Action Items" stroke="#f59e0b" strokeWidth={2} />
            <Line yAxisId="left" type="monotone" dataKey="keyPoints" name="Key Points" stroke="#8b5cf6" strokeWidth={2} />
            <Line yAxisId="left" type="monotone" dataKey="participants" name="Teilnehmer" stroke="#3b82f6" strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="duration" name="Dauer (Min)" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" />
            <Line yAxisId="right" type="monotone" dataKey="wordCount" name="Wörter" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
