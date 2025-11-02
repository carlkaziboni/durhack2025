export function generateMeetingEmail(meetingResults, weather, cityBriefing) {
  const start = new Date(meetingResults.event_dates.start).toLocaleString();
  const end = new Date(meetingResults.event_dates.end).toLocaleString();

  // ✅ Always show 0 instead of N/A when rainfall is 0
  const formatRainfall = (value) => {
    return value !== null && value !== undefined
      ? value.toFixed(1)
      : "N/A";
  };

  let weatherText = "No forecast available.";

  if (weather) {
    if (weather.type === "forecast") {
      weatherText = `Expected Temperature: ~${Math.round(weather.max)}°C
Rainfall: ${formatRainfall(weather.precipitation)} mm`;
    } else if (weather.type === "climate") {
      weatherText = `Typical Temperature: ~${Math.round(weather.avgTemp)}°C
Rainfall (avg): ${formatRainfall(weather.precipitation)} mm`;
    }
  }

  const cityText = cityBriefing
    ? `
🏙️ CITY OVERVIEW
${cityBriefing.summary || "No summary available."}
${
  cityBriefing.country
    ? `
- Region: ${cityBriefing.country.region}
- Languages: ${cityBriefing.country.languages}
- Currency: ${cityBriefing.country.currency}
${cityBriefing.country.visaNote ? `- Note: ${cityBriefing.country.visaNote}` : ""}`
    : ""
}`
    : "";

  return `
📍 MEETING DETAILS
- Location: ${meetingResults.event_location}
- Dates: ${start} – ${end}

🌦️ WEATHER OUTLOOK
${weatherText}

${cityText}

-----------------------------------
Automatically generated summary.
`;
}
