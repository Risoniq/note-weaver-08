import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_MS = 13 * 60 * 1000; // 13 minutes (2 min before timeout)

export const useSessionTimeout = ({ paused = false }: { paused?: boolean } = {}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120);
  const navigate = useNavigate();

  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval>>(null);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const performLogout = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  }, [clearAllTimers, navigate]);

  const startTimers = useCallback(() => {
    clearAllTimers();

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingSeconds(120);

      countdownRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            performLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, WARNING_MS);

    logoutTimerRef.current = setTimeout(() => {
      performLogout();
    }, TIMEOUT_MS);
  }, [clearAllTimers, performLogout]);

  const extendSession = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
  }, [clearAllTimers]);

  useEffect(() => {
    if (paused) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab went to background — start timers
        startTimers();
      } else {
        // Tab came back — reset everything
        clearAllTimers();
        setShowWarning(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // If tab is already hidden on mount, start timers
    if (document.hidden) {
      startTimers();
    }

    return () => {
      clearAllTimers();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startTimers, clearAllTimers, paused]);

  return { showWarning, remainingSeconds, extendSession };
};
