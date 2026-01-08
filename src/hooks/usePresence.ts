import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export function usePresence() {
  const intervalRef = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      userIdRef.current = user.id;

      // Initial heartbeat
      await sendHeartbeat(user.id);

      // Set up interval for periodic heartbeats
      intervalRef.current = window.setInterval(() => {
        if (userIdRef.current) {
          sendHeartbeat(userIdRef.current);
        }
      }, HEARTBEAT_INTERVAL);
    };

    const sendHeartbeat = async (userId: string) => {
      try {
        const { error } = await supabase
          .from('user_presence')
          .upsert(
            {
              user_id: userId,
              last_seen: new Date().toISOString(),
              is_online: true,
            },
            {
              onConflict: 'user_id',
            }
          );

        if (error) {
          console.error('[usePresence] Heartbeat error:', error);
        }
      } catch (err) {
        console.error('[usePresence] Heartbeat failed:', err);
      }
    };

    const setOffline = async () => {
      if (!userIdRef.current) return;

      try {
        await supabase
          .from('user_presence')
          .update({ is_online: false })
          .eq('user_id', userIdRef.current);
      } catch (err) {
        console.error('[usePresence] Set offline failed:', err);
      }
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        userIdRef.current = session.user.id;
        sendHeartbeat(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        if (userIdRef.current) {
          setOffline();
          userIdRef.current = null;
        }
      }
    });

    setupPresence();

    // Handle page unload
    const handleBeforeUnload = () => {
      if (userIdRef.current) {
        // Use sendBeacon for reliable delivery during page unload
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${userIdRef.current}`;
        const headers = {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        };
        
        navigator.sendBeacon(
          url,
          new Blob([JSON.stringify({ is_online: false })], { type: 'application/json' })
        );
      }
    };

    // Handle visibility change (tab hidden/visible)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, but don't set offline immediately
        // The heartbeat will stop and the admin dashboard will detect timeout
      } else {
        // Tab is visible again, send heartbeat
        if (userIdRef.current) {
          sendHeartbeat(userIdRef.current);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      subscription.unsubscribe();
      
      // Set offline on cleanup
      if (userIdRef.current) {
        setOffline();
      }
    };
  }, []);
}
