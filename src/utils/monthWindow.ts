const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function addIsoDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return iso(date);
}

export function startOfCalendarWeek(value: string, weekStartsOn: 0 | 1 = 0) {
  const date = new Date(`${value}T00:00:00`);
  const offset = (date.getDay() - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - offset);
  return iso(date);
}

export function buildWeekWindow(anchor: string, before = 16, after = 24, weekStartsOn: 0 | 1 = 0) {
  const first = addIsoDays(startOfCalendarWeek(anchor, weekStartsOn), -before * 7);
  return Array.from({ length: before + after + 1 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addIsoDays(first, week * 7 + day)),
  );
}
