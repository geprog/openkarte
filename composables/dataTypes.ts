export interface FeatureCollection {
  date?: string
  features: Feature[]
  type: string
}

export interface NormalizedResponse {
  type: string
  datasets: FeatureCollection[]
}

export interface Feature {
  geometry: Geometry
  properties: Record<string, any>
  type: string
  __binLabel?: string
}

export type Geometry =
  | PointGeometry
  | PolygonGeometry
  | MultiPolygonGeometry
  | any;

export interface PointGeometry {
  type: 'Point'
  coordinates: [number, number]
}

export interface PolygonGeometry {
  type: 'Polygon'
  coordinates: number[][]
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: number[][][][]
  bbox?: [number, number, number, number]
}

export interface DateGroup {
  year: string
  width: string
  offset: string
  color: string
}

export interface DateOptions {
  [key: number]: string
}
