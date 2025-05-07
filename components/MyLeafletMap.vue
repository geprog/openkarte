<template>
  <div ref="map" class="absolute inset-0 z-0" />
</template>

<script setup lang="ts">
import type { MergedData } from '~/components/FetchOpenData';
import L, { Control } from 'leaflet';
import { defineEmits, onMounted, ref, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';

const props = defineProps<{
  waterBodies: MergedData[]
  featureDisplay: 'bathing' | 'traffic' | null
  busStops: null
}>();
const emit = defineEmits<{
  (e: 'marker-click', data: MergedData): void
}>();
const markers: L.Layer[] = [];
const busStopMarkers: L.Layer[] = [];
let selectedMarker: L.CircleMarker | null = null;
// let legendControl: L.Control | null = null;

const map = ref<HTMLDivElement | null>(null);

let leafletMap: L.Map | null = null;

function getColorByFeature(value: string, feature: string): string {
  const colorSets: Record<string, Record<string, string>> = {
    bathing: {
      'ausgezeichnet (Überprüfung nur bei Änderung der Einstufung)': '#4CAF50',
      'gut (Überprüfung mindestens alle vier Jahre)': '#2196F3',
      'ausreichend (Überprüfung mindestens alle 3 J)': '#FFEB3B',
      'mangelhaft (Überprüfung mindestens alle 2 J)': '#F44336',
      'changes': '#FF9800',
      'neu': '#9C27B0',
      'ohne Bewertung': '#9E9E9E',
    },
    traffic: {
    },
  };
  return colorSets[feature]?.[value] || '#999999';
}

/* function createLegend(values: string[], feature: string) {
  const legend = new Control({ position: 'bottomleft' });

  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'info legend');

    values.forEach((val) => {
      const color = getColorByFeature(val, feature);
      div.innerHTML += `
        <i style="background:${color}; width: 12px; height: 12px; display: inline-block; margin-right: 8px;"></i>
        <span style="color: black;">${val}</span><br>`;
    });

    return div;
  };

  return legend;
} */

function renderMarkers(data: typeof props.waterBodies, feature: string) {
  clearMarkers();
  data.forEach((item) => {
    const lat = Number.parseFloat(item.bathing.GEOGR_BREITE);
    const lng = Number.parseFloat(item.bathing.GEOGR_LAENGE);
    // const name = item.bathing.BADEGEWAESSERNAME;

    let value = '';
    switch (feature) {
      case 'bathing':
        value = item.classification?.EINSTUFUNG_ODER_VORABBEWERTUNG || 'default';
        break;
      case 'traffic':
        // value = item.measurements?.GEWAESSERKATEGORIE || 'default';
        break;
      default:
        value = 'default';
    }

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      const marker = L.circleMarker([lat, lng], {
        radius: 6,
        color: getColorByFeature(value, feature),
        fillColor: getColorByFeature(value, feature),
        fillOpacity: 0.8,
        weight: 1,
      })
        .addTo(leafletMap as L.Map)
        // .bindTooltip(`<strong>${name}</strong><br>${feature}: ${value}`, { sticky: true })
        .on('click', () => {
          if (selectedMarker) {
            selectedMarker.setStyle({
              radius: 6,
              weight: 1,
              color: selectedMarker.options.fillColor ?? '#999999',
            });
          }
          marker.setStyle({
            radius: 10,
            weight: 3,
            color: '#0f172b',
          });

          selectedMarker = marker;
          // eslint-disable-next-line vue/custom-event-name-casing
          emit('marker-click', item); // Emit full data for popup
        });

      markers.push(marker);
    }
  });
}
function renderBusStopMarkers(data: props.busStops) {
  clearBusStopMarkers();

  data.forEach((feature) => {
    const [minLng, minLat, maxLng, maxLat] = feature.bbox;
    
    if (!Number.isNaN(minLat) && !Number.isNaN(minLng) && !Number.isNaN(maxLat) && !Number.isNaN(maxLng)) {
      const rect = L.rectangle([[minLat, minLng], [maxLat, maxLng],], {
        color: '#2196F3',
        weight: 10,
        fillOpacity: 0.1,
      })
        .addTo(leafletMap as L.Map);
      busStopMarkers.push(rect);
    }
  });
  /* data.forEach((feature) => {
    const [lat, lng] = feature.geometry.coordinates;
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      const marker = L.circleMarker([lng, lat], {
        radius: 2,
        color: '#2196F3',
        fillColor: '#2196F3',
      })
        .addTo(leafletMap as L.Map);
      busStopMarkers.push(marker);
    }
  }); */
}
function clearBusStopMarkers() {
  if (leafletMap) {
    busStopMarkers.forEach(m => leafletMap!.removeLayer(m));
    busStopMarkers.length = 0;
  }
}
function clearMarkers() {
  if (leafletMap) {
    markers.forEach(marker => leafletMap!.removeLayer(marker));
    markers.length = 0;
  }
}

/* function clearLegend() {
  if (leafletMap && legendControl) {
    leafletMap.removeControl(legendControl);
    legendControl = null;
  }
} */

onMounted(() => {
  if (!map.value)
    return;

  leafletMap = L.map(map.value).setView([54.2194, 9.6961], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(leafletMap);

  clearBusStopMarkers();
  clearMarkers();
  if (props.waterBodies.length > 0 && props.featureDisplay) {
    renderMarkers(props.waterBodies, props.featureDisplay);

    /* const legendValues = [
      ...new Set(
        props.waterBodies.map((item) => {
          switch (props.featureDisplay) {
            case 'bathing':
              return item.classification?.EINSTUFUNG_ODER_VORABBEWERTUNG;
            case 'traffic':
              return item.measurements?.GEWAESSERKATEGORIE;
            default:
              return undefined;
          }
        }).filter((v): v is string => v !== undefined),
      ),
    ];

    legendControl = createLegend(legendValues, props.featureDisplay);
    legendControl.addTo(leafletMap); */
  }
  if (props.busStops && Array.isArray(props.busStops)) {
    renderBusStopMarkers(props.busStops.features);
  }
});

watch(
  [() => props.waterBodies, () => props.featureDisplay],
  ([newData, newFeature]) => {
    if (leafletMap && Array.isArray(newData) && newData.length > 0 && newFeature) {
      clearBusStopMarkers();
      renderMarkers(newData, newFeature);

      /* clearLegend();

      const legendValues = [
        ...new Set(
          newData.map((item) => {
            switch (newFeature) {
              case 'bathing': return item.classification?.EINSTUFUNG_ODER_VORABBEWERTUNG;
              case 'traffic': return item.measurements?.GEWAESSERKATEGORIE;
              default: return undefined;
            }
          }).filter((v): v is string => v !== undefined),
        ),
      ];

      legendControl = createLegend(legendValues, newFeature);
      legendControl.addTo(leafletMap); */
    }
  },
  { immediate: true },
);
watch(() => props.busStops, (newStops) => {
  if (newStops && Array.isArray(newStops.features)) {
    clearMarkers();
    renderBusStopMarkers(newStops.features);
  }
  else {
    clearMarkers();
    clearBusStopMarkers();
  }
});
</script>
