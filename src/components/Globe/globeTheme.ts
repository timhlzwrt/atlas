import type { GlobeSurface } from '../../state/globeStore';

export const GLOBE_THEME = {
  backgroundColor: 'rgba(0,0,0,0)',
  globeBase: '#03060d',
  atmosphere: '#2c4a86',
  atmosphereAltitude: 0.13,

  altitudeDefault: 0.006,
  altitudeHover: 0.012,
  altitudeSelected: 0.02,
} as const;

export interface SurfaceStyle {
  /** Equirectangular texture for the globe sphere; null renders the flat base colour. */
  texture: string | null;
  /** Height map used as a bump map — only meaningful on top of an imagery texture. */
  bump: string | null;
  /** Base colour the material tints the texture with (or shows on its own when there is none). */
  base: string;
  atmosphere: string;

  landDefault: string;
  landHover: string;
  landSelected: string;
  landDisputed: string;

  strokeDefault: string;
  strokeHover: string;
  strokeSelected: string;
}

/**
 * On the imagery surfaces the country polygons stop being the map and become an
 * overlay: near-transparent fills so the texture reads through, with the
 * borders carrying the political information instead.
 */
export const SURFACE_STYLES: Record<GlobeSurface, SurfaceStyle> = {
  political: {
    texture: null,
    bump: null,
    base: '#03060d',
    atmosphere: '#2c4a86',
    landDefault: '#0d1424',
    landHover: '#1a2440',
    landSelected: '#294479',
    landDisputed: '#231b12',
    strokeDefault: 'rgba(105, 130, 180, 0.32)',
    strokeHover: 'rgba(150, 176, 226, 0.6)',
    strokeSelected: 'rgba(196, 214, 255, 0.75)',
  },
  satellite: {
    texture: '/textures/earth-blue-marble.jpg',
    bump: '/textures/earth-topology.png',
    base: '#ffffff',
    atmosphere: '#33528c',
    landDefault: 'rgba(0, 0, 0, 0)',
    landHover: 'rgba(120, 160, 235, 0.22)',
    landSelected: 'rgba(120, 160, 235, 0.34)',
    landDisputed: 'rgba(217, 164, 65, 0.16)',
    strokeDefault: 'rgba(220, 232, 255, 0.22)',
    strokeHover: 'rgba(235, 243, 255, 0.55)',
    strokeSelected: 'rgba(255, 255, 255, 0.8)',
  },
  night: {
    texture: '/textures/earth-night.jpg',
    bump: null,
    base: '#ffffff',
    atmosphere: '#243d6b',
    landDefault: 'rgba(0, 0, 0, 0)',
    landHover: 'rgba(110, 150, 225, 0.2)',
    landSelected: 'rgba(110, 150, 225, 0.32)',
    landDisputed: 'rgba(217, 164, 65, 0.14)',
    strokeDefault: 'rgba(150, 180, 235, 0.24)',
    strokeHover: 'rgba(200, 220, 255, 0.55)',
    strokeSelected: 'rgba(240, 247, 255, 0.8)',
  },
  terrain: {
    texture: '/textures/earth-topology.png',
    bump: '/textures/earth-topology.png',
    base: '#8b9db8',
    atmosphere: '#2c4a86',
    landDefault: 'rgba(0, 0, 0, 0)',
    landHover: 'rgba(120, 160, 235, 0.22)',
    landSelected: 'rgba(120, 160, 235, 0.34)',
    landDisputed: 'rgba(217, 164, 65, 0.16)',
    strokeDefault: 'rgba(190, 210, 245, 0.28)',
    strokeHover: 'rgba(225, 236, 255, 0.6)',
    strokeSelected: 'rgba(255, 255, 255, 0.8)',
  },
};
