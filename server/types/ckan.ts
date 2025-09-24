export interface Relationship {
  id: string
  type: 'child_of'
  __extras: {
    object_package_id: string
    subject_package_id: string
  }
}

export interface Resource {
  id: string
  package_id: string
  name: string
  description: string
  mimetype: string
  format: 'CSV' | 'GeoJSON' | 'JSON' | 'XML' | 'XLS' | 'XLSX' | 'PDF' | 'HTML' | 'TXT' | 'ZIP'
  url: string
}

export interface Package {
  id: string
  name: string
  title: string
  type: 'collection'
  notes: string | null
  relationships_as_object: Relationship[]
  relationships_as_subject: Relationship[]
  resources: Resource[]
  extras: { key: string, value: string }[]
  license_title: string
  license_url: string
  organization: { key: string, value: string }
}

export type Response<T> = {
  help: string
} & ({
  success: true
  result: T
} | {
  success: false
  error: {
    message: string
    __type: string
  }
});
