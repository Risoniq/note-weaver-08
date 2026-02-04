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

export interface TeamleadData {
  isTeamlead: boolean;
  isLoading: boolean;
  teamId: string | null;
  teamName: string | null;
  teamMaxMinutes: number | null;
  teamMembers: TeamMember[];
}

export function useTeamleadCheck(): TeamleadData {
  const { user } = useAuth();
  const [isTeamlead, setIsTeamlead] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [teamMaxMinutes, setTeamMaxMinutes] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    const checkTeamlead = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Check if user is a team lead
        const { data: membership, error } = await supabase
          .from('team_members')
          .select('team_id, role, teams(id, name, max_minutes)')
          .eq('user_id', user.id)
          .eq('role', 'lead')
          .maybeSingle();

        if (error) {
          console.error('Error checking teamlead status:', error);
          setIsLoading(false);
          return;
        }

        if (membership && membership.teams) {
          const teamData = membership.teams as unknown as TeamInfo;
          setIsTeamlead(true);
          setTeamId(teamData.id);
          setTeamName(teamData.name);
          setTeamMaxMinutes(teamData.max_minutes);

          // Fetch team members
          const { data: members } = await supabase
            .from('team_members')
            .select('user_id, role')
            .eq('team_id', teamData.id);

          setTeamMembers(members || []);
        } else {
          setIsTeamlead(false);
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
  };
}
