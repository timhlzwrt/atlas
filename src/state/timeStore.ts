import { create } from 'zustand';

export const PRESENT_YEAR = new Date().getFullYear();

interface TimeState {
  /** 'present' = live/current data. 'historical' = an event/date was chosen; most data is unavailable. */
  mode: 'present' | 'historical';
  selectedDate: string; // ISO date
  selectedEventId: string | null;
  timelineScope: 'world' | 'country';

  goToPresent: () => void;
  selectEvent: (eventId: string, date: string) => void;
  setTimelineScope: (scope: 'world' | 'country') => void;
}

const today = new Date().toISOString().slice(0, 10);

export const useTimeStore = create<TimeState>((set) => ({
  mode: 'present',
  selectedDate: today,
  selectedEventId: null,
  timelineScope: 'world',

  goToPresent: () => set({ mode: 'present', selectedDate: today, selectedEventId: null }),
  selectEvent: (eventId, date) => set({ mode: 'historical', selectedEventId: eventId, selectedDate: date }),
  setTimelineScope: (scope) => set({ timelineScope: scope }),
}));
