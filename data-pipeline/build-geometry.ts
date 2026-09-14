/**
 * Converts the Natural-Earth-derived world-atlas TopoJSON into GeoJSON tagged
 * with our own country ids (ISO 3166-1 alpha-2), plus a lightweight centroid
 * index used for camera fly-to and label placement.
 *
 * world-atlas ids are ISO 3166-1 numeric codes for most features. A handful of
 * geometries (Kosovo, Somaliland) have no numeric code because they lack an
 * official ISO assignment — those are joined by name instead and given the
 * pseudo-codes this app uses consistently elsewhere (XK, XS).
 */
import { geoCentroid } from 'd3-geo';
// 50m is a deliberate choice: the converted (minified, simplified, coordinate-
// rounded — see below) GeoJSON gzips to ~0.33MB vs. several times that for
// 10m (TopoJSON's arc-sharing, which keeps the *source* files small, is lost
// once countries are split into standalone GeoJSON features), and at globe
// scale the extra 10m coastline detail is invisible. The one real sovereign
// state missing from 50m (Tuvalu, pop. ~11,000, one of the smallest UN
// members) is a documented gap rather than shown at all — see
// docs/DATA_SOURCES.md.
import rawWorldTopo from 'world-atlas/countries-50m.json' with { type: 'json' };
import * as topojsonClient from 'topojson-client';
import type { Topology } from 'topojson-specification';

const worldTopo = rawWorldTopo as unknown as Topology;

const NAME_TO_PSEUDO_CODE: Record<string, string> = {
  Kosovo: 'XK',
  Somaliland: 'XS',
  'W. Sahara': 'EH',
};

export interface CountryFeatureProperties {
  id: string; // our iso2 / pseudo-code
  name: string; // Natural Earth label (display fallback only; real name comes from country data)
}

export interface GeometryBuildResult {
  featureCollection: GeoJSON.FeatureCollection<GeoJSON.Geometry, CountryFeatureProperties>;
  centroids: Record<string, [number, number]>; // id -> [lng, lat]
  unmatchedNumericIds: string[];
}

// world-atlas' topojson->geojson conversion leaves ~14 significant digits per
// coordinate (arc delta-decoding artifacts), none of it real: the source is
// 50m-resolution (~0.00045°) to begin with, and this is a rotating UI globe,
// not a survey tool. Rounding to 1e-4° (~11m at the equator) is still finer
// than the source data, with no visible or measurable effect on shape.
const COORDINATE_PRECISION = 4;

function roundCoordinates<T>(coords: T): T {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number') {
    const factor = 10 ** COORDINATE_PRECISION;
    return (coords as number[]).map((n) => Math.round(n * factor) / factor) as unknown as T;
  }
  return (coords as unknown[]).map((c) => roundCoordinates(c)) as unknown as T;
}

// 15 of 205 countries — mostly Arctic/archipelago coastlines (Canada, Russia,
// Indonesia, Norway, the Philippines...) — carry over half of all ~93k
// coordinate points in this dataset, nearly all of it sub-pixel detail on a
// UI globe. Douglas-Peucker simplification at this tolerance (~3km at the
// equator) cuts total vertices by ~58% with no visible shape change — checked
// by rendering Canada/Norway/Philippines/Indonesia (the most complex
// coastlines in the set) before/after at up to 0.05° (~5.5km, nearly double
// this tolerance) with no distortion visible even then. Fewer vertices means
// less geometry for the GPU to build and transform per polygon, and less
// work for hover/click raycasting to test against.
const SIMPLIFY_TOLERANCE_DEGREES = 0.03;

function perpendicularDistance(point: GeoJSON.Position, lineStart: GeoJSON.Position, lineEnd: GeoJSON.Position): number {
  const [x, y] = point;
  const [ax, ay] = lineStart;
  const [bx, by] = lineEnd;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(x - ax, y - ay);
  const t = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy);
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function douglasPeucker(points: GeoJSON.Position[], epsilon: number): GeoJSON.Position[] {
  if (points.length < 3) return points;
  let maxDist = 0;
  let splitIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      splitIndex = i;
    }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, splitIndex + 1), epsilon);
    const right = douglasPeucker(points.slice(splitIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [start, end];
}

// A ring simplified below 4 points (3 distinct + closing point) is no longer
// a valid polygon — keep the original in that rare, tiny-island case rather
// than collapse the shape entirely.
function simplifyRing(ring: GeoJSON.Position[], epsilon: number): GeoJSON.Position[] {
  if (ring.length <= 4) return ring;
  const simplified = douglasPeucker(ring, epsilon);
  return simplified.length < 4 ? ring : simplified;
}

function simplifyPolygonRings(rings: GeoJSON.Position[][], epsilon: number): GeoJSON.Position[][] {
  return rings.map((ring) => simplifyRing(ring, epsilon));
}

function simplifyCoordinates(
  type: 'Polygon' | 'MultiPolygon',
  coordinates: GeoJSON.Polygon['coordinates'] | GeoJSON.MultiPolygon['coordinates'],
  epsilon: number,
): GeoJSON.Polygon['coordinates'] | GeoJSON.MultiPolygon['coordinates'] {
  if (type === 'Polygon') return simplifyPolygonRings(coordinates as GeoJSON.Polygon['coordinates'], epsilon);
  return (coordinates as GeoJSON.MultiPolygon['coordinates']).map((poly) => simplifyPolygonRings(poly, epsilon));
}

export function buildGeometry(isoNumToIso2: Map<string, string>): GeometryBuildResult {
  const geo = topojsonClient.feature(worldTopo, 'countries') as unknown as GeoJSON.FeatureCollection<
    GeoJSON.Geometry,
    { name: string }
  >;
  const features: GeoJSON.Feature<GeoJSON.Geometry, CountryFeatureProperties>[] = [];
  const centroids: Record<string, [number, number]> = {};
  const unmatchedNumericIds: string[] = [];

  for (const f of geo.features) {
    const numericId = (f as unknown as { id?: string }).id;
    const name = f.properties?.name ?? 'Unknown';
    let iso2 = numericId ? isoNumToIso2.get(numericId.padStart(3, '0')) ?? isoNumToIso2.get(numericId) : undefined;
    if (!iso2) iso2 = NAME_TO_PSEUDO_CODE[name];
    if (!iso2) {
      if (numericId) unmatchedNumericIds.push(`${numericId} (${name})`);
      continue;
    }
    // Centroid off the full-precision geometry, before rounding is applied to the shipped copy.
    const c = geoCentroid(f as GeoJSON.Feature);
    if (Number.isFinite(c[0]) && Number.isFinite(c[1])) centroids[iso2] = [c[0], c[1]];
    const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    const simplified = simplifyCoordinates(geom.type, geom.coordinates, SIMPLIFY_TOLERANCE_DEGREES);
    features.push({
      ...f,
      properties: { id: iso2, name },
      geometry: { type: geom.type, coordinates: roundCoordinates(simplified) } as GeoJSON.Geometry,
    });
  }

  return {
    featureCollection: { type: 'FeatureCollection', features },
    centroids,
    unmatchedNumericIds,
  };
}
