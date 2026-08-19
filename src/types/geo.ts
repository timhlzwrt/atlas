import type { Feature, FeatureCollection, Geometry } from 'geojson';

export interface CountryFeatureProperties {
  id: string;
  name: string;
}

export type CountryFeature = Feature<Geometry, CountryFeatureProperties>;
export type WorldGeometry = FeatureCollection<Geometry, CountryFeatureProperties>;
