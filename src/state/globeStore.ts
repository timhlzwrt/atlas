import { create } from 'zustand';

export type GlobeSurface = 'political' | 'satellite' | 'night' | 'terrain';

export interface SurfaceOption {
  id: GlobeSurface;
  label: string;
  hint: string;
}

export const SURFACE_OPTIONS: SurfaceOption[] = [
  { id: 'political', label: 'Political', hint: 'Flat country fills, no imagery' },
  { id: 'satellite', label: 'Satellite', hint: 'NASA Blue Marble true-colour imagery' },
  { id: 'night', label: 'Night lights', hint: 'NASA Earth at Night city lights' },
  { id: 'terrain', label: 'Terrain', hint: 'Shaded relief from elevation data' },
];

const STORAGE_KEY = 'atlas.globe';

interface Persisted {
  surface: GlobeSurface;
  brightness: number;
}

/** Brightness multiplies the globe material colour, so it dims imagery without touching the UI chrome. */
const DEFAULTS: Persisted = { surface: 'political', brightness: 0.55 };

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      surface: SURFACE_OPTIONS.some((o) => o.id === parsed.surface) ? parsed.surface! : DEFAULTS.surface,
      brightness:
        typeof parsed.brightness === 'number' && parsed.brightness >= 0.15 && parsed.brightness <= 1
          ? parsed.brightness
          : DEFAULTS.brightness,
    };
  } catch {
    return DEFAULTS;
  }
}

function save(state: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // private mode / storage disabled — the preference just won't persist
  }
}

interface GlobeState extends Persisted {
  setSurface: (surface: GlobeSurface) => void;
  setBrightness: (brightness: number) => void;
}

export const useGlobeStore = create<GlobeState>((set, get) => ({
  ...load(),
  setSurface: (surface) => {
    set({ surface });
    save({ surface, brightness: get().brightness });
  },
  setBrightness: (brightness) => {
    set({ brightness });
    save({ surface: get().surface, brightness });
  },
}));
