<template>
  <div ref="map" class="absolute inset-0 z-0" />
</template>

<script setup lang="ts">
import type { FeatureCollection } from 'geojson';
import L, { Control } from 'leaflet';
import { defineEmits, onMounted, ref, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';

const props = defineProps<{
  fetchedData: FeatureCollection
}>();
const emit = defineEmits<{
  (e: 'marker-click', data: any): void
}>();
let selectedMarker: L.Layer | null = null;
let legendControl: L.Control | null = null;
const geoJsonLayers: L.GeoJSON[] = [];

const map = ref<HTMLDivElement | null>(null);

// const { t } = useI18n();

let leafletMap: L.Map | null = null;

function findValueByKey(obj: any, key: string): any {
  if (typeof obj !== 'object' || obj === null) {
    return undefined;
  }
  if (key in obj) {
    return obj[key];
  }
  for (const value of Object.values(obj)) {
    const result = findValueByKey(value, key);
    if (result !== undefined)
      return result;
  }
  return undefined;
}

function generateLabels(data: typeof props.fetchedData) {
  const colorMap = new Map<string, string>();
  const legend = new Control({ position: 'topleft' });

  const legendDisplayOption = Array.from(
    new Set(data.features.map((f: any) => f.properties.options.legend_option || 'default')),
  );

  const labelKey = data.features[0]?.properties?.options?.label_option;
  const rawValues = data.features.map((f: any) => findValueByKey(f, labelKey));
  const uniqueValues = Array.from(new Set(rawValues.map(v => v ?? 'default')));

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
    const numericValues = uniqueValues
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

    bins.forEach(([start, end], i) => {
      const label = `${start.toFixed(1)} - ${end.toFixed(1)}`;
      colorMap.set(label, generateColor(i, bins.length));
    });

    function getBinLabel(value: number): string {
      for (const [start, end] of bins) {
        if (value >= start && value <= end) {
          return `${start.toFixed(1)} - ${end.toFixed(1)}`;
        }
      }
      return 'default';
    }

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

    data.features.forEach((f: any) => {
      const val = +findValueByKey(f, labelKey);
      const binLabel = getBinLabel(val);
      f.__binLabel = binLabel;
    });
  }
  if (leafletMap) {
    legend.addTo(leafletMap);
    legendControl = legend;
  }
  return colorMap;
}

function generateColor(index: number, total: number): string {
  const hue = (index * (360 / total)) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

function renderMarkers(data: typeof props.fetchedData) {
  if (!data)
    return;

  clearMarkers();
  clearLegend();

  const colorMap = generateLabels(data);
  const originalMarkerStyleMap = new Map<L.Layer, any>();

  data.features.forEach((feature: any) => {
    const legendOption = feature.properties.options.legend_option;
    const labelOption = feature.properties.options.label_option;
    let key = feature.properties[labelOption];

    if (legendOption === 'colorVarient') {
      key = feature.__binLabel;
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
        const style = {
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
            selectedMarker.setStyle(originalMarkerStyleMap.get(selectedMarker));
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

onMounted(() => {
  if (!map.value)
    return;

  leafletMap = L.map(map.value).setView([54.2194, 9.6961], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(leafletMap);

  clearMarkers();
  clearLegend();
  if (!props.fetchedData) {
    renderMarkers(props.fetchedData);
  }
});

watch(() => props.fetchedData, (newData) => {
  if (leafletMap && newData) {
    clearMarkers();
    clearLegend();
    renderMarkers(newData);
  }
}, { immediate: true });
</script>
