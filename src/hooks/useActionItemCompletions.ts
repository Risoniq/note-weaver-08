import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Completion {
  recording_id: string;
  item_index: number;
  completed_at: string;
}

export function useActionItemCompletions(recordingIds: string[]) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [completions, setCompletions] = useState<Completion[]>([]);

  useEffect(() => {
    if (!userId || recordingIds.length === 0) return;

    const load = async () => {
      const { data } = await supabase
        .from('action_item_completions' as any)
        .select('recording_id, item_index, completed_at')
        .eq('user_id', userId)
        .in('recording_id', recordingIds);
      if (data) setCompletions(data as unknown as Completion[]);
    };
    load();
  }, [userId, recordingIds.join(',')]);

  const isCompleted = useCallback(
    (recordingId: string, itemIndex: number) =>
      completions.some(c => c.recording_id === recordingId && c.item_index === itemIndex),
    [completions]
  );

  const completedAt = useCallback(
    (recordingId: string, itemIndex: number): Date | null => {
      const c = completions.find(c => c.recording_id === recordingId && c.item_index === itemIndex);
      return c ? new Date(c.completed_at) : null;
    },
    [completions]
  );

  const toggleCompletion = useCallback(
    async (recordingId: string, itemIndex: number) => {
      if (!userId) return;
      const existing = completions.find(
        c => c.recording_id === recordingId && c.item_index === itemIndex
      );

      if (existing) {
        // Remove
        setCompletions(prev => prev.filter(
          c => !(c.recording_id === recordingId && c.item_index === itemIndex)
        ));
        await supabase
          .from('action_item_completions' as any)
          .delete()
          .eq('user_id', userId)
          .eq('recording_id', recordingId)
          .eq('item_index', itemIndex);
      } else {
        // Add
        const now = new Date().toISOString();
        setCompletions(prev => [...prev, { recording_id: recordingId, item_index: itemIndex, completed_at: now }]);
        await supabase
          .from('action_item_completions' as any)
          .insert({ user_id: userId, recording_id: recordingId, item_index: itemIndex } as any);
      }
    },
    [userId, completions]
  );

  const completedCount = useCallback(
    (recordingId?: string) => {
      if (recordingId) return completions.filter(c => c.recording_id === recordingId).length;
      return completions.length;
    },
    [completions]
  );

  return { isCompleted, completedAt, toggleCompletion, completedCount };
}
