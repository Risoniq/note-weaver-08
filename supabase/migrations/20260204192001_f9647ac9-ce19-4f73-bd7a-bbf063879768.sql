-- Teams Tabelle
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  max_minutes integer NOT NULL DEFAULT 600,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Team Mitglieder
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Index für Performance bei Quota-Berechnung
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);

-- RLS aktivieren
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Admin Policies für Teams
CREATE POLICY "Admins can manage teams"
ON public.teams FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Admin Policies für Team Members
CREATE POLICY "Admins can manage team members"
ON public.team_members FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- User kann eigene Team-Zugehörigkeit lesen
CREATE POLICY "Users can view own team membership"
ON public.team_members FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- User kann eigenes Team lesen (über membership)
CREATE POLICY "Team members can view their team"
ON public.teams FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE team_members.team_id = teams.id 
    AND team_members.user_id = auth.uid()
  )
);

-- Trigger für updated_at
CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();