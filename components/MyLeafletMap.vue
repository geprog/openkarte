<template>
  <div ref="map" />
</template>

<script setup lang="ts">
import L, { Control } from 'leaflet';
import { onMounted, ref, toRaw, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';

const props = defineProps<{
  fetchedData?: GeoJSON.FeatureCollection | null
  // The map zooms to the data whenever this changes, i.e. when another layer
  // is picked, but not when the slider swaps the data of the same layer.
  layerKey?: string | null
  // Highlighted on the map, also after the slider has swapped the data.
  selectedFeature?: GeoJSON.Feature | null
}>();

const emit = defineEmits<{
  (e: 'marker-click', feature: GeoJSON.Feature): void
}>();

// Features without a value are drawn as a dashed outline without fill, so
// they cannot be mistaken for a legend class, not even a gray one.
const NO_VALUE_COLOR = '#6b6b6b';
const NO_VALUE_SWATCH_STYLE = `border:2px dashed ${NO_VALUE_COLOR}; box-sizing:border-box; width:12px; height:12px; display:inline-block; margin-right:4px;`;

const { t } = useI18n();

let highlightedMarker: L.CircleMarker | null = null;
const originalMarkerStyleMap = new Map<L.Layer, L.PathOptions>();
const layerByFeature = new Map<GeoJSON.Feature, L.Layer>();
let legendControl: L.Control | null = null;
const geoJsonLayers: L.GeoJSON[] = [];

const map = ref<HTMLDivElement | null>(null);

let leafletMap: L.Map | null = null;

function findValueByKey(obj: unknown, key: string): string | number | undefined {
  if (typeof obj !== 'object' || obj === null)
    return undefined;

  const record = obj as Record<string, unknown>;
  const targetKey = key.toLowerCase();

  // Case-insensitive key lookup
  for (const k of Object.keys(record)) {
    if (k.toLowerCase() === targetKey) {
      const value = record[k];
      if (typeof value === 'string' || typeof value === 'number') {
        return value;
      }
    }
  }

  // Recursively search nested objects
  for (const value of Object.values(record)) {
    const result = findValueByKey(value, key);
    if (result !== undefined)
      return result;
  }

  return undefined;
}

function generateLabels(data: GeoJSON.FeatureCollection): Map<string, string> {
  const colorMap = new Map<string, string>();
  const legend = new Control({ position: 'topleft' });
  const legendDisplayOption: string[] = Array.from(
    new Set(
      data.features.map(
        f => f.properties?.options?.legend_option ?? 'default',
      ),
    ),
  );
  const labelKey: string | undefined = data.features[0]?.properties?.options?.label_option;
  const key = labelKey ?? 'default';
  const legendDetail = (data.features[0]?.properties?.options?.legend_details || []) as LegendDetails[];

  if (legendDisplayOption[0] === 'default') {
    const uniqueValues = new Set(data.features.map(f => findValueByKey(f, key)).filter(v => v !== undefined).map(String));
    uniqueValues.forEach((value) => {
      const match = legendDetail.find(
        (item: LegendDetails) => item.label.toLowerCase() === value.toLowerCase(),
      );

      if (match?.color) {
        colorMap.set(value, match.color);
      }
    });
  }
  else if (legendDisplayOption[0] === 'ranges') {
    // Fixed bounds from the layer config, so a class keeps its color across all
    // snapshots of a series instead of being re-binned per snapshot.
    legendDetail.forEach(({ label, color }) => colorMap.set(label, color));

    data.features.forEach((feature) => {
      const raw = findValueByKey(feature.properties, key);
      // Values may carry a unit or a decimal comma, e.g. "3000 kW" or "4,2".
      const value = Number.parseFloat(String(raw ?? '').replace(',', '.'));
      const label = Number.isNaN(value)
        ? undefined
        : legendDetail.find(({ min, max }) => (min === undefined || value >= min) && (max === undefined || value < max))?.label;
      if (!feature.properties) {
        feature.properties = {};
      }
      feature.properties.__binLabel = label;
    });
  }

  // Every configured class is listed, whether or not the current data uses it,
  // so the legend keeps its size and order while a slider changes the data.
  const legendTitle: string | undefined = data.features[0]?.properties?.options?.legend_title;
  if (legendDetail.length > 0) {
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'info legend');
      div.setAttribute(
        'style',
        'background: white; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);',
      );

      if (legendTitle) {
        const title = L.DomUtil.create('div', '', div);
        title.setAttribute('style', 'color:black; font-weight:600; max-width:180px; margin-bottom:6px;');
        title.textContent = legendTitle;
      }

      legendDetail.forEach(({ label, color }) => {
        div.innerHTML += `
          <div style="color:black; margin-bottom:4px;">
            <i style="background:${color}; width:12px; height:12px; display:inline-block; margin-right:4px;"></i> ${label}
          </div>`;
      });
      div.innerHTML += `
          <div style="color:black; margin-bottom:4px;">
            <i style="${NO_VALUE_SWATCH_STYLE}"></i> ${t('notDefined')}
          </div>`;

      return div;
    };
  }

  if (leafletMap && legend.onAdd) {
    legend.addTo(leafletMap);
    legendControl = legend;
  }

  return colorMap;
}

