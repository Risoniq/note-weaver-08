-- GIN-Index für Volltextsuche auf transcript_text
CREATE INDEX IF NOT EXISTS idx_recordings_transcript_text_gin 
ON recordings USING GIN (to_tsvector('german', COALESCE(transcript_text, '')));

-- GIN-Index für Volltextsuche auf title
CREATE INDEX IF NOT EXISTS idx_recordings_title_gin 
ON recordings USING GIN (to_tsvector('german', COALESCE(title, '')));

-- Normaler Index für Datumsfilterung (falls nicht vorhanden)
CREATE INDEX IF NOT EXISTS idx_recordings_created_at 
ON recordings (created_at DESC);