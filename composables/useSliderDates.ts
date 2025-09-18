const yearColors = [
  '#3B82F6', // blue
  '#10B981', // green
  '#8B5CF6', // purple
  '#F59E0B', // amber (still warm, but not red)
  '#0D9488', // teal (replaces red) 
];

function isFeatureCollectionWithDate(item: GeoJSON.FeatureCollection): item is GeoJSON.FeatureCollection & { date: string } {
  return (item as GeoJSON.FeatureCollection & { date: string }).date !== undefined;
}

export function getDatesGroups(fetchedData: GeoJSON.FeatureCollection[]) {
  const groupedDates = computed(() => {
    const yearGroups = new Map<string, string[]>();
    fetchedData
      .filter(isFeatureCollectionWithDate)
      .forEach((item) => {
        const year = item.date.slice(0, 4);
        if (!yearGroups.has(year)) {
          yearGroups.set(year, []);
        }
        yearGroups.get(year)!.push(item.date);
      });

    const total = Array.from(yearGroups.values()).reduce((acc, arr) => acc + arr.length, 0);
    let offset = 0;

    return Array.from(yearGroups.entries()).map(([year, dates], i) => {
      const width = (dates.length / total) * 100;
      const group = {
        year,
        width: width.toFixed(2),
        offset: offset.toFixed(2),
        color: yearColors[i % yearColors.length],
      };
      offset += width;
      return group;
    });
  });

  return groupedDates.value;
}

export function getDateOptions(fetchedData: GeoJSON.FeatureCollection[]): string[] {
  return fetchedData
    .filter(isFeatureCollectionWithDate)
    .map(o => o.date);
}
