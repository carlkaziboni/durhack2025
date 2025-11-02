import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { getLatLonFromCity, getWeatherForDate } from "./utils/weatherService";

const ExpandedView = ({ meetingResults, onClose }) => {
  if (!meetingResults) return null;

  const [weather, setWeather] = useState(null);

  // ✅ Weather fetch logic inside component (not at bottom or outside)
  useEffect(() => {
    async function fetchWeather() {
      const city = meetingResults.event_location;
      const eventDate = new Date(meetingResults.event_dates.start);

      const coords = await getLatLonFromCity(city);
      if (!coords) return;

      const weatherData = await getWeatherForDate(
        coords.lat,
        coords.lon,
        eventDate
      );
      setWeather(weatherData);
    }
    fetchWeather();
  }, [meetingResults]);

  return createPortal(
    <div className="fixed inset-0 bg-[var(--bg)] z-[10000] w-screen h-screen overflow-auto">
      {/* ... your existing content ... */}

      {/* ✅ Inject weather inside the location or date section */}
      {weather && (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4 mt-4">
          <h4 className="text-[var(--muted)] text-xs uppercase font-medium mb-2">Weather</h4>
          {weather.type === "forecast" ? (
            <p className="text-sm text-[var(--text)]">
              {weather.min}°C to {weather.max}°C, {weather.precipitation}mm rain forecast
            </p>
          ) : (
            <p className="text-sm text-[var(--text)]">
              Typical: ~{weather.avgTemp}°C, {weather.precipitation}mm average rainfall
            </p>
          )}
        </div>
      )}
    </div>,
    document.body
  );
};

// ✅ Export must be the *last line*, outside component
export default ExpandedView;
