export interface PopupConfig {
  titleProp: string
  details?: {
    label: string
    prop: string
    formatter?: (val: any, item: any) => string
  }[]
};

export function createPopupConfig(selectedItem: Feature): PopupConfig {
  return {
    titleProp: selectedItem.properties.options.display_option_name,
    details: [
      { label: 'quality', prop: selectedItem.properties.options.popup_display_text.text_1 },
      { label: 'category', prop: selectedItem.properties.options.popup_display_text.text_2 },
      { label: 'depth', prop: selectedItem.properties.options.popup_display_text.text_3, formatter: (val: unknown) => `${val ?? 'N/A'} m` },
      { label: 'seasonal', prop: selectedItem.properties.options.popup_display_text.text_4, formatter: (val: unknown, item: any) => `${val ?? ''} - ${item.properties?.SAISONENDE ?? 'N/A'} (${item.properties?.GESCHLOSSEN ?? ''})` },
      { label: 'infrastructure', prop: selectedItem.properties.options.popup_display_text.text_5 },
    ],
  };
}
