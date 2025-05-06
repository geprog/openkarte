<template>
  <div ref="map" class="absolute inset-0 z-0" />
</template>

<script setup lang="ts">
import type { MergedData } from '~/components/FetchOpenData';
import L, { Control } from 'leaflet';
import { onMounted, ref, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';

// Props
const props = defineProps<{
  waterBodies: MergedData[]
  featureDisplay: 'quality' | 'category' | 'depth' | 'seasonal' | 'infrastructure' | null
}>();
const markers: L.Layer[] = [];
let legendControl: L.Control | null = null;

const map = ref<HTMLDivElement | null>(null);

let leafletMap: L.Map | null = null;

function getColorByFeature(value: string, feature: string): string {
  const colorSets: Record<string, Record<string, string>> = {
    quality: {
      'ausgezeichnet (Überprüfung nur bei Änderung der Einstufung)': '#4CAF50',
      'gut (Überprüfung mindestens alle vier Jahre)': '#2196F3',
      'ausreichend (Überprüfung mindestens alle 3 J)': '#FFEB3B',
      'mangelhaft (Überprüfung mindestens alle 2 J)': '#F44336',
      'changes': '#FF9800',
      'neu': '#9C27B0',
      'ohne Bewertung': '#9E9E9E',
    },
    category: {
      Küstengewässer: '#4CAF50',
      Fließgewässer: '#2196F3',
      See: '#FFEB3B',
      Übergangsgewässer: '#F44336',
    },
    depth: {
    },
    seasonal: {
      'nicht geschlossen': '#4CAF50',
      'ganze Saison geschlossen': '#F44336',
    },
    infrastructure: {
      'Baden ohne Aufsicht': '#9E9E9E',
      'Baden m. zeitw. Aufsicht': '#607D8B',
      'Eintritt': '#795548',
      'Liegeplätze ohne Schatten': '#FFEB3B',
      'Liegeplätze mit Schatten': '#8BC34A',
      'Toiletten': '#03A9F4',
      'Dusche': '#00BCD4',
      'Umkleiden': '#009688',
      'Parken ohne Gebühren': '#CDDC39',
      'Parken mit Gebühren': '#FF9800',
      'Strandkorbverleih': '#FFC107',
      'Campingplatz': '#4CAF50',
      'Grillplatz': '#E91E63',
      'Spielplatz': '#F06292',
      'Gaststätte': '#3F51B5',
      'Kiosk': '#2196F3',
      'Rudern': '#6A1B9A',
      'Tretboot': '#BA68C8',
      'Surfen': '#00ACC1',
      'Segeln': '#1E88E5',
      'FKK-Strand': '#FF5722',
      'Hundestrand': '#A1887F',
      'WLAN': '#9C27B0',
      'ÖPNV': '#607D8B',
      'barrierefreier Zugang': '#00E676',
    },
  };

  return colorSets[feature]?.[value] || '#999999';
}

function createLegend(values: string[], feature: string) {
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
}

function renderMarkers(data: typeof props.waterBodies, feature: string) {
  clearMarkers();
  data.forEach((item) => {
    const lat = Number.parseFloat(item.bathing.GEOGR_BREITE);
    const lng = Number.parseFloat(item.bathing.GEOGR_LAENGE);
    const name = item.bathing.BADEGEWAESSERNAME;

    let value = '';
    switch (feature) {
      case 'quality':
        value = item.classification?.EINSTUFUNG_ODER_VORABBEWERTUNG || 'default';
        break;
      case 'category':
        value = item.measurements?.GEWAESSERKATEGORIE || 'default';
        break;
      case 'depth':
        value = item.measurements?.SICHTTIEFE || 'default';
        break;
      case 'seasonal':
        value = item.seasonal?.GESCHLOSSEN || 'default';
        break;
      case 'infrastructure':
        value = item.infrastructure?.INFRASTRUKTUR || 'default';
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
        .bindTooltip(`<strong>${name}</strong><br>${feature}: ${value}`, {
          sticky: true,
        });

      markers.push(marker);
    }
  });
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

  if (props.waterBodies.length > 0 && props.featureDisplay) {
    renderMarkers(props.waterBodies, props.featureDisplay);

    const legendValues = [
      ...new Set(
        props.waterBodies.map((item) => {
          switch (props.featureDisplay) {
            case 'quality':
              return item.classification?.EINSTUFUNG_ODER_VORABBEWERTUNG;
            case 'category':
              return item.measurements?.GEWAESSERKATEGORIE;
            case 'depth':
              return item.measurements?.SICHTTIEFE;
            case 'seasonal':
              return item.seasonal?.GESCHLOSSEN;
            case 'infrastructure':
              return item.infrastructure?.INFRASTRUKTUR;
            default:
              return undefined;
          }
        }).filter((v): v is string => v !== undefined),
      ),
    ];

    legendControl = createLegend(legendValues, props.featureDisplay);
    legendControl.addTo(leafletMap);
  }
});

watch(
  [() => props.waterBodies, () => props.featureDisplay],
  ([newData, newFeature]) => {
    if (leafletMap && Array.isArray(newData) && newData.length > 0 && newFeature) {
      renderMarkers(newData, newFeature);

      clearLegend();

      const legendValues = [
        ...new Set(
          newData.map((item) => {
            switch (newFeature) {
              case 'quality': return item.classification?.EINSTUFUNG_ODER_VORABBEWERTUNG;
              case 'category': return item.measurements?.GEWAESSERKATEGORIE;
              case 'depth': return item.measurements?.SICHTTIEFE;
              case 'seasonal': return item.seasonal?.GESCHLOSSEN;
              case 'infrastructure': return item.infrastructure?.INFRASTRUKTUR;
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
</script>
