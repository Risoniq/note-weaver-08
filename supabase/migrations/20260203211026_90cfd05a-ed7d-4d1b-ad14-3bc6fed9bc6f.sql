-- =====================================================
-- A) Funktion: Wendet Meeting-Titel als Header in transcript_text an
-- =====================================================
CREATE OR REPLACE FUNCTION public.apply_meeting_title_header()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  title_header TEXT;
  cleaned_transcript TEXT;
  meeting_info_match TEXT;
BEGIN
  -- Wenn transcript_text null/leer ist, nichts tun
  IF NEW.transcript_text IS NULL OR NEW.transcript_text = '' THEN
    RETURN NEW;
  END IF;

  -- Wenn title null/leer ist, entferne ggf. vorhandenen [Meeting: ...] Header
  IF NEW.title IS NULL OR NEW.title = '' THEN
    -- Entferne bestehenden Meeting-Header (falls vorhanden)
    NEW.transcript_text := regexp_replace(
      NEW.transcript_text, 
      '^\[Meeting:[^\]]*\]\n---\n', 
      '', 
      'i'
    );
    RETURN NEW;
  END IF;

  -- Neuer Header
  title_header := '[Meeting: ' || NEW.title || ']' || E'\n---\n';

  -- Prüfe ob bereits ein [Meeting: ...] Header existiert
  IF NEW.transcript_text ~ '^\[Meeting:[^\]]*\]\n---\n' THEN
    -- Ersetze bestehenden Header
    NEW.transcript_text := regexp_replace(
      NEW.transcript_text,
      '^\[Meeting:[^\]]*\]\n---\n',
      title_header,
      'i'
    );
  ELSE
    -- Füge neuen Header am Anfang ein (vor eventuellen [Meeting-Info] Blöcken)
    NEW.transcript_text := title_header || NEW.transcript_text;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- B) Trigger auf recordings
-- =====================================================
DROP TRIGGER IF EXISTS trigger_apply_meeting_title_header ON public.recordings;

CREATE TRIGGER trigger_apply_meeting_title_header
  BEFORE INSERT OR UPDATE OF title, transcript_text
  ON public.recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_meeting_title_header();

-- =====================================================
-- C) Realtime aktivieren für recordings
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.recordings;