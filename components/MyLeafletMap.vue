<template>
  <div ref="map" class="absolute inset-0 z-0" />
</template>

<script setup lang="ts">
import type { FeatureCollection } from 'geojson';
import type { MergedData } from '~/composables/useFetchOpenData';
import L, { Control } from 'leaflet';
import { defineEmits, onMounted, ref, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
// light yellow to dark red

const props = defineProps<{
  fetchedData: FeatureCollection
  selectedLakeDate?: string
}>();
const emit = defineEmits<{
  (e: 'marker-click', data: MergedData): void
}>();
const markers: L.Layer[] = [];
let selectedMarker: L.CircleMarker | null = null;
let legendControl: L.Control | null = null;

const map = ref<HTMLDivElement | null>(null);

// const { t } = useI18n();

let leafletMap: L.Map | null = null;

/* function getColorForDepth(depth: number | undefined, minDepth: number, maxDepth: number): string {
  if (depth === undefined) {
    return 'rgb(150, 150, 150)';
  }
  if (minDepth === maxDepth)
    return 'rgb(255,0,0)'; // fallback if all depths are same
  const ratio = (depth - minDepth) / (maxDepth - minDepth);
  const red = Math.floor(255 * ratio);
  const blue = Math.floor(255 * (1 - ratio));
  return `rgb(${red},0,${blue})`;
} */

function generateLabels(data: typeof props.fetchedData) {
  const uniqueValues = Array.from(
    new Set(data.features.map((f: any) => f.properties[f.properties.labelOption] || 'default')),
  );
  const colorMap = new Map<string, string>();
  uniqueValues.forEach((value, i) => {
    colorMap.set(value, generateColor(i, uniqueValues.length));
  });
  const legend = new Control({ position: 'topleft' });

  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend');
    uniqueValues.forEach((value) => {
      const color = colorMap.get(value);
      div.innerHTML += `
      <div style="color:black; margin-bottom:4px;">
        <i style="background:${color}; width:12px; height:12px; display:inline-block; margin-right:4px;"></i> ${value}
      </div>`;
    });
    return div;
  };

  if (leafletMap) {
    legend.addTo(leafletMap);
  }
  return colorMap;
}

function generateColor(index: number, total: number): string {
  const hue = (index * (360 / total)) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

function renderMarkers(data: typeof props.fetchedData) {
  if (!data) {
    return;
  }

  clearMarkers();
  clearLegend();

  const colorMap = generateLabels(data);

  data.features.forEach((feature: any) => {
    const value = feature.properties[feature.properties.labelOption] || 'default';
    const color = colorMap.get(value) ?? '#999';

    const geoJsonLayer = L.geoJSON(feature, {
      style: () => ({
        color,
        weight: 2,
        opacity: 1,
        fillColor: color,
        fillOpacity: 0.7,
      }),
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 6,
          color,
          fillColor: color,
          fillOpacity: 0.8,
          weight: 1,
        });
      },
    });

    geoJsonLayer.eachLayer((layer: any) => {
      if (layer instanceof L.CircleMarker) {
        layer.on('click', () => {
          if (selectedMarker) {
            selectedMarker.setStyle({
              radius: 6,
              weight: 1,
              color: selectedMarker.options.fillColor ?? '#999999',
            });
          }

          layer.setStyle({
            radius: 10,
            weight: 3,
            color: '#0f172b',
          });

          selectedMarker = layer;
          // eslint-disable-next-line vue/custom-event-name-casing
          emit('marker-click', feature);
        });
      }
    });

    geoJsonLayer.addTo(leafletMap as L.Map);
  });
}


