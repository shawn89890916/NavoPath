export type AiBriefKind = "start" | "review";

function timeMinutes(value: string | undefined, fallback: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || fallback);
  if (!match) return timeMinutes(fallback, "00:00");
  return Number(match[1]) * 60 + Number(match[2]);
}

export function nextDueAiBrief(input: {
  date: string;
  minutes: number;
  startTime?: string;
  endTime?: string;
  lastStartDate?: string;
  lastEndDate?: string;
}): AiBriefKind | null {
  if (input.minutes >= timeMinutes(input.startTime, "08:00") && input.lastStartDate !== input.date) return "start";
  if (input.minutes >= timeMinutes(input.endTime, "21:30") && input.lastEndDate !== input.date) return "review";
  return null;
}
