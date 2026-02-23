import { useState, useCallback } from 'react';
import { Meeting, MeetingAnalysis } from '@/types/meeting';
import { supabase } from '@/integrations/supabase/client';
import { saveBlob, deleteBlob } from './useIndexedDBBackup';

const STORAGE_PREFIX = 'meeting:';
const MAX_UPLOAD_RETRIES = 3;

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
    // Store the storage path, not a signed URL
    audioUrl: rec.video_url || undefined,
    user_id: rec.user_id,
    meeting_id: rec.meeting_id,
    status: rec.status,
  };
};

/** Generate a short-lived signed URL from a storage path */
export const getAudioUrl = async (storagePath: string): Promise<string | null> => {
  if (!storagePath) return null;

  // If it's already a full URL (legacy signed URL), return as-is
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return storagePath;
  }

  const { data, error } = await supabase.storage
    .from('audio-uploads')
    .createSignedUrl(storagePath, 60 * 60); // 1 hour

  if (error) {
    console.error('Fehler beim Erstellen der Signed URL:', error);
    return null;
  }
  return data?.signedUrl || null;
};

async function uploadWithRetry(
  filePath: string,
  blob: Blob,
  meetingId: string,
): Promise<string> {
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
    try {
      const { error: uploadError } = await supabase.storage
        .from('audio-uploads')
        .upload(filePath, blob, {
          contentType: blob.type || 'audio/webm',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Success – remove any IndexedDB backup
      try { await deleteBlob(meetingId); } catch (_) { /* ignore */ }
      return filePath;
    } catch (err) {
      lastError = err;
      console.warn(`Upload Versuch ${attempt}/${MAX_UPLOAD_RETRIES} fehlgeschlagen:`, err);
      if (attempt < MAX_UPLOAD_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  // All retries failed – save blob to IndexedDB
  try {
    await saveBlob(meetingId, blob);
    console.log('Audio-Blob in IndexedDB gesichert:', meetingId);
  } catch (idbErr) {
    console.error('IndexedDB-Sicherung fehlgeschlagen:', idbErr);
  }

  throw lastError;
}

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
      let storagePath: string | null = null;
      if (meeting.audioBlob && meeting.audioBlob.size > 0) {
        const extension = meeting.audioBlob.type?.includes('webm') ? 'webm' : 'mp3';
        const filePath = `${user.id}/${meeting.id}.${extension}`;

        storagePath = await uploadWithRetry(filePath, meeting.audioBlob, meeting.id);
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
        // Store path instead of signed URL
        video_url: storagePath || meeting.audioUrl || null,
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
    getAudioUrl,
  };
};
