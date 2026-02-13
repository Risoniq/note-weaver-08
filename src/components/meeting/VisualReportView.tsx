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

// Risoniq report color palette
const C = {
  bg: "#0f1724",
  bgCard: "#1a2332",
  primary: "#0ea5e9",
  accent: "#e87722",
  text: "#e2e8f0",
  muted: "#94a3b8",
  border: "#2d3748",
} as const;

const CONTENT_COLORS = [C.primary, C.muted];

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_PADDING = 48;

function RisoniqLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M4 20C8 14 12 22 16 16C20 10 24 18 28 12" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M4 16C8 10 12 18 16 12C20 6 24 14 28 8" stroke={C.accent} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <path d="M4 24C8 18 12 26 16 20C20 14 24 22 28 16" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      </svg>
      <span style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: "16px", fontWeight: 700, letterSpacing: "3px", color: C.accent }}>
        RISONIQ
      </span>
    </div>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h2
      style={{
        fontSize: "12px",
        fontWeight: 600,
        color: C.primary,
        textTransform: "uppercase",
        letterSpacing: "2px",
        borderBottom: `1px solid ${C.border}`,
        paddingBottom: "6px",
        marginBottom: "10px",
        textShadow: "0 0 8px rgba(14,165,233,0.3)",
      }}
    >
      {children}
    </h2>
  );
}

function PageContainer({ children, isLast }: { children: React.ReactNode; isLast?: boolean }) {
  return (
    <div
      data-page="true"
      style={{
        width: `${PAGE_WIDTH}px`,
        height: `${PAGE_HEIGHT}px`,
        padding: `${PAGE_PADDING}px`,
        backgroundColor: C.bg,
        color: C.text,
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: "13px",
        lineHeight: "1.5",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1 }}>{children}</div>
      {isLast && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "12px", fontSize: "11px", color: C.muted, display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
          <span>Powered by</span>
          <span style={{ color: C.accent, fontWeight: 700, letterSpacing: "2px" }}>RISONIQ</span>
          <span>|</span>
          <span>Generiert am {format(new Date(), "dd.MM.yyyy HH:mm 'Uhr'", { locale: de })}</span>
        </div>
      )}
    </div>
  );
}

