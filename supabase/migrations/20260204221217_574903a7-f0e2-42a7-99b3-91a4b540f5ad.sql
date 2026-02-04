-- RLS Policy: Teamleads können Recordings ihrer Team-Mitglieder sehen
CREATE POLICY "Teamleads can view team recordings"
ON public.recordings FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members AS my_membership
    JOIN public.team_members AS target_membership 
      ON my_membership.team_id = target_membership.team_id
    WHERE my_membership.user_id = auth.uid()
      AND my_membership.role = 'lead'
      AND target_membership.user_id = recordings.user_id
  )
);

-- Index für bessere Performance bei Rollenabfragen
CREATE INDEX IF NOT EXISTS idx_team_members_role ON public.team_members(role);