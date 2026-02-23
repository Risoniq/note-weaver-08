import { useState, useCallback } from 'react';
import { Meeting, MeetingAnalysis } from '@/types/meeting';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_PREFIX = 'meeting:';

const mapRecordingToMeeting = (rec: any): Meeting => {
  const analysis: MeetingAnalysis = {
    summary: rec.summary || 'Keine Zusammenfassung verfügbar',
    keyPoints: rec.key_points || [],
    actionItems: rec.action_items || [],
    wordCount: rec.word_count || 0,
  };

  return {
    id: rec.id,
    title: rec.title || 'Ohne Titel',
    date: rec.created_at,
    transcript: rec.transcript_text || '',
    analysis,
    captureMode: rec.source === 'notetaker_mic' ? 'mic' : 'tab',
    duration: rec.duration || 0,
    audioUrl: rec.video_url || undefined,
    user_id: rec.user_id,
    meeting_id: rec.meeting_id,
    status: rec.status,
  };
};

export const useMeetingStorage = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const loadMeetings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMeetings([]);
        return;
      }

      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .in('source', ['notetaker_tab', 'notetaker_mic'])
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fehler beim Laden der Meetings:', error);
        return;
      }

      const mapped = (data || []).map(mapRecordingToMeeting);
      setMeetings(mapped);
    } catch (error) {
      console.error('Fehler beim Laden der Meetings:', error);
    }
  }, []);

  const saveMeeting = useCallback(async (meeting: Meeting) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht eingeloggt');

      const source = meeting.captureMode === 'mic' ? 'notetaker_mic' : 'notetaker_tab';

      // Upload audio if blob is present
      let audioUrl = meeting.audioUrl;
      if (meeting.audioBlob && meeting.audioBlob.size > 0) {
        const extension = meeting.audioBlob.type?.includes('webm') ? 'webm' : 'mp3';
        const filePath = `${user.id}/${meeting.id}.${extension}`;
        
        const { error: uploadError } = await supabase.storage
          .from('audio-uploads')
          .upload(filePath, meeting.audioBlob, {
            contentType: meeting.audioBlob.type || 'audio/webm',
            upsert: true,
          });

        if (uploadError) {
          console.error('Audio-Upload fehlgeschlagen:', uploadError);
        } else {
          const { data: signedData } = await supabase.storage
            .from('audio-uploads')
            .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year
          
          if (signedData?.signedUrl) {
            audioUrl = signedData.signedUrl;
          }
        }
      }

      const recordData = {
        id: meeting.id,
        user_id: user.id,
        meeting_id: meeting.meeting_id || `notetaker_${meeting.id}`,
        title: meeting.title,
        transcript_text: meeting.transcript || null,
        summary: meeting.analysis?.summary || null,
        key_points: meeting.analysis?.keyPoints || null,
        action_items: meeting.analysis?.actionItems || null,
        word_count: meeting.analysis?.wordCount || null,
        source,
        duration: meeting.duration || null,
        status: meeting.status || 'done',
        video_url: audioUrl || null,
      };

      const { error } = await supabase
        .from('recordings')
        .upsert(recordData, { onConflict: 'id' });

      if (error) {
        console.error('Fehler beim Speichern:', error);
        throw error;
      }

      await loadMeetings();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      throw error;
    }
  }, [loadMeetings]);

  const deleteMeeting = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('recordings')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('Fehler beim Löschen:', error);
        throw error;
      }

      await loadMeetings();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      throw error;
    }
  }, [loadMeetings]);

  // One-time migration of localStorage meetings
  const migrateLocalStorage = useCallback(async () => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(STORAGE_PREFIX));
    if (keys.length === 0) return 0;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    let migrated = 0;
    for (const key of keys) {
      try {
        const data = localStorage.getItem(key);
        if (!data) continue;
        const oldMeeting = JSON.parse(data) as Meeting;
        
        const newId = crypto.randomUUID();
        const meeting: Meeting = {
          ...oldMeeting,
          id: newId,
          meeting_id: `notetaker_${newId}`,
          user_id: user.id,
          status: 'done',
        };

        await saveMeeting(meeting);
        localStorage.removeItem(key);
        migrated++;
      } catch (err) {
        console.error('Migration fehlgeschlagen für:', key, err);
      }
    }
    return migrated;
  }, [saveMeeting]);

  return {
    meetings,
    loadMeetings,
    saveMeeting,
    deleteMeeting,
    migrateLocalStorage,
  };
};
