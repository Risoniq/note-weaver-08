import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";

export interface UserQuota {
  max_minutes: number;
  used_minutes: number;
  remaining_minutes: number;
  percentage_used: number;
  is_exhausted: boolean;
  is_team_quota: boolean;
  team_name?: string;
}

export function useUserQuota() {
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const { isImpersonating, impersonatedUserId } = useImpersonation();
  const { isAdmin } = useAdminCheck();

  const fetchQuota = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // If admin is impersonating, use edge function to fetch target user's quota
      if (isAdmin && isImpersonating && impersonatedUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('admin-view-user-data', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: { 
            target_user_id: impersonatedUserId, 
            data_type: 'quota' 
          },
        });

        if (error) {
          console.error('Error fetching impersonated quota:', error);
        } else if (data?.quota) {
          setQuota(data.quota);
        }
        setLoading(false);
        return;
      }

      // Normal flow for current user
      // 1. Check if user is in a team
      const { data: teamMembership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (teamMembership?.team_id) {
        // User is in a team - use team quota
        const { data: teamData } = await supabase
          .from('teams')
          .select('name, max_minutes')
          .eq('id', teamMembership.team_id)
          .single();

        const teamMaxMinutes = teamData?.max_minutes ?? 600; // Default 10h
        const teamName = teamData?.name ?? 'Team';

        // Get all team members
        const { data: teamMembers } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', teamMembership.team_id);

        const memberIds = teamMembers?.map(m => m.user_id) || [];

        // Sum recordings of all team members
        const { data: teamRecordings } = await supabase
          .from('recordings')
          .select('duration')
          .in('user_id', memberIds)
          .eq('status', 'done');

        const usedSeconds = teamRecordings?.reduce((sum, r) => sum + (r.duration || 0), 0) || 0;
        const usedMinutes = Math.round(usedSeconds / 60);

        setQuota({
          max_minutes: teamMaxMinutes,
          used_minutes: usedMinutes,
          remaining_minutes: Math.max(0, teamMaxMinutes - usedMinutes),
          percentage_used: Math.min(100, (usedMinutes / teamMaxMinutes) * 100),
          is_exhausted: usedMinutes >= teamMaxMinutes,
          is_team_quota: true,
          team_name: teamName,
        });
      } else {
        // Individual quota (as before)
        const { data: quotaData } = await supabase
          .from('user_quotas')
          .select('max_minutes')
          .eq('user_id', user.id)
          .maybeSingle();

        const maxMinutes = quotaData?.max_minutes ?? 120; // Default 2h

        const { data: recordings } = await supabase
          .from('recordings')
          .select('duration')
          .eq('user_id', user.id)
          .eq('status', 'done');

        const usedSeconds = recordings?.reduce((sum, r) => sum + (r.duration || 0), 0) || 0;
        const usedMinutes = Math.round(usedSeconds / 60);

        setQuota({
          max_minutes: maxMinutes,
          used_minutes: usedMinutes,
          remaining_minutes: Math.max(0, maxMinutes - usedMinutes),
          percentage_used: Math.min(100, (usedMinutes / maxMinutes) * 100),
          is_exhausted: usedMinutes >= maxMinutes,
          is_team_quota: false,
        });
      }
    } catch (error) {
      console.error('Error fetching quota:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isImpersonating, impersonatedUserId]);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  return { quota, loading, refetch: fetchQuota };
}
