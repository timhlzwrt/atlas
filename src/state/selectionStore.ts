import { create } from 'zustand';

interface SelectionState {
  hoveredCountryId: string | null;
  selectedCountryId: string | null;
  cardExpanded: boolean;
  compareCountryIds: [string | null, string | null];
  compareOpen: boolean;

  setHovered: (id: string | null) => void;
  selectCountry: (id: string | null) => void;
  setCardExpanded: (expanded: boolean) => void;
  openCompare: (a?: string, b?: string) => void;
  closeCompare: () => void;
  setCompareCountry: (slot: 0 | 1, id: string | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  hoveredCountryId: null,
  selectedCountryId: null,
  cardExpanded: false,
  compareCountryIds: [null, null],
  compareOpen: false,

  setHovered: (id) => set({ hoveredCountryId: id }),
  selectCountry: (id) => set({ selectedCountryId: id, cardExpanded: false }),
  setCardExpanded: (expanded) => set({ cardExpanded: expanded }),
  openCompare: (a, b) =>
    set((state) => ({
      compareOpen: true,
      compareCountryIds: [a ?? state.selectedCountryId, b ?? state.compareCountryIds[1]],
    })),
  closeCompare: () => set({ compareOpen: false }),
  setCompareCountry: (slot, id) =>
    set((state) => {
      const next: [string | null, string | null] = [...state.compareCountryIds];
      next[slot] = id;
      return { compareCountryIds: next };
    }),
}));
