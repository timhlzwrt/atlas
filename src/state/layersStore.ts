import { create } from 'zustand';
import type { RelationshipType } from '../types/domain';

interface LayersState {
  active: Record<RelationshipType, boolean>;
  toggle: (type: RelationshipType) => void;
  anyActive: () => boolean;
}

const initial: Record<RelationshipType, boolean> = {
  alliance: false,
  trade: false,
  military: false,
  diplomatic: false,
  conflict: false,
  border: false,
};

export const useLayersStore = create<LayersState>((set, get) => ({
  active: initial,
  toggle: (type) =>
    set((state) => ({ active: { ...state.active, [type]: !state.active[type] } })),
  anyActive: () => Object.values(get().active).some(Boolean),
}));
