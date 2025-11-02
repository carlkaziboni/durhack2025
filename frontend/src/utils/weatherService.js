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
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto`
      );
      const data = await res.json();
      
      // Check if forecast data exists
      if (data.daily && data.daily.time && data.daily.temperature_2m_min && data.daily.temperature_2m_max) {
        const target = data.daily.time.findIndex(d => d === eventDate.toISOString().split("T")[0]);
        if (target !== -1) {
          return {
            type: "forecast",
            min: data.daily.temperature_2m_min[target],
            max: data.daily.temperature_2m_max[target],
            precipitation: data.daily.precipitation_sum?.[target] || 0,
          };
        }
      }
    } catch (error) {
      console.warn("Forecast API failed, falling back to climate data:", error);
    }
  }

  // ✅ Otherwise → use climate normals
  try {
    const month = eventDate.getMonth() + 1;
    const res = await fetch(
      `https://climate-api.open-meteo.com/v1/climate?latitude=${lat}&longitude=${lon}&month=${month}&daily=temperature_2m_mean,precipitation_sum`
    );
    const climate = await res.json();
    
    // Check if climate data exists
    if (climate?.daily) {
      // Climate API returns arrays - take average or first value
      const tempValue = Array.isArray(climate.daily.temperature_2m_mean) 
        ? climate.daily.temperature_2m_mean[0] 
        : climate.daily.temperature_2m_mean;
      const precipValue = Array.isArray(climate.daily.precipitation_sum)
        ? climate.daily.precipitation_sum[0]
        : climate.daily.precipitation_sum;
      
      return {
        type: "climate",
        avgTemp: tempValue ?? null,
        precipitation: precipValue ?? null,
      };
    }
  } catch (error) {
    console.warn("Climate API failed:", error);
  }
  
  // Return null if both APIs fail
  return null;
}
