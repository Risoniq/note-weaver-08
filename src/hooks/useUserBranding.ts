import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserBranding {
  logo_url: string | null;
  app_name: string | null;
}

export const useUserBranding = () => {
  const [branding, setBranding] = useState<UserBranding | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBranding = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('user_branding')
        .select('logo_url, app_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setBranding(data);
      }
    } catch (err) {
      console.error('Error loading branding:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const updateBranding = useCallback(async (logoUrl: string | null, appName: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_branding')
      .upsert(
        { user_id: user.id, logo_url: logoUrl, app_name: appName },
        { onConflict: 'user_id' }
      );

    if (error) throw error;

    setBranding({ logo_url: logoUrl, app_name: appName });
  }, []);

  return { branding, loading, updateBranding, refetch: fetchBranding };
};
