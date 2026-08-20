export interface ParsedCalendarOccurrence {
  external_uid: string;
  recurrence_id: string;
  title: string;
  description: string;
  location: string;
  start_at: string;
  end_at: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  status: string;
}

type ExpanderModule = { default?: new (options: { ics: string; maxIterations: number }) => any } | (new (options: { ics: string; maxIterations: number }) => any);

async function loadExpander() {
  const runningInDeno = typeof (globalThis as { Deno?: unknown }).Deno !== "undefined";
  const module = runningInDeno
    ? await import("npm:ical-expander@3.2.0") as ExpanderModule
    : await import("ical-expander") as ExpanderModule;
  return (typeof module === "function" ? module : module.default) as new (options: { ics: string; maxIterations: number }) => any;
}

function cleanText(value: unknown, max: number, fallback = "") {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : fallback;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function componentDate(value: any, fallback: Date) {
  if (Number.isInteger(value?.year) && Number.isInteger(value?.month) && Number.isInteger(value?.day)) {
    return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
  }
  return dateOnly(fallback);
}

function mapEvent(event: any, startDate = event.startDate, endDate = event.endDate, recurrenceId = ""): ParsedCalendarOccurrence | null {
  const start = startDate?.toJSDate?.();
  const end = endDate?.toJSDate?.();
  if (!(start instanceof Date) || !(end instanceof Date) || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return null;
  const component = event.component;
  const status = cleanText(component?.getFirstPropertyValue?.("status"), 30, "confirmed").toLowerCase();
  if (status === "cancelled") return null;
  const uid = cleanText(event.uid || component?.getFirstPropertyValue?.("uid"), 500);
  if (!uid) return null;
  const allDay = Boolean(startDate?.isDate);
  const inclusiveEnd = new Date(Date.UTC(endDate?.year || end.getUTCFullYear(), (endDate?.month || end.getUTCMonth() + 1) - 1, endDate?.day || end.getUTCDate()));
  if (allDay) inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() - 1);
  return {
    external_uid: uid,
    recurrence_id: recurrenceId,
    title: cleanText(event.summary, 500, "Busy"),
    description: cleanText(event.description, 10_000),
    location: cleanText(event.location, 2_000),
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    start_date: componentDate(startDate, start),
    end_date: allDay ? dateOnly(inclusiveEnd) : componentDate(endDate, new Date(Math.max(start.getTime(), end.getTime() - 1))),
    all_day: allDay,
    status,
  };
}

export async function parseIcsOccurrences(ics: string, after: Date, before: Date, maxIterations = 10_000): Promise<ParsedCalendarOccurrence[]> {
  if (!ics.includes("BEGIN:VCALENDAR")) throw new Error("Invalid iCalendar document");
  const IcalExpander = await loadExpander();
  const expanded = new IcalExpander({ ics, maxIterations }).between(after, before);
  const direct = expanded.events.map((event: any) => mapEvent(event));
  const recurring = expanded.occurrences.map((occurrence: any) => mapEvent(
    occurrence.item,
    occurrence.startDate,
    occurrence.endDate,
    occurrence.recurrenceId?.toString?.() || occurrence.startDate?.toString?.() || "",
  ));
  const deduped = new Map<string, ParsedCalendarOccurrence>();
  for (const occurrence of [...direct, ...recurring]) {
    if (!occurrence) continue;
    deduped.set(`${occurrence.external_uid}|${occurrence.recurrence_id}|${occurrence.start_at}`, occurrence);
    if (deduped.size >= 5_000) break;
  }
  return Array.from(deduped.values()).sort((a, b) => a.start_at.localeCompare(b.start_at));
}