function renderMarkers(data: GeoJSON.FeatureCollection | undefined) {
  if (!data)
    return;

  clearMarkers();
  clearLegend();

  const colorMap = generateLabels(data);
  originalMarkerStyleMap.clear();
  layerByFeature.clear();
  highlightedMarker = null;

  data.features.forEach((feature) => {
    const legendOption = feature.properties?.options?.legend_option;
    const labelOption = feature.properties?.options?.label_option;
    let key: string = 'default';

    if (labelOption && feature.properties) {
      const normalizedKey = Object.keys(feature.properties).find(
        k => k.toLowerCase() === labelOption.toLowerCase(),
      );
      if (normalizedKey) {
        const value = feature.properties[normalizedKey];
        if (typeof value === 'string') {
          key = value.trim();
        }
        else {
          key = value;
        }
      }
    }

    if (legendOption === 'ranges') {
      key = feature.properties?.__binLabel;
    }

    const color = colorMap.get(key);

    const geoJsonLayer = L.geoJSON(feature, {
      style: () => color
        ? { color, weight: 2, opacity: 1, fillColor: color, fillOpacity: 0.85 }
        : { color: NO_VALUE_COLOR, weight: 2, opacity: 1, dashArray: '4 3', fillOpacity: 0 },
      pointToLayer: (feature, latlng) => {
        const style: L.CircleMarkerOptions = color
          ? { radius: 6, color, fillColor: color, fillOpacity: 0.8, weight: 1 }
          : { radius: 6, color: NO_VALUE_COLOR, fillOpacity: 0, weight: 1.5 };

        const marker = L.circleMarker(latlng, style);
        originalMarkerStyleMap.set(marker, style);
        return marker;
      },
      onEachFeature: (feature, layer) => {
        layerByFeature.set(toRaw(feature), layer);
        layer.on('click', () => {
          // eslint-disable-next-line vue/custom-event-name-casing
          emit('marker-click', feature);
        });
      },
    });

    geoJsonLayer.addTo(leafletMap as L.Map);
    geoJsonLayers.push(geoJsonLayer);
  });
}

let fittedLayerKey: string | null | undefined;

function fitToData() {
  const bounds = new L.LatLngBounds(geoJsonLayers.map(layer => [layer.getBounds().getNorthEast(), layer.getBounds().getSouthWest()]).flat());
  if (bounds.isValid()) {
    leafletMap?.fitBounds(bounds, { padding: [50, 50] });
  }
}

function highlightSelectedFeature() {
  if (highlightedMarker) {
    highlightedMarker.setStyle(originalMarkerStyleMap.get(highlightedMarker)!);
    highlightedMarker = null;
  }
  const layer = props.selectedFeature ? layerByFeature.get(toRaw(props.selectedFeature)) : undefined;
  if (layer instanceof L.CircleMarker) {
    layer.setStyle({
      radius: 10,
      weight: 3,
      color: '#0f172b',
      fillColor: '#0f172b',
      fillOpacity: 1,
    });
    highlightedMarker = layer;
  }
}

function clearMarkers() {
  if (leafletMap) {
    geoJsonLayers.forEach(layer => leafletMap!.removeLayer(layer));
    geoJsonLayers.length = 0;
  }
}

function clearLegend() {
  if (leafletMap && legendControl) {
    leafletMap.removeControl(legendControl);
    legendControl = null;
  }
}

defineExpose({
  invalidateMapSize,
});

function invalidateMapSize() {
  if (leafletMap) {
    leafletMap.invalidateSize({ animate: false });
  }
}

onMounted(() => {
  if (!map.value)
    return;

  leafletMap = L.map(map.value, { preferCanvas: true }).setView([54.2194, 9.6961], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(leafletMap);
  setTimeout(invalidateMapSize, 300);
  window.addEventListener('resize', invalidateMapSize);
});

onUnmounted(() => {
  window.removeEventListener('resize', invalidateMapSize);
});

watch(() => props.fetchedData, (newData) => {
  if (leafletMap && newData) {
    clearMarkers();
    clearLegend();
    renderMarkers(newData);
    highlightSelectedFeature();
    if (fittedLayerKey !== props.layerKey) {
      fitToData();
      fittedLayerKey = props.layerKey;
    }
  }
}, { immediate: true });

watch(() => props.selectedFeature, highlightSelectedFeature);
</script>
