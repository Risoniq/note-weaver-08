
-- Create user_branding table
CREATE TABLE public.user_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  logo_url TEXT,
  app_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_branding ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own branding"
  ON public.user_branding FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own branding"
  ON public.user_branding FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own branding"
  ON public.user_branding FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own branding"
  ON public.user_branding FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all branding"
  ON public.user_branding FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_user_branding_updated_at
  BEFORE UPDATE ON public.user_branding
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create user-logos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('user-logos', 'user-logos', true);

-- Storage RLS policies
CREATE POLICY "Anyone can view user logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-logos');

CREATE POLICY "Users can upload own logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'user-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'user-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'user-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
