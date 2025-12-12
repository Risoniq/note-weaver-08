import { useState, useCallback } from 'react';
import { Meeting } from '@/types/meeting';

const STORAGE_PREFIX = 'meeting:';

export const useMeetingStorage = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const loadMeetings = useCallback(async () => {
    try {
      // Use localStorage as fallback
      const keys = Object.keys(localStorage).filter(key => key.startsWith(STORAGE_PREFIX));
      const loadedMeetings = keys.map(key => {
        try {
          const data = localStorage.getItem(key);
          return data ? JSON.parse(data) : null;
        } catch {
          return null;
        }
      }).filter((m): m is Meeting => m !== null);
      
      const sorted = loadedMeetings.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setMeetings(sorted);
    } catch (error) {
      console.log('Keine gespeicherten Meetings gefunden');
    }
  }, []);

  const saveMeeting = useCallback(async (meeting: Meeting) => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${meeting.id}`, JSON.stringify(meeting));
      await loadMeetings();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      throw error;
    }
  }, [loadMeetings]);

  const deleteMeeting = useCallback(async (id: string) => {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
      await loadMeetings();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      throw error;
    }
  }, [loadMeetings]);

  return {
    meetings,
    loadMeetings,
    saveMeeting,
    deleteMeeting,
  };
};
