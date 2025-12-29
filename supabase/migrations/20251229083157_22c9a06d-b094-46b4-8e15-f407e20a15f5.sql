-- Drop existing insecure RLS policies
DROP POLICY IF EXISTS "Users can view own calendar users" ON public.recall_calendar_users;
DROP POLICY IF EXISTS "Users can insert own calendar users" ON public.recall_calendar_users;
DROP POLICY IF EXISTS "Users can update own calendar users" ON public.recall_calendar_users;
DROP POLICY IF EXISTS "Service role full access" ON public.recall_calendar_users;

-- Create new secure RLS policies (only authenticated users can access their own data)
CREATE POLICY "Users can view own calendar users" 
  ON public.recall_calendar_users
  FOR SELECT TO authenticated
  USING (supabase_user_id = auth.uid());

CREATE POLICY "Users can insert own calendar users" 
  ON public.recall_calendar_users
  FOR INSERT TO authenticated
  WITH CHECK (supabase_user_id = auth.uid());

CREATE POLICY "Users can update own calendar users" 
  ON public.recall_calendar_users
  FOR UPDATE TO authenticated
  USING (supabase_user_id = auth.uid());

-- Make supabase_user_id NOT NULL to prevent future entries without user association
ALTER TABLE public.recall_calendar_users 
  ALTER COLUMN supabase_user_id SET NOT NULL;