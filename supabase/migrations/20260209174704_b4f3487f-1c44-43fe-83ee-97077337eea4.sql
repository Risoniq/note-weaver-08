
-- Projects table
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#6366f1',
  status text NOT NULL DEFAULT 'active',
  analysis jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Project-Recordings join table
CREATE TABLE public.project_recordings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  recording_id uuid NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, recording_id)
);

ALTER TABLE public.project_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project recordings" ON public.project_recordings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_recordings.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own project recordings" ON public.project_recordings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_recordings.project_id AND projects.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.recordings WHERE recordings.id = project_recordings.recording_id AND recordings.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own project recordings" ON public.project_recordings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_recordings.project_id AND projects.user_id = auth.uid())
  );
