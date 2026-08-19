import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import GlobeGL, { type GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import { useSelectionStore } from '../../state/selectionStore';
import { useLayersStore } from '../../state/layersStore';
import type { CountryIndexEntry } from '../../lib/api';
import { GLOBE_THEME } from './globeTheme';
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

export interface GlobeHandle {
  flyToCountry: (id: string, altitude?: number) => void;
}

const INITIAL_VIEW = { lat: 20, lng: 10, altitude: 2.4 };

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

  // Track the selected country's live screen position every frame (camera moves
  // continuously via drag/auto-rotate) and move the anchor imperatively — a
  // React state update on every tick would re-render the whole card at 60fps.
  useEffect(() => {
    const tick = () => {
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
      const clampedY = Math.min(Math.max(y, CARD_MARGIN), size.height - CARD_MARGIN);
      anchor.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
      anchor.style.opacity = '1';
      anchor.dataset.side = clampedX > size.width / 2 ? 'left' : 'right';
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [selectedCountryId, countryIndex, size]);

  const globeMaterial = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(GLOBE_THEME.globeBase),
        shininess: 4,
      }),
    [],
  );

  const capColor = useCallback(
    (feat: object) => {
      const f = feat as CountryFeature;
      const id = f.properties.id;
      if (id === selectedCountryId) return GLOBE_THEME.landSelected;
      if (id === hoveredCountryId) return GLOBE_THEME.landHover;
      if (disputedIds.has(id)) return GLOBE_THEME.landDisputed;
      return GLOBE_THEME.landDefault;
    },
    [selectedCountryId, hoveredCountryId, disputedIds],
  );

  const strokeColor = useCallback(
    (feat: object) => {
      const f = feat as CountryFeature;
      const id = f.properties.id;
      if (id === selectedCountryId) return GLOBE_THEME.strokeSelected;
      if (id === hoveredCountryId) return GLOBE_THEME.strokeHover;
      return GLOBE_THEME.strokeDefault;
    },
    [selectedCountryId, hoveredCountryId],
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
        atmosphereColor={GLOBE_THEME.atmosphere}
        atmosphereAltitude={GLOBE_THEME.atmosphereAltitude}
        showGraticules={false}
        polygonsData={geometry?.features ?? []}
        polygonGeoJsonGeometry="geometry"
        polygonCapColor={capColor}
        polygonSideColor={() => 'rgba(6, 12, 24, 0.6)'}
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