/* function renderLakesMarkers(data: typeof props.lakeData, selectedDate?: string) {
  if (!data) {
    return;
  }
  clearLakeMarkers();
  const matchedDepth: number[] = [];

  data.forEach((feature) => {
    if (feature.properties.lakeDepth.length > 0 && selectedDate) {
      const date = new Date(selectedDate);
      const matched = feature.properties.lakeDepth.reduce<LakeDepth | undefined>((nearest, lakeDepth) => {
        const [datePart] = lakeDepth.Zeit.split(' ');
        const zeit = new Date(datePart);
        if (zeit.getTime() <= date.getTime()) {
          if (!nearest) {
            return lakeDepth;
          }
          const [nearestDatePart] = lakeDepth.Zeit.split(' ');
          const nearestZeit = new Date(nearestDatePart);
          if (nearestZeit.getTime() > zeit.getTime()) {
            return nearest;
          }
          return lakeDepth;
        }
        return nearest;
      }, undefined);
      if (matched) {
        matchedDepth.push(Number.parseFloat(matched.wasserstand));
      }
    }
  });
  const minDepth = 0;
  const maxDepth = Math.max(...matchedDepth, 0);

  data.forEach((feature) => {
    if (feature.properties.lakeDepth.length > 0 && selectedDate) {
      const date = new Date(selectedDate);
      const matched = feature.properties.lakeDepth.reduce<LakeDepth | undefined>((nearest, lakeDepth) => {
        const [datePart] = lakeDepth.Zeit.split(' ');
        const zeit = new Date(datePart);
        if (zeit.getTime() <= date.getTime()) {
          if (!nearest) {
            return lakeDepth;
          }
          const [nearestDatePart] = lakeDepth.Zeit.split(' ');
          const nearestZeit = new Date(nearestDatePart);
          if (nearestZeit.getTime() > zeit.getTime()) {
            return nearest;
          }
          return lakeDepth;
        }
        return nearest;
      }, undefined);

      const depth = matched ? Number.parseFloat(matched.wasserstand) : undefined;
      const fillColor = getColorForDepth(depth, minDepth, maxDepth);
      const depthLabel = `${t('waterLevel')}: ${depth !== undefined ? `${depth.toFixed(2)} cm` : t('notAvailable')}`;

      const geom = feature.geometry;
      if (geom.type === 'Point' || geom.type === 'LineString' || geom.type === 'MultiPoint' || geom.type === 'GeometryCollection') {
        return;
      }
      const latlngs: L.LatLngExpression[][] = geom.type === 'MultiPolygon'
        ? geom.coordinates.map(polygon => polygon[0].map(([x, y]) => [y, x]))
        : [geom.coordinates[0].map(([x, y]) => [y, x])];

      const polygon = L.polygon(latlngs, {
        color: fillColor,
        weight: 2,
        fillOpacity: 0.5,
      }).addTo(leafletMap as L.Map);

      polygon.bindTooltip(L.tooltip({ content: `<b>${feature.properties.WK_NAME}</b><br />${depthLabel}` }));
      lakeMarkers.push(polygon);
    }
  });

  // --- Gradient Legend ---
  clearLegend();
  legendControl = new L.Control({ position: 'topleft' });
  legendControl.onAdd = () => {
    const div = L.DomUtil.create('div', 'info legend');
    div.innerHTML += `
      <span style="color:black">${t('waterLevelOfLake')}</span>
      <div style="background: linear-gradient(to right, rgb(0,0,255), rgb(255,0,0)); height: 10px; width: 250px; margin-bottom: 4px;"></div>
      <div style="display: flex; justify-content: space-between; font-size: 12px;">
        <span style="color:black">0 cm</span>
        <span style="color:black">${maxDepth.toFixed(2)} cm</span>
      </div>
    `;
    return div;
  };
  legendControl.addTo(leafletMap as L.Map);
} */

function clearMarkers() {
  if (leafletMap) {
    markers.forEach(marker => leafletMap!.removeLayer(marker));
    markers.length = 0;
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

/* watch(() => props.lakeData, (lakes) => {
  if (lakes && Array.isArray(lakes)) {
    clearLegend();
    clearMarkers();
    clearBusStopMarkers();
    renderLakesMarkers(lakes, props.selectedLakeDate);
  }
  else {
    clearLegend();
    clearMarkers();
    clearBusStopMarkers();
    clearLakeMarkers();
  }
});
watch(() => props.selectedLakeDate, (newDate) => {
  if (props.lakeData) {
    renderLakesMarkers(props.lakeData, newDate);
  }
}); */
</script>
