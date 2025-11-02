// ✅ No API keys needed
// Uses Open-Meteo free APIs

export async function getLatLonFromCity(city) {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    );
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return {
        lat: data.results[0].latitude,
        lon: data.results[0].longitude,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getWeatherForDate(lat, lon, eventDate) {
  const today = new Date();
  const diffDays = (eventDate - today) / (1000 * 60 * 60 * 24);

  // ✅ If within 7-day range → use real forecast
  if (diffDays >= 0 && diffDays <= 7) {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto`
    );
    const data = await res.json();
    const target = data.daily.time.findIndex(d => d === eventDate.toISOString().split("T")[0]);
    if (target !== -1) {
      return {
        type: "forecast",
        min: data.daily.temperature_2m_min[target],
        max: data.daily.temperature_2m_max[target],
        precipitation: data.daily.precipitation_sum[target],
      };
    }
  }

  // ✅ Otherwise → use climate normals
  const month = eventDate.getMonth() + 1;
  const res = await fetch(
    `https://climate-api.open-meteo.com/v1/climate?latitude=${lat}&longitude=${lon}&month=${month}&daily=temperature_2m_mean,precipitation_sum`
  );
  const climate = await res.json();
  return {
    type: "climate",
    avgTemp: climate?.daily?.temperature_2m_mean ?? null,
    precipitation: climate?.daily?.precipitation_sum ?? null,
  };
}
