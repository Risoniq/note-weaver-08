import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface SpeakerSuggestion {
  id: string;
  name: string;
  usage_count: number;
  last_used_at: string;
}

export const useSpeakerSuggestions = () => {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<SpeakerSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Lade Vorschläge beim Mount
  const fetchSuggestions = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('speaker_suggestions')
        .select('*')
        .eq('user_id', user.id)
        .order('usage_count', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching speaker suggestions:', error);
        return;
      }

      setSuggestions((data || []) as SpeakerSuggestion[]);
    } catch (error) {
      console.error('Error in fetchSuggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Speichere einen neuen Sprechernamen oder erhöhe den Nutzungszähler
  const saveSpeakerName = useCallback(async (name: string) => {
    if (!user || !name.trim()) return;
    
    // Ignoriere generische Namen
    const genericPatterns = ['Unbekannt', 'Sprecher ', 'Speaker ', 'Unknown'];
    if (genericPatterns.some(pattern => name.startsWith(pattern))) {
      return;
    }

    try {
      // Versuche Insert, bei Konflikt Update
      const { error } = await supabase
        .from('speaker_suggestions')
        .upsert(
          {
            user_id: user.id,
            name: name.trim(),
            usage_count: 1,
            last_used_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,name',
            ignoreDuplicates: false,
          }
        );

      if (error) {
        // Bei Konflikt: Inkrementiere usage_count manuell
        const existing = suggestions.find(s => s.name === name.trim());
        if (existing) {
          await supabase
            .from('speaker_suggestions')
            .update({
              usage_count: existing.usage_count + 1,
              last_used_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          // Lade aktuellen Wert und inkrementiere
          const { data: current } = await supabase
            .from('speaker_suggestions')
            .select('id, usage_count')
            .eq('user_id', user.id)
            .eq('name', name.trim())
            .maybeSingle();
          
          if (current) {
            await supabase
              .from('speaker_suggestions')
              .update({
                usage_count: (current.usage_count || 0) + 1,
                last_used_at: new Date().toISOString(),
              })
              .eq('id', current.id);
          }
        }
      }

      // Lokal aktualisieren
      setSuggestions(prev => {
        const existingIndex = prev.findIndex(s => s.name === name.trim());
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            usage_count: updated[existingIndex].usage_count + 1,
            last_used_at: new Date().toISOString(),
          };
          return updated.sort((a, b) => b.usage_count - a.usage_count);
        } else {
          return [
            {
              id: crypto.randomUUID(),
              name: name.trim(),
              usage_count: 1,
              last_used_at: new Date().toISOString(),
            },
            ...prev,
          ];
        }
      });
    } catch (error) {
      console.error('Error saving speaker name:', error);
    }
  }, [user, suggestions]);

  // Löscht einen Vorschlag
  const deleteSuggestion = useCallback(async (id: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('speaker_suggestions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting suggestion:', error);
        return;
      }

      setSuggestions(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error in deleteSuggestion:', error);
    }
  }, [user]);

  return {
    suggestions,
    isLoading,
    saveSpeakerName,
    deleteSuggestion,
    refetch: fetchSuggestions,
  };
};
