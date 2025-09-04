const yearColors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

export function getDatesGroups(fetchedData: FeatureCollection[]) {
  const groupedDates = computed(() => {
    const yearGroups = new Map<string, string[]>();
    fetchedData
      .filter((item): item is FeatureCollection & { date: string } => !!item.date)
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

export function getDateOptions(fetchedData: FeatureCollection[]): string[] {
  return fetchedData
    .map(o => o.date)
    .filter((d): d is string => d !== undefined);
}
