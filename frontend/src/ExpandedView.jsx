import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { getLatLonFromCity, getWeatherForDate } from "./utils/weatherService";

const ExpandedView = ({ meetingResults, onClose }) => {
  if (!meetingResults) return null;

  const [weather, setWeather] = useState(null);

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
      {/* Header Bar */}
      <div className="sticky top-0 bg-[var(--panel)] border-b border-[var(--border)] px-6 py-5 flex justify-between items-center z-[100] shadow-sm">
        <h2 className="m-0 text-[var(--text)] text-xl font-semibold">
          Location Details
        </h2>
        <button
          onClick={onClose}
          className="border border-[var(--border)] bg-transparent text-[var(--text)] rounded px-4 py-2 cursor-pointer text-sm font-medium transition-colors hover:bg-[var(--card)]"
        >
          Close
        </button>
      </div>

      {/* Content Container */}
      <div className="px-6 py-8 max-w-[1200px] mx-auto">
        {/* Hero Section */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 mb-6">
          <h3 className="m-0 mb-2 text-[var(--accent)] text-2xl font-semibold">
            {meetingResults.event_location}
          </h3>
          <p className="m-0 text-[var(--muted)] text-sm">
            Optimal meeting location
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4 mb-6">
          {/* Event Dates Card */}
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
            <h4 className="text-[var(--muted)] text-xs uppercase tracking-wide m-0 mb-3 font-medium">
              Dates
            </h4>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Start:</span>
                <span className="text-[var(--text)] font-medium">
                  {new Date(
                    meetingResults.event_dates.start
                  ).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">End:</span>
                <span className="text-[var(--text)] font-medium">
                  {new Date(
                    meetingResults.event_dates.end
                  ).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* CO2 Emissions Card */}
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
            <h4 className="text-[var(--muted)] text-xs uppercase tracking-wide m-0 mb-3 font-medium">
              Emissions
            </h4>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400 mb-1">
                {meetingResults.total_co2}
              </div>
              <div className="text-xs text-[var(--muted)]">kg CO₂</div>
            </div>
          </div>

          {/* Average Travel Time Card */}
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
            <h4 className="text-[var(--muted)] text-xs uppercase tracking-wide m-0 mb-3 font-medium">
              Avg Travel
            </h4>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--accent)] mb-1">
                {meetingResults.average_travel_hours}
              </div>
              <div className="text-xs text-[var(--muted)]">hours</div>
            </div>
          </div>

          {/* Weather Card */}
          {weather && (
            <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
              <h4 className="text-[var(--muted)] text-xs uppercase tracking-wide m-0 mb-3 font-medium">
                Weather
              </h4>
              <div className="text-center">
                {weather.type === "forecast" ? (
                  <div>
                    <div className="text-2xl font-bold text-cyan-400 mb-1">
                      {Math.round(weather.min)}° - {Math.round(weather.max)}°
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {weather.precipitation?.toFixed(1) || "0"}mm forecast
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-2xl font-bold text-cyan-400 mb-1">
                      ~{Math.round(weather.avgTemp)}°C
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {weather.precipitation?.toFixed(1) || "N/A"}mm avg
                      rainfall
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Detailed Statistics */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-5 mb-6">
          <h4 className="text-[var(--muted)] text-xs uppercase tracking-wide m-0 mb-4 font-medium">
            Travel Statistics
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-[var(--panel)] rounded">
              <div className="text-xl font-bold text-[var(--accent)] mb-1">
                {meetingResults.median_travel_hours}
              </div>
              <div className="text-xs text-[var(--muted)] uppercase">
                Median
              </div>
            </div>
            <div className="text-center p-3 bg-[var(--panel)] rounded">
              <div className="text-xl font-bold text-emerald-400 mb-1">
                {meetingResults.min_travel_hours}
              </div>
              <div className="text-xs text-[var(--muted)] uppercase">
                Minimum
              </div>
            </div>
            <div className="text-center p-3 bg-[var(--panel)] rounded">
              <div className="text-xl font-bold text-amber-400 mb-1">
                {meetingResults.max_travel_hours}
              </div>
              <div className="text-xs text-[var(--muted)] uppercase">
                Maximum
              </div>
            </div>
          </div>
        </div>

        {/* Per-City Travel Hours */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-5">
          <h4 className="text-[var(--muted)] text-xs uppercase tracking-wide m-0 mb-4 font-medium">
            By Location
          </h4>
          <div className="flex flex-col gap-2">
            {Object.entries(meetingResults.attendee_travel_hours).map(
              ([city, hours]) => (
                <div
                  key={city}
                  className="flex justify-between items-center px-4 py-2.5 bg-[var(--panel)] rounded transition-colors hover:bg-[var(--accent)]/5"
                >
                  <span className="text-sm text-[var(--text)] font-medium">
                    {city}
                  </span>
                  <span className="text-sm text-[var(--accent)] font-semibold">
                    {hours}h
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ExpandedView;
