
-- Table for persisting action item completions
CREATE TABLE public.action_item_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recording_id uuid NOT NULL,
  item_index integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, recording_id, item_index)
);

-- Enable RLS
ALTER TABLE public.action_item_completions ENABLE ROW LEVEL SECURITY;

-- Users can view own completions
CREATE POLICY "Users can view own completions"
ON public.action_item_completions FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert own completions
CREATE POLICY "Users can insert own completions"
ON public.action_item_completions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete own completions
CREATE POLICY "Users can delete own completions"
ON public.action_item_completions FOR DELETE
USING (auth.uid() = user_id);

-- Admins can manage all
CREATE POLICY "Admins can manage completions"
ON public.action_item_completions FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
