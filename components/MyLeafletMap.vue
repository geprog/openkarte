<template>
  <div ref="map" class="absolute inset-0" />
</template>

<script setup lang="ts">
import L, { Control } from 'leaflet';
import { onMounted, ref, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import type { MergedData } from '~/components/FetchOpenData';

// Props
const props = defineProps<{
  waterBodies: MergedData[],
  featureDisplay: ""
}>();

const map = ref<HTMLDivElement | null>(null);

let leafletMap: L.Map | null = null;

function getColor(classification: string): string {
  const colorMap: Record<string, string> = {
    'ausgezeichnet (ï¿½berprï¿½fung nur bei ï¿½nderung der Einstufung)': '#4CAF50',  // Excellent (Green)
    'gut (ï¿½berprï¿½fung mindestens alle vier Jahre)': '#2196F3',            // Good (Blue)
    'ausreichend (ï¿½berprï¿½fung mindestens alle 3 J)': '#FFEB3B',     // Sufficient (Yellow)
    'mangelhaft (ï¿½berprï¿½fung mindestens alle 2 J)': '#F44336',      // Inadequate (Red)
    'changes': '#FF9800',         // Changes (Orange)
    'neu': '#9C27B0',             // New (Purple)
    'ohne Bewertung': '#9E9E9E'   // Without rating (Grey)
  };
  return colorMap[classification] || '#999999'; // default color
}
function createLegend(classifications: string[]) {
  const legend = new Control({ position: 'bottomleft' });

  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'info legend');

    classifications.forEach((cls) => {
      div.innerHTML += `
        <i style="background:${getColor(cls)}; width: 12px; height: 12px; display: inline-block; margin-right: 8px;"></i>
        <span style="color: black;">${cls}</span><br>`;
    });

    return div;
  };

  return legend;
}
function renderMarkers(data: typeof props.waterBodies) {
  if (!leafletMap){
    return;
  }

  data.forEach((item) => {
    const lat = Number.parseFloat(item.bathing.GEOGR_BREITE);
    const lng = Number.parseFloat(item.bathing.GEOGR_LAENGE);
    const name = item.bathing.BADEGEWAESSERNAME;
    const type = item.classification?.EINSTUFUNG_ODER_VORABBEWERTUNG || 'default';

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      L.circleMarker([lat, lng], {
        radius: 5,
        color: getColor(type),
        fillColor: getColor(type),
        fillOpacity: 0.9,
        weight: 1,
      })
        .addTo(leafletMap as L.Map)
        .bindTooltip(`<strong>${name}</strong><br>Klassifikation: ${type}`, {
          sticky: true,
        });
    }
  });
}

onMounted(() => {
  if (!map.value)
    return;

  leafletMap = L.map(map.value).setView([54.2194, 9.6961], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(leafletMap);

  if (props.waterBodies && props.waterBodies.length > 0) {
    renderMarkers(props.waterBodies);
  }
  if (props.featureDisplay && props.featureDisplay == "") {
    renderMarkers(props.waterBodies);
  }
});

watch(() => props.waterBodies, (newData) => {
  if (leafletMap && Array.isArray(newData) && newData.length > 0) {
    renderMarkers(newData);
    const classifications = [
      ...new Set(
        props.waterBodies
          .map((w) => w.classification?.EINSTUFUNG_ODER_VORABBEWERTUNG)
          .filter((value): value is string => value !== undefined)
      ),
    ];

    const legend = createLegend(classifications);
    legend.addTo(leafletMap);
  }
});
</script>
