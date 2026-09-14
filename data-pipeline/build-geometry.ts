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
// 50m is a deliberate choice: the converted (minified, coordinate-rounded —
// see roundCoordinates below) GeoJSON gzips to ~0.6MB vs. several times that
// for 10m (TopoJSON's arc-sharing, which keeps the *source* files small, is
// lost once countries are split into standalone GeoJSON features), and at
// globe scale the extra 10m coastline detail is invisible. The one real
// sovereign state missing from 50m (Tuvalu, pop. ~11,000, one of the
// smallest UN members) is a documented gap rather than shown at all — see
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
// than the source data and cuts the shipped geometry from ~9.1MB to ~1.7MB
// (gzipped: ~1.56MB to ~0.6MB) with no visible or measurable effect on shape.
const COORDINATE_PRECISION = 4;

function roundCoordinates<T>(coords: T): T {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number') {
    const factor = 10 ** COORDINATE_PRECISION;
    return (coords as number[]).map((n) => Math.round(n * factor) / factor) as unknown as T;
  }
  return (coords as unknown[]).map((c) => roundCoordinates(c)) as unknown as T;
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
    features.push({
      ...f,
      properties: { id: iso2, name },
      geometry: { type: geom.type, coordinates: roundCoordinates(geom.coordinates) } as GeoJSON.Geometry,
    });
  }

  return {
    featureCollection: { type: 'FeatureCollection', features },
    centroids,
    unmatchedNumericIds,
  };
}
