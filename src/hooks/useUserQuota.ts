import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";

export interface QuotaDetail {
  max_minutes: number;
  used_minutes: number;
  remaining_minutes: number;
  percentage_used: number;
  is_exhausted: boolean;
}

export interface TeamQuotaDetail extends QuotaDetail {
  team_name: string;
}

export interface UserQuota {
  personal: QuotaDetail;
  team?: TeamQuotaDetail;
  is_exhausted: boolean; // true if personal OR team is exhausted
}

function buildDetail(used: number, max: number): QuotaDetail {
  const usedMinutes = Math.round(used / 60);
  return {
    max_minutes: max,
    used_minutes: usedMinutes,
    remaining_minutes: Math.max(0, max - usedMinutes),
    percentage_used: Math.min(100, (usedMinutes / max) * 100),
    is_exhausted: usedMinutes >= max,
  };
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

      // If admin is impersonating, use edge function
      if (isAdmin && isImpersonating && impersonatedUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        const { data, error } = await supabase.functions.invoke('admin-view-user-data', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { target_user_id: impersonatedUserId, data_type: 'quota' },
        });

        if (error) {
          console.error('Error fetching impersonated quota:', error);
        } else if (data?.quota) {
          setQuota(data.quota);
        }
        setLoading(false);
        return;
      }

      // --- Always load personal quota ---
      const { data: quotaData } = await supabase
        .from('user_quotas')
        .select('max_minutes')
        .eq('user_id', user.id)
        .maybeSingle();

      const personalMax = quotaData?.max_minutes ?? 120;

      const { data: ownRecordings } = await supabase
        .from('recordings')
        .select('duration')
        .eq('user_id', user.id)
        .eq('status', 'done');

      const ownUsedSeconds = ownRecordings?.reduce((sum, r) => sum + (r.duration || 0), 0) || 0;
      const personal = buildDetail(ownUsedSeconds, personalMax);

      // --- Check team membership ---
      const { data: teamMembership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .maybeSingle();

      let teamDetail: TeamQuotaDetail | undefined;

      if (teamMembership?.team_id) {
        const { data: teamData } = await supabase
          .from('teams')
          .select('name, max_minutes')
          .eq('id', teamMembership.team_id)
          .single();

        const teamMax = teamData?.max_minutes ?? 600;
        const teamName = teamData?.name ?? 'Team';

        const { data: teamMembers } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', teamMembership.team_id);

        const memberIds = teamMembers?.map(m => m.user_id) || [];

        const { data: teamRecordings } = await supabase
          .from('recordings')
          .select('duration')
          .in('user_id', memberIds)
          .eq('status', 'done');

        const teamUsedSeconds = teamRecordings?.reduce((sum, r) => sum + (r.duration || 0), 0) || 0;
        const detail = buildDetail(teamUsedSeconds, teamMax);
        teamDetail = { ...detail, team_name: teamName };
      }

      setQuota({
        personal,
        team: teamDetail,
        is_exhausted: personal.is_exhausted || (teamDetail?.is_exhausted ?? false),
      });
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
