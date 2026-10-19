export const analysisLevels = [
  { value: 150, name: 'Rápido', time: '150 ms' },
  { value: 500, name: 'Normal', time: '500 ms' },
  { value: 2000, name: 'Profundo', time: '2 s' },
  { value: 5000, name: 'Máximo', time: '5 s' },
];

export function analysisLevelLabel(movetime: number) {
  const level = analysisLevels.find((level) => level.value === movetime);
  return level ? `${level.name} (${level.time})` : `Personal (${movetime} ms)`;
}

export function analysisLevelName(movetime: number) {
  return analysisLevels.find((level) => level.value === movetime)?.name ?? 'Personal';
}

export function availableAnalysisLevels(...times: number[]) {
  return [
    ...analysisLevels,
    ...[...new Set(times)]
      .filter((value) => !analysisLevels.some((level) => level.value === value))
      .map((value) => ({ value, name: 'Personal', time: `${value} ms` })),
  ];
}
