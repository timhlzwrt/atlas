import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import GlobeGL, { type GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import { useSelectionStore } from '../../state/selectionStore';
import { useLayersStore } from '../../state/layersStore';
import type { CountryIndexEntry } from '../../lib/api';
import { useGlobeStore } from '../../state/globeStore';
import { GLOBE_THEME, SURFACE_STYLES } from './globeTheme';
import type { Relationship } from '../../types/domain';
import type { CountryFeature, WorldGeometry } from '../../types/geo';
import './globe.css';

interface GlobeProps {
  geometry: WorldGeometry | null;
  countryIndex: Map<string, CountryIndexEntry>;
  disputedIds: Set<string>;
  relationships: Relationship[];
  /** Rendered inside a screen-space anchor that follows the selected country every frame. */
  children?: ReactNode;
}

const CARD_MARGIN = 140;
const EDGE_PADDING = 16;

export interface GlobeHandle {
  flyToCountry: (id: string, altitude?: number) => void;
}

const INITIAL_VIEW = { lat: 20, lng: 10, altitude: 2.4 };

/**
 * Globe textures are multi-megabyte and their URLs are a fixed set, so decode
 * them once for the lifetime of the page instead of per material rebuild.
 */
const textureCache = new Map<string, THREE.Texture>();

function loadTexture(url: string, isColorMap: boolean): THREE.Texture {
  let texture = textureCache.get(url);
  if (!texture) {
    texture = new THREE.TextureLoader().load(url);
    if (isColorMap) texture.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(url, texture);
  }
  return texture;
}

const Globe = forwardRef<GlobeHandle, GlobeProps>(function Globe(
  { geometry, countryIndex, disputedIds, relationships, children },
  ref,
) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hoveredCountryId = useSelectionStore((s) => s.hoveredCountryId);
  const selectedCountryId = useSelectionStore((s) => s.selectedCountryId);
  const setHovered = useSelectionStore((s) => s.setHovered);
  const selectCountry = useSelectionStore((s) => s.selectCountry);
  const activeLayers = useLayersStore((s) => s.active);

  const flyToCountry = useCallback(
    (id: string, altitude = 1.5) => {
      const centroid = countryIndex.get(id)?.centroid;
      if (!centroid || !globeRef.current) return;
      const [lng, lat] = centroid;
      globeRef.current.pointOfView({ lat, lng, altitude }, 1000);
    },
    [countryIndex],
  );

  useImperativeHandle(ref, () => ({ flyToCountry }), [flyToCountry]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = !selectedCountryId;
    controls.autoRotateSpeed = 0.35;
    controls.enableDamping = true;
    controls.minDistance = 120;
    controls.maxDistance = 480;
  }, [selectedCountryId]);

  useEffect(() => {
    globeRef.current?.pointOfView(INITIAL_VIEW, 0);
  }, []);

  // Track the selected country's live screen position every frame while the
  // camera flies to it (see flyToCountry's 1000ms animation), then freeze the
  // anchor in place — otherwise dragging/orbiting the globe afterward would
  // drag the card along with it. A React state update on every tick would
  // re-render the whole card at 60fps, so this moves the anchor imperatively.
  useEffect(() => {
    let frozen = false;
    const tick = () => {
      if (frozen) return;
      rafRef.current = requestAnimationFrame(tick);
      const anchor = anchorRef.current;
      if (!selectedCountryId || !globeRef.current || !anchor) {
        if (anchor) anchor.style.opacity = '0';
        return;
      }
      const centroid = countryIndex.get(selectedCountryId)?.centroid;
      if (!centroid) return;
      const [lng, lat] = centroid;
      const { x, y } = globeRef.current.getScreenCoords(lat, lng, 0.02);
      const clampedX = Math.min(Math.max(x, CARD_MARGIN), size.width - CARD_MARGIN);
      // The card is vertically centred on the anchor, so clamp against its real
      // height — an expanded card is several hundred pixels tall and would
      // otherwise hang off the top of the viewport for northern countries.
      const cardHalfHeight = (anchor.firstElementChild?.clientHeight ?? 0) / 2;
      const yMargin = Math.max(CARD_MARGIN, cardHalfHeight + EDGE_PADDING);
      const clampedY = Math.min(Math.max(y, yMargin), size.height - yMargin);
      anchor.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
      anchor.style.opacity = '1';
      anchor.dataset.side = clampedX > size.width / 2 ? 'left' : 'right';
    };
    rafRef.current = requestAnimationFrame(tick);
    const settle = setTimeout(() => {
      frozen = true;
      cancelAnimationFrame(rafRef.current);
    }, 1000);
    return () => {
      frozen = true;
      clearTimeout(settle);
      cancelAnimationFrame(rafRef.current);
    };
  }, [selectedCountryId, countryIndex, size]);

  const surface = useGlobeStore((s) => s.surface);
  const brightness = useGlobeStore((s) => s.brightness);
  const style = SURFACE_STYLES[surface];

  // Brightness tints the material colour, which multiplies the texture. The
  // material is cheap to rebuild per slider step only because the textures
  // themselves are cached across rebuilds.
  const globeMaterial = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        shininess: 3,
        color: new THREE.Color(style.base).multiplyScalar(brightness),
        map: style.texture ? loadTexture(style.texture, true) : null,
        bumpMap: style.bump ? loadTexture(style.bump, false) : null,
        bumpScale: 8,
      }),
    [style.base, style.texture, style.bump, brightness],
  );

  const capColor = useCallback(
    (feat: object) => {
      const f = feat as CountryFeature;
      const id = f.properties.id;
      if (id === selectedCountryId) return style.landSelected;
      if (id === hoveredCountryId) return style.landHover;
      if (disputedIds.has(id)) return style.landDisputed;
      return style.landDefault;
    },
    [selectedCountryId, hoveredCountryId, disputedIds, style],
  );

  const strokeColor = useCallback(
    (feat: object) => {
      const f = feat as CountryFeature;
      const id = f.properties.id;
      if (id === selectedCountryId) return style.strokeSelected;
      if (id === hoveredCountryId) return style.strokeHover;
      return style.strokeDefault;
    },
    [selectedCountryId, hoveredCountryId, style],
  );

  const altitude = useCallback(
    (feat: object) => {
      const f = feat as CountryFeature;
      const id = f.properties.id;
      if (id === selectedCountryId) return GLOBE_THEME.altitudeSelected;
      if (id === hoveredCountryId) return GLOBE_THEME.altitudeHover;
      return GLOBE_THEME.altitudeDefault;
    },
    [selectedCountryId, hoveredCountryId],
  );

  const arcsData = useMemo(() => {
    const anyLayerActive = Object.values(activeLayers).some(Boolean);
    if (!anyLayerActive) return [];
    const arcs: { startLat: number; startLng: number; endLat: number; endLng: number; color: string; type: string }[] = [];
    for (const rel of relationships) {
      if (!activeLayers[rel.type]) continue;
      const coords = rel.countries.map((id) => countryIndex.get(id)?.centroid).filter((c): c is [number, number] => Boolean(c));
      if (coords.length < 2) continue;
      // Hub-and-spoke from the first country keeps the layer readable instead of an N^2 mesh.
      const [hubLng, hubLat] = coords[0];
      for (const [lng, lat] of coords.slice(1)) {
        arcs.push({ startLat: hubLat, startLng: hubLng, endLat: lat, endLng: lng, color: arcColorForType(rel.type), type: rel.type });
      }
    }
    return arcs;
  }, [activeLayers, relationships, countryIndex]);

  const handlePolygonClick = useCallback(
    (feat: object) => {
      const f = feat as CountryFeature;
      selectCountry(f.properties.id);
      flyToCountry(f.properties.id, 1.3);
    },
    [selectCountry, flyToCountry],
  );

  const handlePolygonHover = useCallback(
    (feat: object | null) => {
      setHovered(feat ? (feat as CountryFeature).properties.id : null);
    },
    [setHovered],
  );

  return (
    <div className="globe-viewport" ref={containerRef}>
      <GlobeGL
        ref={globeRef}
        width={size.width}
        height={size.height}
        backgroundColor={GLOBE_THEME.backgroundColor}
        globeMaterial={globeMaterial}
        showAtmosphere
        atmosphereColor={style.atmosphere}
        atmosphereAltitude={GLOBE_THEME.atmosphereAltitude}
        showGraticules={false}
        polygonsData={geometry?.features ?? []}
        polygonGeoJsonGeometry="geometry"
        polygonCapColor={capColor}
        polygonSideColor={() => (style.texture ? 'rgba(10, 18, 34, 0.25)' : 'rgba(4, 8, 18, 0.6)')}
        polygonStrokeColor={strokeColor}
        polygonAltitude={altitude}
        polygonsTransitionDuration={220}
        onPolygonClick={handlePolygonClick}
        onPolygonHover={handlePolygonHover}
        arcsData={arcsData}
        arcColor="color"
        arcAltitudeAutoScale={0.28}
        arcStroke={0.4}
        arcDashLength={0.5}
        arcDashGap={0.25}
        arcDashAnimateTime={2600}
      />
      <div className="card-anchor" ref={anchorRef} data-side="right">
        {children}
      </div>
    </div>
  );
});

function arcColorForType(type: string): string {
  switch (type) {
    case 'military':
      return '#e0637a';
    case 'alliance':
      return '#5b8cff';
    case 'trade':
      return '#4fd1a5';
    case 'diplomatic':
      return '#8fb4ff';
    case 'conflict':
      return '#e0637a';
    default:
      return '#8fb4ff';
  }
}

export default Globe;
