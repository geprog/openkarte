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

export interface Options {
  label_option: string
  legend_option: string
  type: string
  value_group: string
  coordinate_field_x?: string
  coordinate_field_y?: string
  display_option: 'popup' | 'line chart'
  popup_name?: string
  popup_details?: { label: string; prop: string | string[] }[]
}