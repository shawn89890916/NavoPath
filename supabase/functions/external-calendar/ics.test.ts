import test from "node:test";
import assert from "node:assert/strict";
import { parseIcsOccurrences } from "./ics.ts";

const header = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//NavoPath Test//EN\r\n";
const footer = "END:VCALENDAR\r\n";

test("parses timed, all-day, recurring, excluded, and cross-day events", async () => {
  const ics = `${header}BEGIN:VEVENT\r\nUID:timed\r\nDTSTART:20260820T090000Z\r\nDTEND:20260820T100000Z\r\nSUMMARY:Physics lesson\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:allday\r\nDTSTART;VALUE=DATE:20260821\r\nDTEND;VALUE=DATE:20260822\r\nSUMMARY:Exam day\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:repeat\r\nDTSTART:20260820T120000Z\r\nDTEND:20260820T130000Z\r\nRRULE:FREQ=DAILY;COUNT=3\r\nEXDATE:20260821T120000Z\r\nSUMMARY:Practice\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:cross\r\nDTSTART:20260822T230000Z\r\nDTEND:20260823T010000Z\r\nSUMMARY:Travel\r\nEND:VEVENT\r\n${footer}`;
  const events = await parseIcsOccurrences(ics, new Date("2026-08-19T00:00:00Z"), new Date("2026-08-25T00:00:00Z"));
  assert.equal(events.filter((event) => event.external_uid === "repeat").length, 2);
  assert.equal(events.find((event) => event.external_uid === "allday")?.all_day, true);
  assert.equal(events.find((event) => event.external_uid === "cross")?.end_date, "2026-08-23");
});

test("rejects malformed input and omits cancelled events", async () => {
  await assert.rejects(() => parseIcsOccurrences("not a calendar", new Date(), new Date(Date.now() + 86_400_000)));
  const events = await parseIcsOccurrences(`${header}BEGIN:VEVENT\r\nUID:gone\r\nDTSTART:20260820T090000Z\r\nDTEND:20260820T100000Z\r\nSTATUS:CANCELLED\r\nEND:VEVENT\r\n${footer}`, new Date("2026-08-19"), new Date("2026-08-21"));
  assert.equal(events.length, 0);
});

test("applies recurrence overrides and cancelled instances", async () => {
  const ics = `${header}BEGIN:VEVENT\r\nUID:series\r\nDTSTART:20260820T090000Z\r\nDTEND:20260820T100000Z\r\nRRULE:FREQ=DAILY;COUNT=3\r\nSUMMARY:Original\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:series\r\nRECURRENCE-ID:20260821T090000Z\r\nDTSTART:20260821T090000Z\r\nDTEND:20260821T100000Z\r\nSTATUS:CANCELLED\r\nSUMMARY:Cancelled\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:series\r\nRECURRENCE-ID:20260822T090000Z\r\nDTSTART:20260822T110000Z\r\nDTEND:20260822T120000Z\r\nSUMMARY:Moved\r\nEND:VEVENT\r\n${footer}`;
  const events = await parseIcsOccurrences(ics, new Date("2026-08-19T00:00:00Z"), new Date("2026-08-24T00:00:00Z"));
  assert.equal(events.some((event) => event.title === "Cancelled"), false);
  assert.equal(events.some((event) => event.title === "Moved" && event.start_at === "2026-08-22T11:00:00.000Z"), true);
});

test("keeps all-day source dates stable across timezone offsets", async () => {
  const ics = `${header}BEGIN:VEVENT\r\nUID:all-day-range\r\nDTSTART;VALUE=DATE:20261101\r\nDTEND;VALUE=DATE:20261103\r\nSUMMARY:DST weekend\r\nEND:VEVENT\r\n${footer}`;
  const [event] = await parseIcsOccurrences(ics, new Date("2026-10-30T00:00:00Z"), new Date("2026-11-05T00:00:00Z"));
  assert.equal(event.start_date, "2026-11-01");
  assert.equal(event.end_date, "2026-11-02");
});
