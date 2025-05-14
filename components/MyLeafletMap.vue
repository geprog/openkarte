<template>
  <div ref="map" class="absolute inset-0 z-0" />
</template>

<script setup lang="ts">
import type { MergedData } from '~/composables/useFetchOpenData';
import L, { Control } from 'leaflet';
import { defineEmits, onMounted, ref, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
// light yellow to dark red

const props = defineProps<{
  waterBodies: MergedData[]
  featureDisplay: 'bathing' | 'busStops' | 'lakeData' | null
  busStops?: GeoJSON.Feature<GeoJSON.Point, unknown>[]
  lakeData?: GeoJSON.Feature<GeoJSON.Geometry, { WK_NAME: string, lakeDepth: LakeDepth[] }>[]
  selectedLakeDate?: string
}>();
const emit = defineEmits<{
  (e: 'marker-click', data: MergedData): void
}>();
const markers: L.Layer[] = [];
const busStopMarkers: L.Layer[] = [];
const lakeMarkers: L.Layer[] = [];
let selectedMarker: L.CircleMarker | null = null;
let legendControl: L.Control | null = null;

const map = ref<HTMLDivElement | null>(null);

let leafletMap: L.Map | null = null;

function getColorForDepth(depth: number | undefined, minDepth: number, maxDepth: number): string {
  if (depth === undefined) {
    return 'rgb(150, 150, 150)';
  }
  if (minDepth === maxDepth)
    return 'rgb(255,0,0)'; // fallback if all depths are same
  const ratio = (depth - minDepth) / (maxDepth - minDepth);
  const red = Math.floor(255 * ratio);
  const blue = Math.floor(255 * (1 - ratio));
  return `rgb(${red},0,${blue})`;
}
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

function createLegend(values: string[], feature: string) {
  const legend = new Control({ position: 'topleft' });

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
}

function renderMarkers(data: typeof props.waterBodies, feature: string) {
  clearMarkers();
  data.forEach((item) => {
    const lat = Number.parseFloat(item.bathing.GEOGR_BREITE);
    const lng = Number.parseFloat(item.bathing.GEOGR_LAENGE);

    let value = '';
    switch (feature) {
      case 'bathing':
        value = item.classification?.EINSTUFUNG_ODER_VORABBEWERTUNG || 'default';
        break;
      case 'traffic':
        value = item.measurements?.GEWAESSERKATEGORIE || 'default';
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
function renderBusStopMarkers(data: typeof props.busStops) {
  if (!data) {
    return;
  }
  clearBusStopMarkers();

  // data.forEach((feature) => {
  //   const [minLng, minLat, maxLng, maxLat] = feature.bbox;

  //   if (!Number.isNaN(minLat) && !Number.isNaN(minLng) && !Number.isNaN(maxLat) && !Number.isNaN(maxLng)) {
  //     const rect = L.rectangle([[minLat, minLng], [maxLat, maxLng]], {
  //       color: '#2196F3',
  //       weight: 10,
  //       fillOpacity: 0.1,
  //     })
  //       .addTo(leafletMap as L.Map);
  //     busStopMarkers.push(rect);
  //   }
  // });
  data.forEach((feature) => {
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
  });
}
function renderLakesMarkers(data: typeof props.lakeData, selectedDate?: string) {
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
      const depthLabel = depth !== undefined ? `Depth: ${depth.toFixed(2)} cm` : 'Depth: Not Available';

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
      <span style="color:black">Tiefe des Sees</span>
      <div style="background: linear-gradient(to right, rgb(0,0,255), rgb(255,0,0)); height: 10px; width: 250px; margin-bottom: 4px;"></div>
      <div style="display: flex; justify-content: space-between; font-size: 12px;">
        <span style="color:black">0 cm</span>
        <span style="color:black">${maxDepth.toFixed(2)} cm</span>
      </div>
    `;
    return div;
  };
  legendControl.addTo(leafletMap as L.Map);
}

function clearBusStopMarkers() {
  if (leafletMap) {
    busStopMarkers.forEach(m => leafletMap!.removeLayer(m));
    busStopMarkers.length = 0;
  }
}
function clearLakeMarkers() {
  if (leafletMap) {
    lakeMarkers.forEach(m => leafletMap!.removeLayer(m));
    lakeMarkers.length = 0;
  }
}
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

  clearBusStopMarkers();
  clearMarkers();
  clearLegend();
  if (props.waterBodies.length > 0 && props.featureDisplay) {
    renderMarkers(props.waterBodies, props.featureDisplay);

    const legendValues = [
      ...new Set(
        props.waterBodies.map((item) => {
          switch (props.featureDisplay) {
            case 'bathing':
              return item.classification?.EINSTUFUNG_ODER_VORABBEWERTUNG;
            default:
              return undefined;
          }
        }).filter((v): v is string => v !== undefined),
      ),
    ];

    legendControl = createLegend(legendValues, props.featureDisplay);
    legendControl.addTo(leafletMap);
  }
  if (props.busStops && Array.isArray(props.busStops)) {
    renderBusStopMarkers(props.busStops);
  }
  if (props.lakeData && Array.isArray(props.lakeData)) {
    renderLakesMarkers(props.lakeData, props.selectedLakeDate);
  }
});

watch(
  [() => props.waterBodies, () => props.featureDisplay],
  ([newData, newFeature]) => {
    if (leafletMap && Array.isArray(newData) && newData.length > 0 && newFeature) {
      clearBusStopMarkers();
      clearMarkers();
      clearLakeMarkers();
      renderMarkers(newData, newFeature);

      clearLegend();

      const legendValues = [
        ...new Set(
          newData.map((item) => {
            switch (newFeature) {
              case 'bathing': return item.classification?.EINSTUFUNG_ODER_VORABBEWERTUNG;
              default: return undefined;
            }
          }).filter((v): v is string => v !== undefined),
        ),
      ];

      legendControl = createLegend(legendValues, newFeature);
      legendControl.addTo(leafletMap);
    }
  },
  { immediate: true },
);
watch(() => props.busStops, (newStops) => {
  if (newStops && Array.isArray(newStops)) {
    clearLegend();
    clearMarkers();
    clearLakeMarkers();
    renderBusStopMarkers(newStops);
  }
  else {
    clearLegend();
    clearMarkers();
    clearLakeMarkers();
    clearBusStopMarkers();
  }
});
watch(() => props.lakeData, (lakes) => {
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
});
</script>
