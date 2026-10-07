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
  legend_option: 'default' | 'ranges'
  type: string
  value_group: string
  crs?: string
  latitude_field?: string
  longitude_field?: string
  display_option: 'popup' | 'line chart'
  popup_name?: string
  popup_details?: { label: string, prop: string | string[] }[]
  legend_details?: LegendDetails[]
  /** Shown above the legend entries, e.g. to say what the colors measure. */
  legend_title?: string
  /** Column holding the timestamp of each reading of a `value_group` series. */
  date_field?: string
  /** Readings a publisher uses as placeholders for "no reading". */
  missing_values?: number[]
  /** Jump between neighbouring readings that marks a moved zero point. */
  level_jump_threshold?: number
}

export interface UrlInfo {
  name: string
  organization?: { title: string }
  url: string
  license_title?: string
  license_url?: string
  nested_series?: UrlInfo[]
}
