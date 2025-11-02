import { DateTime } from "luxon";

const cityTimeZones = {
  London: "Europe/London",
  Mumbai: "Asia/Kolkata",
  Dubai: "Asia/Dubai",
  Singapore: "Asia/Singapore",
  "Hong Kong": "Asia/Hong_Kong",
  Paris: "Europe/Paris",
  Zurich: "Europe/Zurich",
  Geneva: "Europe/Zurich",
  Aarhus: "Europe/Copenhagen",
  Sydney: "Australia/Sydney",
  Wroclaw: "Europe/Warsaw",
  Budapest: "Europe/Budapest",
  Shanghai: "Asia/Shanghai",
};

export function exportToCalendar(meetingResults, showSuccess, showError) {
  if (!meetingResults) {
    showError("No meeting data to export.");
    return;
  }

  const { event_location, event_dates } = meetingResults;
  const timeZone = cityTimeZones[event_location];

  if (!timeZone) {
    showError(`Missing timezone for event location: ${event_location}`);
    return;
  }

  // Interpret start/end as LOCAL to the event city
  const startLocal = DateTime.fromISO(event_dates.start, { zone: timeZone });
  const endLocal = DateTime.fromISO(event_dates.end, { zone: timeZone });

  if (!startLocal.isValid || !endLocal.isValid) {
    showError("Invalid meeting dates.");
    return;
  }

  // Format to YYYYMMDDTHHmmss in local time with no 'Z'
  const formatLocal = (dt) => dt.toFormat("yyyyMMdd'T'HHmmss");

  const icsContent = `
BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${Date.now()}@meetingplanner
DTSTAMP:${DateTime.utc().toFormat("yyyyMMdd'T'HHmmss'Z'")}
DTSTART;TZID=${timeZone}:${formatLocal(startLocal)}
DTEND;TZID=${timeZone}:${formatLocal(endLocal)}
SUMMARY:Global Meeting - ${event_location}
LOCATION:${event_location}
DESCRIPTION:Meeting time is based on ${event_location} local time (${timeZone}).
END:VEVENT
END:VCALENDAR
  `.trim();

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Meeting-${event_location}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showSuccess("📅 Calendar exported with proper timezone conversion!");
}
