import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from "react";
import { isBot, isMetadataField, normalizeGermanName, stripMetadataHeader } from "@/utils/participantUtils";

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

const SOLUTION_PHRASES = [
  "wir könnten", "mein vorschlag", "ich schlage vor", "eine idee wäre",
  "wie wäre es wenn", "man könnte", "alternativ", "meine empfehlung",
  "we could", "i suggest", "my proposal", "how about", "one option",
  "wir sollten", "ich empfehle", "vielleicht könnten wir",
];

const REACTION_PHRASES = [
  "genau", "darauf aufbauend", "stimme zu", "ergänzend dazu",
  "guter punkt", "da bin ich", "bezüglich", "wie gesagt",
  "agreed", "building on", "good point", "regarding",
  "das stimmt", "richtig", "absolut", "auf jeden fall",
];

const SPEAKER_COLORS = [
  "hsl(210, 70%, 50%)", "hsl(340, 70%, 50%)", "hsl(120, 60%, 40%)",
  "hsl(30, 80%, 50%)", "hsl(270, 60%, 50%)", "hsl(180, 60%, 40%)",
];

interface SpeakerStats {
  topicInitiations: number;
  solutions: number;
  questions: number;
  reactions: number;
  totalWords: number;
  utterances: number;
}

function parseTranscriptLines(text: string): { speaker: string; content: string }[] {
  const cleaned = stripMetadataHeader(text);
  const lines: { speaker: string; content: string }[] = [];
  const regex = /^([^:\n]{1,60}):\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    const speaker = match[1].trim();
    if (!isBot(speaker) && !isMetadataField(speaker)) {
      lines.push({ speaker: normalizeGermanName(speaker), content: match[2].trim() });
    }
  }
  return lines;
}

function computeScores(recordings: any[]) {
  const stats: Record<string, SpeakerStats> = {};
  const ensure = (name: string) => {
    if (!stats[name]) stats[name] = { topicInitiations: 0, solutions: 0, questions: 0, reactions: 0, totalWords: 0, utterances: 0 };
  };

  for (const rec of recordings) {
    if (!rec.transcript_text) continue;
    const lines = parseTranscriptLines(rec.transcript_text);
    let prevSpeaker = "";
    for (let i = 0; i < lines.length; i++) {
      const { speaker, content } = lines[i];
      ensure(speaker);
      const s = stats[speaker];
      const lower = content.toLowerCase();
      const words = content.split(/\s+/).filter(Boolean);
      s.totalWords += words.length;
      s.utterances += 1;
      if (speaker !== prevSpeaker && i > 0 && lines[i - 1].speaker !== speaker) {
        if (!REACTION_PHRASES.some(p => lower.startsWith(p))) s.topicInitiations += 1;
      }
      if (i === 0) s.topicInitiations += 1;
      for (const phrase of SOLUTION_PHRASES) { if (lower.includes(phrase)) { s.solutions += 1; break; } }
      if (content.includes("?")) s.questions += (content.match(/\?/g) || []).length;
      for (const phrase of REACTION_PHRASES) { if (lower.includes(phrase)) { s.reactions += 1; break; } }
      prevSpeaker = speaker;
    }
  }
  return stats;
}

function normalize(stats: Record<string, SpeakerStats>) {
  const speakers = Object.keys(stats);
  if (!speakers.length) return null;
  const maxVals = {
    topicInitiations: Math.max(...speakers.map(s => stats[s].topicInitiations), 1),
    solutions: Math.max(...speakers.map(s => stats[s].solutions), 1),
    questions: Math.max(...speakers.map(s => stats[s].questions), 1),
    reactions: Math.max(...speakers.map(s => stats[s].reactions), 1),
    depth: Math.max(...speakers.map(s => stats[s].utterances > 0 ? stats[s].totalWords / stats[s].utterances : 0), 1),
  };
  const sorted = speakers
    .map(name => ({ name, total: stats[name].topicInitiations + stats[name].solutions + stats[name].questions + stats[name].reactions + stats[name].utterances }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const dimensions = [
    { key: "initiation", label: "Themen-Initiation" },
    { key: "solutions", label: "Lösungsvorschläge" },
    { key: "questions", label: "Fragen" },
    { key: "reactions", label: "Reaktionsdichte" },
    { key: "depth", label: "Inhaltliche Tiefe" },
  ];

  const data = dimensions.map(dim => {
    const point: any = { dimension: dim.label };
    for (const { name } of sorted) {
      const s = stats[name];
      const avgDepth = s.utterances > 0 ? s.totalWords / s.utterances : 0;
      const raw: Record<string, number> = { initiation: s.topicInitiations, solutions: s.solutions, questions: s.questions, reactions: s.reactions, depth: avgDepth };
      const maxKey = dim.key as keyof typeof maxVals;
      point[name] = Math.round((raw[dim.key] / maxVals[maxKey]) * 100);
    }
    return point;
  });
  return { data, speakers: sorted.map(s => s.name) };
}

export function IFDProactivityRadar({ recordings, analysis }: Props) {
  const result = useMemo(() => {
    const stats = computeScores(recordings);
    return normalize(stats);
  }, [recordings]);

  const speakerDomainActivity: any[] = analysis?.speaker_domain_activity || [];

  if (!result || !result.speakers?.length) return null;
  const { data, speakers } = result;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Proaktivitäts-Netzdiagramm</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
            {speakers.map((name, i) => (
              <Radar key={name} name={name} dataKey={name} stroke={SPEAKER_COLORS[i % SPEAKER_COLORS.length]} fill={SPEAKER_COLORS[i % SPEAKER_COLORS.length]} fillOpacity={0.15} />
            ))}
            <Legend />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>

        {speakerDomainActivity.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Bereichs-Aktivität pro Sprecher</p>
            {speakerDomainActivity.map((s: any, i: number) => {
              const total = (s.marketing || 0) + (s.produkt || 0) + (s.sales || 0) + (s.operations || 0);
              if (total === 0) return null;
              return (
                <div key={i} className="space-y-1">
                  <p className="text-xs font-medium">{s.speaker}</p>
                  <div className="flex h-3 rounded-full overflow-hidden">
                    {(["marketing", "produkt", "sales", "operations"] as const).map((domain) => {
                      const pct = total > 0 ? ((s[domain] || 0) / total) * 100 : 0;
                      if (pct === 0) return null;
                      return (
                        <div
                          key={domain}
                          className="h-full"
                          style={{ width: `${pct}%`, backgroundColor: DOMAIN_COLORS[domain] }}
                          title={`${DOMAIN_LABELS[domain]}: ${Math.round(pct)}%`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="flex gap-3 text-xs text-muted-foreground">
              {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DOMAIN_COLORS[key] }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
