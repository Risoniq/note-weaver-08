
-- Audit Log table for comprehensive event tracking
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- 'auth.login', 'auth.logout', 'recording.create', 'recording.update', 'recording.delete', 'sharing.share', 'sharing.unshare', 'admin.approve_user', 'admin.delete_user', 'admin.set_quota', 'admin.create_team', 'admin.update_team', 'admin.delete_team', 'admin.assign_member', 'backup.integrity_check'
  actor_id uuid, -- user who performed the action
  target_id text, -- affected resource id
  target_type text, -- 'recording', 'user', 'team', 'project', 'backup'
  details jsonb DEFAULT '{}',
  ip_address text,
  severity text NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_event_type ON public.audit_logs (event_type);
CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs (actor_id);
CREATE INDEX idx_audit_logs_severity ON public.audit_logs (severity);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role inserts (from edge functions / triggers)
-- No INSERT policy for regular users - only service role can insert

-- Backup integrity results table
CREATE TABLE public.backup_integrity_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  total_recordings integer NOT NULL DEFAULT 0,
  backups_found integer NOT NULL DEFAULT 0,
  backups_missing integer NOT NULL DEFAULT 0,
  backups_corrupted integer NOT NULL DEFAULT 0,
  details jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'passed', 'warning', 'failed'
  run_by uuid
);

ALTER TABLE public.backup_integrity_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view backup checks"
  ON public.backup_integrity_checks FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Incident alerts table
CREATE TABLE public.incident_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL, -- 'failed_logins', 'mass_deletion', 'unauthorized_access', 'backup_failure'
  severity text NOT NULL DEFAULT 'warning', -- 'warning', 'critical'
  message text NOT NULL,
  details jsonb DEFAULT '{}',
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_incident_alerts_created_at ON public.incident_alerts (created_at DESC);
CREATE INDEX idx_incident_alerts_acknowledged ON public.incident_alerts (acknowledged);

ALTER TABLE public.incident_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view alerts"
  ON public.incident_alerts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update alerts"
  ON public.incident_alerts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger function to auto-log recording changes
CREATE OR REPLACE FUNCTION public.audit_recording_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (event_type, actor_id, target_id, target_type, details, severity)
    VALUES ('recording.create', NEW.user_id, NEW.id::text, 'recording',
      jsonb_build_object('title', NEW.title, 'source', NEW.source), 'info');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check for soft delete
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      INSERT INTO public.audit_logs (event_type, actor_id, target_id, target_type, details, severity)
      VALUES ('recording.delete', NEW.user_id, NEW.id::text, 'recording',
        jsonb_build_object('title', NEW.title), 'warning');
    ELSE
      INSERT INTO public.audit_logs (event_type, actor_id, target_id, target_type, details, severity)
      VALUES ('recording.update', NEW.user_id, NEW.id::text, 'recording',
        jsonb_build_object('title', NEW.title, 'changes', 
          CASE WHEN OLD.title != NEW.title THEN jsonb_build_object('title', jsonb_build_object('old', OLD.title, 'new', NEW.title)) ELSE '{}'::jsonb END
        ), 'info');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (event_type, actor_id, target_id, target_type, details, severity)
    VALUES ('recording.delete', OLD.user_id, OLD.id::text, 'recording',
      jsonb_build_object('title', OLD.title), 'warning');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_recordings_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.recordings
  FOR EACH ROW EXECUTE FUNCTION public.audit_recording_changes();

-- Trigger for sharing events
CREATE OR REPLACE FUNCTION public.audit_sharing_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (event_type, actor_id, target_id, target_type, details, severity)
    VALUES ('sharing.share', NEW.shared_by, NEW.recording_id::text, 'recording',
      jsonb_build_object('shared_with', NEW.shared_with), 'info');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (event_type, actor_id, target_id, target_type, details, severity)
    VALUES ('sharing.unshare', OLD.shared_by, OLD.recording_id::text, 'recording',
      jsonb_build_object('unshared_from', OLD.shared_with), 'info');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_sharing_trigger
  AFTER INSERT OR DELETE ON public.shared_recordings
  FOR EACH ROW EXECUTE FUNCTION public.audit_sharing_changes();
