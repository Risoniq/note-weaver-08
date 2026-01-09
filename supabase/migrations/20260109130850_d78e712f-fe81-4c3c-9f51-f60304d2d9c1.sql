-- Tabelle für Benutzer-Kontingente
CREATE TABLE public.user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  max_minutes INTEGER NOT NULL DEFAULT 120,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS aktivieren
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;

-- Benutzer können eigenes Quota lesen
CREATE POLICY "Users can view own quota"
ON public.user_quotas FOR SELECT
USING (auth.uid() = user_id);

-- Admins können alle Quotas verwalten
CREATE POLICY "Admins can view all quotas"
ON public.user_quotas FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert quotas"
ON public.user_quotas FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update quotas"
ON public.user_quotas FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete quotas"
ON public.user_quotas FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger für updated_at
CREATE TRIGGER update_user_quotas_updated_at
BEFORE UPDATE ON public.user_quotas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();