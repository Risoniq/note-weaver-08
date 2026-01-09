import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserQuota {
  max_minutes: number;
  used_minutes: number;
  remaining_minutes: number;
  percentage_used: number;
  is_exhausted: boolean;
}

export function useUserQuota() {
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuota = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Quota-Einstellungen abrufen
      const { data: quotaData } = await supabase
        .from('user_quotas')
        .select('max_minutes')
        .eq('user_id', user.id)
        .maybeSingle();

      const maxMinutes = quotaData?.max_minutes ?? 120; // Default 2h

      // Verbrauchte Minuten berechnen (aus recordings)
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
        is_exhausted: usedMinutes >= maxMinutes
      });
    } catch (error) {
      console.error('Error fetching quota:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuota();
  }, []);

  return { quota, loading, refetch: fetchQuota };
}
