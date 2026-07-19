type Json = Record<string, any>;

export type CalendarFeedData = {
  tasks?: Json[];
  events?: Json[];
  projects?: Json[];
};

function escapeText(value: unknown) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldLine(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let limit = 75;
  for (const character of line) {
    if (encoder.encode(current + character).length > limit && current) {
      parts.push(current);
      current = ` ${character}`;
      limit = 75;
    } else {
      current += character;
    }
  }
  parts.push(current);
  return parts.join("\r\n");
}

function compactDate(value: unknown) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}${match[2]}${match[3]}` : "";
}

function compactTime(value: unknown) {
  const match = String(value ?? "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1]}${match[2]}00` : "";
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function utcStamp(value: unknown, fallback: Date) {
  const date = new Date(String(value ?? ""));
  const safe = Number.isNaN(date.getTime()) ? fallback : date;
  return safe.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function projectDescription(item: Json, projects: Json[]) {
  const project = projects.find((candidate) => candidate.id === item.projectId);
  return [project?.title ? `Project: ${project.title}` : "", item.notes || item.details || ""]
    .filter(Boolean)
    .join("\n");
}

function eventLines({ uid, title, description, startDate, startTime, endDate, endTime, createdAt, updatedAt, transparent = false }: {
  uid: string;
  title: unknown;
  description?: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  transparent?: boolean;
}, generatedAt: Date) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeText(uid)}`,
    `DTSTAMP:${utcStamp(updatedAt || createdAt, generatedAt)}`,
    `CREATED:${utcStamp(createdAt, generatedAt)}`,
    `LAST-MODIFIED:${utcStamp(updatedAt || createdAt, generatedAt)}`,
    `SUMMARY:${escapeText(title)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);

  const compactStartDate = compactDate(startDate);
  const compactStartTime = compactTime(startTime);
  const compactEndTime = compactTime(endTime);
  if (compactStartDate && compactStartTime && compactEndTime) {
    let resolvedEndDate = compactDate(endDate) ? endDate! : startDate;
    if (!endDate && compactEndTime <= compactStartTime) resolvedEndDate = nextDate(startDate);
    lines.push(`DTSTART:${compactStartDate}T${compactStartTime}`);
    lines.push(`DTEND:${compactDate(resolvedEndDate)}T${compactEndTime}`);
  } else {
    const resolvedEndDate = nextDate(compactDate(endDate) ? endDate! : startDate);
    lines.push(`DTSTART;VALUE=DATE:${compactStartDate}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(resolvedEndDate)}`);
  }
  if (transparent) lines.push("TRANSP:TRANSPARENT");
  lines.push("END:VEVENT");
  return lines;
}

export function buildCalendarFeed(data: CalendarFeedData, generatedAt = new Date()) {
  const projects = data.projects || [];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NavoPath//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:NavoPath",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
  ];

  for (const task of data.tasks || []) {
    const records = (task.timelineRecords || []).filter((record: Json) => record.executionStatus !== "cancelled");
    for (const record of records) {
      if (!compactDate(record.scheduledDate) || !compactTime(record.scheduledStart) || !compactTime(record.scheduledEnd)) continue;
      lines.push(...eventLines({
        uid: `task-${task.id}-${record.id}@navopath.app`,
        title: task.title,
        description: projectDescription(task, projects),
        startDate: record.scheduledDate,
        startTime: record.scheduledStart,
        endDate: record.scheduledEndDate,
        endTime: record.scheduledEnd,
        createdAt: record.createdAt || task.createdAt,
        updatedAt: task.updatedAt,
      }, generatedAt));
    }
    if (!task.completed && compactDate(task.dueDate) && records.length === 0) {
      lines.push(...eventLines({
        uid: `task-${task.id}-due@navopath.app`,
        title: task.title,
        description: projectDescription(task, projects),
        startDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        transparent: true,
      }, generatedAt));
    }
  }

  for (const event of data.events || []) {
    const startDate = event.startDate || event.date;
    if (!compactDate(startDate)) continue;
    lines.push(...eventLines({
      uid: `event-${event.id}@navopath.app`,
      title: event.title,
      description: projectDescription(event, projects),
      startDate,
      startTime: event.startTime,
      endDate: event.endDate,
      endTime: event.endTime,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt || event.createdAt,
    }, generatedAt));
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
