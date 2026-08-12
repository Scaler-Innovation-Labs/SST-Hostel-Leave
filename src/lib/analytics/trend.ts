export function fillDateRange(
  startDate: Date,
  endDate: Date,
  data: Array<{ date: string; count: number }>
): Array<{ date: string; value: number }> {
  const map = new Map(data.map((d) => [d.date, d.count]));
  const result: Array<{ date: string; value: number }> = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toISOString().slice(0, 10);
    result.push({ date: dateStr, value: map.get(dateStr) ?? 0 });
    current.setDate(current.getDate() + 1);
  }
  return result;
}