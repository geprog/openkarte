export type PopupConfig = {
  titleProp: string;
  details?: {
    label: string;
    prop: string;
    formatter?: (val: any, item: any) => string;
  }[];
};

export function createPopupConfig(t: (key: string) => string): PopupConfig {
  return {
    titleProp: 'BADEGEWAESSERNAME',
    details: [
      { label: 'quality', prop: 'EINSTUFUNG_ODER_VORABBEWERTUNG' },
      { label: 'category', prop: 'GEWAESSERKATEGORIE' },
      { label: 'depth', prop: 'SICHTTIEFE', formatter: (val: unknown) => `${val ?? 'N/A'} m` },
      { label: 'seasonal', prop: 'SAISONBEGINN', formatter: (val: unknown, item: any) => `${val ?? ''} - ${item.properties?.SAISONENDE ?? 'N/A'} (${item.properties?.GESCHLOSSEN ?? ''})`},
      { label: 'infrastructure', prop: 'INFRASTRUKTUR' },
    ],
  };
}
