<template>
  <div ref="map" class="absolute inset-0 z-0" />
</template>

<script setup lang="ts">
import L, { Control } from 'leaflet';
import { onMounted, ref, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';

const props = defineProps<{
  fetchedData?: GeoJSON.FeatureCollection | null
}>();
const emit = defineEmits<{
  (e: 'marker-click', feature: GeoJSON.Feature): void
}>();
let selectedMarker: L.Layer | null = null;
const originalMarkerStyleMap = new Map<L.Layer, L.PathOptions>();
let legendControl: L.Control | null = null;
const geoJsonLayers: L.GeoJSON[] = [];

const map = ref<HTMLDivElement | null>(null);

let leafletMap: L.Map | null = null;

function findValueByKey(obj: unknown, key: string): string | number | undefined {
  if (typeof obj !== 'object' || obj === null)
    return undefined;

  const record = obj as Record<string, unknown>;

  if (key in record) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number')
      return value;
  }

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

  const rawValues: (string | number)[] = data.features.map(f => findValueByKey(f, key) ?? 'default');

  const uniqueValues: string[] = Array.from(
    new Set(rawValues.map(v => String(v))),
  );

  if (legendDisplayOption[0] === 'default') {
    uniqueValues.forEach((value, i) => {
      colorMap.set(value, generateColor(i, uniqueValues.length));
    });

    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'info legend');
      div.setAttribute(
        'style',
        'background: white; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);',
      );

      uniqueValues.forEach((value) => {
        const color = colorMap.get(value);
        div.innerHTML += `
        <div style="color:black; margin-bottom:4px;">
            <i style="background:${color}; width:12px; height:12px; display:inline-block; margin-right:4px;"></i> ${value}
        </div>`;
      });

      return div;
    };
  }
  else if (legendDisplayOption[0] === 'colorVarient') {
    const numericValues: number[] = uniqueValues
      .map(v => +v)
      .filter(v => !Number.isNaN(v));

    if (numericValues.length === 0)
      return colorMap;

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);

    const numBins = 5;
    const step = (max - min) / numBins;

    const bins: [number, number][] = [];
    for (let i = 0; i < numBins; i++) {
      const start = min + i * step;
      const end = i === numBins - 1 ? max : start + step;
      bins.push([start, end]);
    }

    function getBinLabel(value: number): string {
      for (const [start, end] of bins) {
        if (value >= start && value <= end)
          return `${start.toFixed(1)} - ${end.toFixed(1)}`;
      }
      return 'default';
    }

    bins.forEach(([start, end], i) => {
      const label = `${start.toFixed(1)} - ${end.toFixed(1)}`;
      colorMap.set(label, generateColor(i, bins.length));
    });

    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'info legend');
      div.setAttribute(
        'style',
        'background: white; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);',
      );

      bins.forEach(([start, end]) => {
        const label = `${start.toFixed(1)} - ${end.toFixed(1)}`;
        const color = colorMap.get(label);
        div.innerHTML += `
          <div style="color:black; margin-bottom:4px;">
            <i style="background:${color}; width:12px; height:12px; display:inline-block; margin-right:4px;"></i> ${label}
          </div>`;
      });

      return div;
    };

    data.features.forEach((feature) => {
      const key = labelKey ?? 'default';
      const val = +(findValueByKey(feature, key) ?? 0);
      if (!feature.properties) {
        feature.properties = {};
      }
      feature.properties.__binLabel = getBinLabel(val);
    });
  }

  if (leafletMap) {
    legend.addTo(leafletMap);
    legendControl = legend;
  }

  return colorMap;
}

function generateColor(index: number, total: number): string {
  const allowedRanges = [
    { start: 30, end: 330 },
  ];

  const range = allowedRanges[0];
  const hue = range.start + (index * (range.end - range.start)) / total;

  return `hsl(${hue}, 70%, 40%)`;
}

function renderMarkers(data: GeoJSON.FeatureCollection | undefined) {
  if (!data)
    return;

  clearMarkers();
  clearLegend();

  const colorMap = generateLabels(data);
  originalMarkerStyleMap.clear();

  data.features.forEach((feature) => {
    const legendOption = feature.properties?.options?.legend_option;
    const labelOption = feature.properties?.options?.label_option;
    let key = labelOption ? feature.properties?.[labelOption] : undefined;

    if (legendOption === 'colorVarient') {
      key = feature.properties?.__binLabel;
    }

    const color = colorMap.get(key) ?? '#999';

    const geoJsonLayer = L.geoJSON(feature, {
      style: () => ({
        color,
        weight: 2,
        opacity: 1,
        fillColor: color,
        fillOpacity: 0.7,
      }),
      pointToLayer: (feature, latlng) => {
        const style: L.CircleMarkerOptions = {
          radius: 6,
          color,
          fillColor: color,
          fillOpacity: 0.8,
          weight: 1,
        };

        const marker = L.circleMarker(latlng, style);
        originalMarkerStyleMap.set(marker, style);
        return marker;
      },
      onEachFeature: (feature, layer) => {
        layer.on('click', () => {
          if (selectedMarker instanceof L.CircleMarker && originalMarkerStyleMap.has(selectedMarker)) {
            selectedMarker.setStyle(originalMarkerStyleMap.get(selectedMarker)!);
          }

          if (layer instanceof L.CircleMarker) {
            layer.setStyle({
              radius: 10,
              weight: 3,
              color: '#0f172b',
              fillColor: '#0f172b',
              fillOpacity: 1,
            });
          }

          selectedMarker = layer;
          // eslint-disable-next-line vue/custom-event-name-casing
          emit('marker-click', feature);
        });
      },
    });

    geoJsonLayer.addTo(leafletMap as L.Map);
    geoJsonLayers.push(geoJsonLayer);
  });
}

function resetSelectedMarker() {
  if (selectedMarker instanceof L.Path && originalMarkerStyleMap.has(selectedMarker)) {
    selectedMarker.setStyle(originalMarkerStyleMap.get(selectedMarker)!);
    selectedMarker = null;
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
  resetSelectedMarker,
});

onMounted(() => {
  if (!map.value)
    return;

  leafletMap = L.map(map.value).setView([54.2194, 9.6961], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(leafletMap);
});

watch(() => props.fetchedData, (newData) => {
  if (leafletMap && newData) {
    clearMarkers();
    clearLegend();
    renderMarkers(newData);
  }
}, { immediate: true });
</script>
