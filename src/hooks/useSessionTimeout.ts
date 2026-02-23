import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_MS = 13 * 60 * 1000; // 13 minutes (2 min before timeout)
const THROTTLE_MS = 30 * 1000; // 30s throttle for events

export const useSessionTimeout = ({ paused = false }: { paused?: boolean } = {}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120);
  const navigate = useNavigate();
  
  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval>>(null);
  const throttleRef = useRef(0);

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

  const resetTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    lastActivityRef.current = Date.now();

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
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    if (paused) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    resetTimers();

    const handleActivity = () => {
      const now = Date.now();
      if (now - throttleRef.current < THROTTLE_MS) return;
      throttleRef.current = now;
      
      // Only reset if warning is not showing
      if (!showWarning) {
        resetTimers();
      }
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));

    return () => {
      clearAllTimers();
      events.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [resetTimers, clearAllTimers, showWarning, paused]);

  return { showWarning, remainingSeconds, extendSession };
};
