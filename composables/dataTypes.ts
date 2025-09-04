export interface FeatureCollection {
  date?: string
  features: Feature[]
  type: string
}

export interface Feature {
  geometry: Geometry
  properties: Record<string, any>
  type: string
  lakeDepth?: LakeDepthEntry[][]
  __binLabel?: string
}

export interface LakeDepthEntry {
  Zeit: string
  wasserstand: string
  wasserstand_status: string
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
