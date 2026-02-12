import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface TeamMember {
  user_id: string;
  role: string;
  email?: string;
}

interface TeamInfo {
  id: string;
  name: string;
  max_minutes: number;
}

interface LeadTeam {
  id: string;
  name: string;
  maxMinutes: number;
}

export interface TeamleadData {
  isTeamlead: boolean;
  isLoading: boolean;
  /** First lead team ID (backwards compat) */
  teamId: string | null;
  /** First lead team name (backwards compat) */
  teamName: string | null;
  teamMaxMinutes: number | null;
  teamMembers: TeamMember[];
  /** All teams where the user is lead */
  leadTeams: LeadTeam[];
}

export function useTeamleadCheck(): TeamleadData {
  const { user } = useAuth();
  const [isTeamlead, setIsTeamlead] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [teamMaxMinutes, setTeamMaxMinutes] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [leadTeams, setLeadTeams] = useState<LeadTeam[]>([]);

  useEffect(() => {
    const checkTeamlead = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Check all teams where user is lead
        const { data: memberships, error } = await supabase
          .from('team_members')
          .select('team_id, role, teams(id, name, max_minutes)')
          .eq('user_id', user.id)
          .eq('role', 'lead');

        if (error) {
          console.error('Error checking teamlead status:', error);
          setIsLoading(false);
          return;
        }

        if (memberships && memberships.length > 0) {
          const teams: LeadTeam[] = memberships.map(m => {
            const t = m.teams as unknown as TeamInfo;
            return { id: t.id, name: t.name, maxMinutes: t.max_minutes };
          });

          setIsTeamlead(true);
          setLeadTeams(teams);
          // Backwards compat: first team
          setTeamId(teams[0].id);
          setTeamName(teams[0].name);
          setTeamMaxMinutes(teams[0].maxMinutes);

          // Fetch members from all lead teams
          const teamIds = teams.map(t => t.id);
          const { data: members } = await supabase
            .from('team_members')
            .select('user_id, role')
            .in('team_id', teamIds);

          // Deduplicate
          const uniqueMembers = Array.from(
            new Map((members || []).map(m => [m.user_id, m])).values()
          );
          setTeamMembers(uniqueMembers);
        } else {
          setIsTeamlead(false);
          setLeadTeams([]);
          setTeamId(null);
          setTeamName(null);
          setTeamMaxMinutes(null);
          setTeamMembers([]);
        }
      } catch (err) {
        console.error('Teamlead check error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkTeamlead();
  }, [user]);

  return {
    isTeamlead,
    isLoading,
    teamId,
    teamName,
    teamMaxMinutes,
    teamMembers,
    leadTeams,
  };
}
