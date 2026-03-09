import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePresence } from '@/hooks/usePresence';
import { useApprovalCheck } from '@/hooks/useApprovalCheck';
import { Loader2 } from 'lucide-react';
import PendingApproval from '@/pages/PendingApproval';

const LOADING_TIMEOUT_MS = 12000; // 12s max loading before redirect

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isApproved, loading: approvalLoading } = useApprovalCheck();
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);
  
  // Track user presence when authenticated
  usePresence();

  const loading = authLoading || approvalLoading;

  // Timeout: if loading takes too long, redirect to auth
  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), LOADING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  if (timedOut) {
    return <Navigate to="/auth" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Laden...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Show pending approval page if not approved
  if (!isApproved) {
    return <PendingApproval />;
  }

  return <>{children}</>;
};
