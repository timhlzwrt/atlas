import { create } from 'zustand';

export const PRESENT_YEAR = new Date().getFullYear();

/**
 * The atlas covers the post-1945 order only. Everything upstream — the curated
 * events, the Wikidata leadership record — is filtered to this at build time,
 * and the timeline axis starts here.
 */
export const ATLAS_START_YEAR = 1945;

interface TimeState {
  /** 'present' = live/current data. 'historical' = an event/date was chosen; most data is unavailable. */
  mode: 'present' | 'historical';
  selectedDate: string; // ISO date
  selectedEventId: string | null;
  timelineScope: 'world' | 'country';
  /** Whether the per-country leadership/election markers share the track with world events. */
  showPolitics: boolean;

  goToPresent: () => void;
  selectEvent: (eventId: string, date: string) => void;
  setTimelineScope: (scope: 'world' | 'country') => void;
  setShowPolitics: (show: boolean) => void;
}

const today = new Date().toISOString().slice(0, 10);

export const useTimeStore = create<TimeState>((set) => ({
  mode: 'present',
  selectedDate: today,
  selectedEventId: null,
  timelineScope: 'world',
  showPolitics: true,

  goToPresent: () => set({ mode: 'present', selectedDate: today, selectedEventId: null }),
  selectEvent: (eventId, date) => set({ mode: 'historical', selectedEventId: eventId, selectedDate: date }),
  setTimelineScope: (scope) => set({ timelineScope: scope }),
  setShowPolitics: (show) => set({ showPolitics: show }),
}));
