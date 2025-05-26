const yearColors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

export function getDatesGroups(fetchedData: any) {
  const groupedDates = computed(() => {
    const yearGroups = new Map<string, string[]>();
    fetchedData.forEach((date: any) => {
      const year = date.date.slice(0, 4);
      if (!yearGroups.has(year)) {
        yearGroups.set(year, []);
      }
      yearGroups.get(year)!.push(date.date);
    });
    const total = fetchedData.length;
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
  return groupedDates;
}

export function getDateOptions(fetchedData: any) {
  const options = fetchedData.map((o: any) => o.date);
  return options;
}
