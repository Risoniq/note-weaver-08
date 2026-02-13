import { format } from "date-fns";
import { de } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { performDeepDiveAnalysis, type DeepDiveAnalysis } from "@/utils/deepDiveAnalysis";

interface VisualReportViewProps {
  recording: {
    id: string;
    title?: string | null;
    created_at: string;
    summary?: string | null;
    key_points?: string[] | null;
    action_items?: string[] | null;
    transcript_text?: string | null;
    participants?: { id: string; name: string }[] | null;
    duration?: number | null;
    word_count?: number | null;
  };
  userEmail: string | null;
  options: {
    includeSummary: boolean;
    includeKeyPoints: boolean;
    includeActionItems: boolean;
    includeTranscript: boolean;
    includeParticipants: boolean;
  };
}

export function VisualReportView({ recording, userEmail, options }: VisualReportViewProps) {
  const title = recording.title || `Meeting ${recording.id.slice(0, 8)}`;
  const date = format(new Date(recording.created_at), "dd. MMMM yyyy, HH:mm 'Uhr'", { locale: de });
  const durationMin = recording.duration ? Math.floor(recording.duration / 60) : 0;

  // Run deep dive analysis
  const analysis: DeepDiveAnalysis | null = recording.transcript_text
    ? performDeepDiveAnalysis(recording.transcript_text, userEmail)
    : null;

  const participantCount = recording.participants?.length || analysis?.speakerShares.length || 0;

  const CONTENT_COLORS = ["#3b82f6", "#94a3b8"];

  return (
    <div
      id="visual-report-container"
      style={{
        width: "794px", // A4 width at 96dpi
        padding: "48px",
        backgroundColor: "#ffffff",
        color: "#1a1a2e",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: "13px",
        lineHeight: "1.5",
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: "3px solid #3b82f6", paddingBottom: "16px", marginBottom: "24px" }}>
        <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "2px", color: "#64748b", marginBottom: "4px" }}>
          Meeting-Bericht
        </div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 4px 0", color: "#0f172a" }}>
          {title}
        </h1>
        <div style={{ fontSize: "13px", color: "#64748b" }}>{date}</div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "28px" }}>
        {[
          { label: "Teilnehmer", value: participantCount },
          { label: "Key Points", value: recording.key_points?.length || 0 },
          { label: "To-Dos", value: recording.action_items?.length || 0 },
          { label: "Dauer", value: durationMin > 0 ? `${durationMin} Min` : `${recording.word_count || 0} Wörter` },
        ].map((kpi, i) => (
          <div
            key={i}
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "12px 16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>{kpi.value}</div>
            <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      {analysis && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "28px" }}>
          {/* Speaker Shares */}
          {analysis.speakerShares.length > 0 && (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px", color: "#334155" }}>
                Sprechanteile
              </h3>
              <div style={{ height: "160px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analysis.speakerShares.map(s => ({ name: s.name, value: s.percentage }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                      labelLine={false}
                      style={{ fontSize: "10px" }}
                    >
                      {analysis.speakerShares.map((s, i) => (
                        <Cell key={i} fill={s.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                {analysis.speakerShares.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: s.color }} />
                    <span>{s.name} ({s.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Business vs Small Talk */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px", color: "#334155" }}>
              Business vs. Small Talk
            </h3>
            <div style={{ height: "160px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Business", value: analysis.contentBreakdown.business },
                      { name: "Small Talk", value: analysis.contentBreakdown.smallTalk },
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                    labelLine={false}
                    style={{ fontSize: "10px" }}
                  >
                    <Cell fill={CONTENT_COLORS[0]} />
                    <Cell fill={CONTENT_COLORS[1]} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: CONTENT_COLORS[0] }} />
                <span>Business ({analysis.contentBreakdown.business}%)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: CONTENT_COLORS[1] }} />
                <span>Small Talk ({analysis.contentBreakdown.smallTalk}%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Participants */}
      {options.includeParticipants && recording.participants && recording.participants.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", marginBottom: "8px" }}>
            Teilnehmer
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {recording.participants.map((p, i) => (
              <span key={i} style={{ background: "#f1f5f9", padding: "2px 10px", borderRadius: "12px", fontSize: "12px" }}>
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {options.includeSummary && recording.summary && (
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", marginBottom: "8px" }}>
            Zusammenfassung
          </h2>
          <p style={{ color: "#334155", whiteSpace: "pre-wrap" }}>{recording.summary}</p>
        </div>
      )}

      {/* Key Points */}
      {options.includeKeyPoints && recording.key_points && recording.key_points.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", marginBottom: "8px" }}>
            Key Points
          </h2>
          <ol style={{ margin: 0, paddingLeft: "20px" }}>
            {recording.key_points.map((point, i) => (
              <li key={i} style={{ color: "#334155", marginBottom: "4px" }}>{point}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Action Items */}
      {options.includeActionItems && recording.action_items && recording.action_items.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", marginBottom: "8px" }}>
            To-Dos / Action Items
          </h2>
          <ul style={{ margin: 0, paddingLeft: "20px", listStyleType: "none" }}>
            {recording.action_items.map((item, i) => (
              <li key={i} style={{ color: "#334155", marginBottom: "4px", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                <span style={{ color: "#94a3b8" }}>☐</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Customer Needs */}
      {analysis && analysis.customerNeeds.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", marginBottom: "8px" }}>
            Erkannte Kundenbedürfnisse
          </h2>
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            {analysis.customerNeeds.map((need, i) => (
              <li key={i} style={{ color: "#334155", marginBottom: "4px" }}>
                <strong>{need.speaker}:</strong> {need.need}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginTop: "32px", fontSize: "11px", color: "#94a3b8", textAlign: "center" }}>
        Generiert am {format(new Date(), "dd.MM.yyyy HH:mm 'Uhr'", { locale: de })}
      </div>
    </div>
  );
}
