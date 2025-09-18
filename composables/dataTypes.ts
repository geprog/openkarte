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