export function VisualReportView({ recording, userEmail, options }: VisualReportViewProps) {
  const title = recording.title || `Meeting ${recording.id.slice(0, 8)}`;
  const date = format(new Date(recording.created_at), "dd. MMMM yyyy, HH:mm 'Uhr'", { locale: de });
  const durationMin = recording.duration ? Math.floor(recording.duration / 60) : 0;

  const analysis: DeepDiveAnalysis | null = recording.transcript_text
    ? performDeepDiveAnalysis(recording.transcript_text, userEmail)
    : null;

  const participantCount = recording.participants?.length || analysis?.speakerShares.length || 0;

  // Determine which sections go on page 2 and page 3
  const hasParticipants = options.includeParticipants && recording.participants && recording.participants.length > 0;
  const hasSummary = options.includeSummary && recording.summary;
  const hasKeyPoints = options.includeKeyPoints && recording.key_points && recording.key_points.length > 0;
  const hasActionItems = options.includeActionItems && recording.action_items && recording.action_items.length > 0;
  const hasCustomerNeeds = analysis && analysis.customerNeeds.length > 0;

  const hasPage2Content = hasParticipants || hasSummary || hasKeyPoints;
  const hasPage3Content = hasActionItems || hasCustomerNeeds;

  // If no page 2/3 content, page 1 is last
  const totalPages = hasPage3Content ? 3 : hasPage2Content ? 2 : 1;

  return (
    <div id="visual-report-container">
      {/* === PAGE 1: Header + KPIs + Charts === */}
      <PageContainer isLast={totalPages === 1}>
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
            <RisoniqLogo />
            <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "2px", color: C.muted }}>
              Meeting-Bericht
            </div>
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 4px 0", color: C.text }}>
            {title}
          </h1>
          <div style={{ fontSize: "13px", color: C.muted }}>{date}</div>
          <div style={{ height: "3px", background: `linear-gradient(90deg, ${C.primary}, transparent)`, marginTop: "12px", borderRadius: "2px" }} />
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
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: "8px",
                padding: "14px 16px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 300,
                  fontFamily: "'Courier New', monospace",
                  color: C.primary,
                  textShadow: "0 0 8px rgba(14,165,233,0.4)",
                }}
              >
                {kpi.value}
              </div>
              <div style={{ fontSize: "10px", color: C.muted, textTransform: "uppercase", letterSpacing: "0.15em" }}>
                {kpi.label}
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        {analysis && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            {/* Speaker Shares - Donut */}
            {analysis.speakerShares.length > 0 && (
              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "16px" }}>
                <h3 style={{ fontSize: "12px", fontWeight: 600, marginBottom: "12px", color: C.primary, textTransform: "uppercase", letterSpacing: "1.5px" }}>
                  Sprechanteile
                </h3>
                <div style={{ height: "160px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analysis.speakerShares.map(s => ({ name: s.name, value: s.percentage }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={70}
                        dataKey="value"
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
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: C.muted }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: s.color }} />
                      <span>{s.name} ({s.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Business vs Small Talk - Donut */}
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: "8px", padding: "16px" }}>
              <h3 style={{ fontSize: "12px", fontWeight: 600, marginBottom: "12px", color: C.primary, textTransform: "uppercase", letterSpacing: "1.5px" }}>
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
                      innerRadius={35}
                      outerRadius={70}
                      dataKey="value"
                    >
                      <Cell fill={CONTENT_COLORS[0]} />
                      <Cell fill={CONTENT_COLORS[1]} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: C.muted }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: CONTENT_COLORS[0] }} />
                  <span>Business ({analysis.contentBreakdown.business}%)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: C.muted }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: CONTENT_COLORS[1] }} />
                  <span>Small Talk ({analysis.contentBreakdown.smallTalk}%)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageContainer>

      {/* === PAGE 2: Participants + Summary + Key Points === */}
      {hasPage2Content && (
        <PageContainer isLast={totalPages === 2}>
          {hasParticipants && (
            <div style={{ marginBottom: "20px" }}>
              <SectionHeading>Teilnehmer</SectionHeading>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {recording.participants!.map((p, i) => (
                  <span key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, padding: "2px 10px", borderRadius: "12px", fontSize: "12px", color: C.text }}>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {hasSummary && (
            <div style={{ marginBottom: "20px" }}>
              <SectionHeading>Zusammenfassung</SectionHeading>
              <p style={{ color: C.text, whiteSpace: "pre-wrap", margin: 0 }}>{recording.summary}</p>
            </div>
          )}

          {hasKeyPoints && (
            <div style={{ marginBottom: "20px" }}>
              <SectionHeading>Key Points</SectionHeading>
              <ol style={{ margin: 0, paddingLeft: "20px" }}>
                {recording.key_points!.map((point, i) => (
                  <li key={i} style={{ color: C.text, marginBottom: "4px" }}>{point}</li>
                ))}
              </ol>
            </div>
          )}
        </PageContainer>
      )}

      {/* === PAGE 3: Action Items + Customer Needs + Footer === */}
      {hasPage3Content && (
        <PageContainer isLast>
          {hasActionItems && (
            <div style={{ marginBottom: "20px" }}>
              <SectionHeading>To-Dos / Action Items</SectionHeading>
              <ul style={{ margin: 0, paddingLeft: "20px", listStyleType: "none" }}>
                {recording.action_items!.map((item, i) => (
                  <li key={i} style={{ color: C.text, marginBottom: "4px", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                    <span style={{ color: C.primary }}>☐</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasCustomerNeeds && (
            <div style={{ marginBottom: "20px" }}>
              <SectionHeading>Erkannte Kundenbedürfnisse</SectionHeading>
              <ul style={{ margin: 0, paddingLeft: "20px" }}>
                {analysis!.customerNeeds.map((need, i) => (
                  <li key={i} style={{ color: C.text, marginBottom: "4px" }}>
                    <strong style={{ color: C.primary }}>{need.speaker}:</strong> {need.need}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </PageContainer>
      )}
    </div>
  );
}
