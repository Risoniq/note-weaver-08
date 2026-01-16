import { supabase } from '@/integrations/supabase/client';

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Wraps a Supabase request with automatic token refresh on 401 errors.
 * If a 401 is received, it attempts to refresh the session and retry the request.
 */
export async function withTokenRefresh<T>(
  request: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 1, retryDelay = 500 } = options;
  
  const result = await request();
  
  // Check if result contains a 401 error (Supabase functions return error in data)
  const resultAny = result as any;
  const hasError = resultAny?.error || 
    (resultAny?.data && typeof resultAny.data === 'object' && resultAny.data.error);
  
  if (hasError) {
    const errorMsg = resultAny?.error?.message || 
      resultAny?.data?.error || 
      JSON.stringify(resultAny?.error) || '';
    
    const is401 = errorMsg.includes('401') || 
      errorMsg.includes('Unauthorized') ||
      errorMsg.includes('unauthorized');
    
    if (is401 && maxRetries > 0) {
      console.log('[withTokenRefresh] 401 detected, refreshing session...');
      
      // Force token refresh
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !data.session) {
        console.error('[withTokenRefresh] Session refresh failed:', refreshError);
        return result; // Return original result with error
      }
      
      console.log('[withTokenRefresh] Session refreshed successfully, retrying request...');
      
      // Wait briefly before retry to ensure token propagation
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Retry the request with refreshed token
      return await request();
    }
  }
  
  return result;
}
