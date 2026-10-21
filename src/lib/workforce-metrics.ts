export function calculateTurnover(start: number, hires: number, departures: number) {
  if (
    ![start, hires, departures].every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 10000000,
    )
  )
    return null;
  const end = start + hires - departures;
  if (end < 0) return null;
  const average = (start + end) / 2;
  return { end, average, rate: average > 0 ? (departures / average) * 100 : null };
}
