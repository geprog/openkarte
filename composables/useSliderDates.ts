let globalMinDate: Date | null = null;
let globalMaxDate: Date | null = null;
export const selectedLakeDateIndex = ref(0);
export const selectedLakeDate = ref('');
export const lakeDateOptions = ref<Date[]>([]);

export function setLakeDepth() {
  if (!lakeData.value) {
    return;
  }
  lakeData.value.forEach((feature) => {
    if (Array.isArray(feature.properties.lakeDepth) && feature.properties.lakeDepth.length > 0) {
      const dates = feature.properties.lakeDepth
        .map((entry) => {
          const [datePart] = entry.Zeit.split(' ');
          const parsedDate = new Date(datePart);
          return parsedDate.getTime();
        });
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        if (!globalMinDate || minDate < globalMinDate)
          globalMinDate = minDate;
        if (!globalMaxDate || maxDate > globalMaxDate)
          globalMaxDate = maxDate;
      }
    }
  });
  // globalMinDate.setFullYear(globalMinDate.getFullYear() + 1);
  // globalMinDate.setDate(globalMinDate.getDate() + 1);
  // globalMaxDate.setDate(globalMaxDate.getDate() + 1);
  // console.log(globalMinDate,globalMaxDate)
  if (globalMinDate && globalMaxDate) {
    const dates = [];
    const min = new Date(
      globalMinDate.getFullYear(),
      globalMinDate.getMonth(),
      globalMinDate.getDate(),
    );

    const max = new Date(
      globalMaxDate.getFullYear(),
      globalMaxDate.getMonth(),
      globalMaxDate.getDate(),
    );
    const current = new Date(min);
    // eslint-disable-next-line no-unmodified-loop-condition
    while (current <= max) {
      dates.push(new Date(current.getFullYear(), current.getMonth(), current.getDate()));
      current.setDate(current.getDate() + 1);
    }
    lakeDateOptions.value = dates;
    selectedLakeDateIndex.value = dates.length - 1;
  }
  else {
    lakeDateOptions.value = [];
    selectedLakeDateIndex.value = 0;
  }
  selectedLakeDate.value = lakeDateOptions.value[selectedLakeDateIndex.value]?.toLocaleDateString('en-CA') || '';
}
