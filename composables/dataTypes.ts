export interface DateGroup {
  year: string
  width: string
  offset: string
  color: string
}

export interface DataEntry {
  [key: string]: string | number
}

export interface MapDisplayOptions {
  name: string
  title: string
}

export interface LegendDetails {
  label: string
  color: string
  /** Inclusive lower bound of a `ranges` legend entry; open-ended when omitted. */
  min?: number
  /** Exclusive upper bound of a `ranges` legend entry; open-ended when omitted. */
  max?: number
}

export interface Options {
  label_option: string
  legend_option: 'default' | 'colorVariant' | 'ranges'
  type: string
  value_group: string
  crs?: string | Record<string, string>
  latitude_field?: string | Record<string, string>
  longitude_field?: string | Record<string, string>
  display_option: 'popup' | 'line chart'
  popup_name?: string
  popup_details?: { label: string, prop: string | string[] }[]
  legend_details?: LegendDetails[]
}

export interface UrlInfo {
  name: string
  organization?: { title: string }
  url: string
  license_title?: string
  license_url?: string
  nested_series?: UrlInfo[]
}
