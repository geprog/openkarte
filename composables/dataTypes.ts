export interface DateGroup {
  year: string
  width: string
  offset: string
  color: string
}

export interface DateOptions {
  [key: number]: string
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
}

export interface Options {
  label_option: string
  legend_option: 'default' | 'colorVariant'
  type: string
  value_group: string
  coordinate_field_x?: string
  coordinate_field_y?: string
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
