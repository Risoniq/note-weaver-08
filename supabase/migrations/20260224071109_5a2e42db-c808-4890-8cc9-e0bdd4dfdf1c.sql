
-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can insert own project recordings" ON public.project_recordings;
DROP POLICY IF EXISTS "Users can view own project recordings" ON public.project_recordings;
DROP POLICY IF EXISTS "Users can delete own project recordings" ON public.project_recordings;
DROP POLICY IF EXISTS "Project members can view shared project recordings" ON public.project_recordings;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.owns_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = _project_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.owns_recording(_user_id uuid, _recording_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recordings
    WHERE id = _recording_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id AND status = 'joined'
  )
$$;

-- Recreate policies using security definer functions (no recursion)
CREATE POLICY "Users can insert own project recordings"
ON public.project_recordings
FOR INSERT
WITH CHECK (
  public.owns_project(auth.uid(), project_id)
  AND public.owns_recording(auth.uid(), recording_id)
);

CREATE POLICY "Users can view own project recordings"
ON public.project_recordings
FOR SELECT
USING (public.owns_project(auth.uid(), project_id));

CREATE POLICY "Users can delete own project recordings"
ON public.project_recordings
FOR DELETE
USING (public.owns_project(auth.uid(), project_id));

CREATE POLICY "Project members can view shared project recordings"
ON public.project_recordings
FOR SELECT
USING (public.is_project_member(auth.uid(), project_id));
