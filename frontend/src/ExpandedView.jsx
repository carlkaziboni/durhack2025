import { createPortal } from "react-dom";

const ExpandedView = ({ meetingResults, onClose }) => {
  if (!meetingResults) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "var(--bg)",
        zIndex: 10000,
        width: "100vw",
        height: "100vh",
        overflow: "auto",
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          backgroundColor: "var(--panel)",
          borderBottom: "1px solid var(--border)",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 100,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "var(--text)",
            fontSize: "1.5rem",
            fontWeight: 600,
          }}
        >
          📍 Extended Location Details
        </h2>
        <button
          onClick={onClose}
          style={{
            backgroundColor: "var(--bad)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: 600,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => (e.target.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.target.style.opacity = "1")}
        >
          Close ×
        </button>
      </div>

      {/* Content Container */}
      <div
        style={{ padding: "40px 24px", maxWidth: "1400px", margin: "0 auto" }}
      >
        {/* Hero Section */}
        <div
          style={{
            backgroundColor: "var(--card)",
            border: "2px solid var(--accent)",
            borderRadius: "20px",
            padding: "32px",
            marginBottom: "32px",
            textAlign: "center",
            boxShadow: "0 8px 24px rgba(122, 162, 255, 0.2)",
          }}
        >
          <h3
            style={{
              margin: "0 0 16px 0",
              color: "var(--accent)",
              fontSize: "1.8rem",
            }}
          >
            {meetingResults.event_location}
          </h3>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "1.1rem" }}>
            Selected as the optimal meeting location
          </p>
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "24px",
            marginBottom: "32px",
          }}
        >
          {/* Event Dates Card */}
          <div
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
            }}
          >
            <h4
              style={{
                color: "var(--muted)",
                fontSize: "0.9rem",
                margin: "0 0 16px 0",
                fontWeight: 600,
              }}
            >
              📅 EVENT DATES
            </h4>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                  Start:
                </span>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>
                  {new Date(
                    meetingResults.event_dates.start
                  ).toLocaleDateString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                  Time:
                </span>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>
                  {new Date(
                    meetingResults.event_dates.start
                  ).toLocaleTimeString()}
                </span>
              </div>
              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid var(--border)",
                  margin: "8px 0",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                  End:
                </span>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>
                  {new Date(
                    meetingResults.event_dates.end
                  ).toLocaleDateString()}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                  Time:
                </span>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>
                  {new Date(
                    meetingResults.event_dates.end
                  ).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>

          {/* CO2 Emissions Card */}
          <div
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
            }}
          >
            <h4
              style={{
                color: "var(--muted)",
                fontSize: "0.9rem",
                margin: "0 0 16px 0",
                fontWeight: 600,
              }}
            >
              🌍 TOTAL CO₂ EMISSIONS
            </h4>
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 700,
                  color: "var(--bad)",
                  marginBottom: "8px",
                }}
              >
                {meetingResults.total_co2}
              </div>
              <div style={{ fontSize: "1.2rem", color: "var(--text)" }}>
                kg CO₂
              </div>
            </div>
          </div>

          {/* Average Travel Time Card */}
          <div
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
            }}
          >
            <h4
              style={{
                color: "var(--muted)",
                fontSize: "0.9rem",
                margin: "0 0 16px 0",
                fontWeight: 600,
              }}
            >
              ✈️ AVERAGE TRAVEL TIME
            </h4>
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 700,
                  color: "var(--accent)",
                  marginBottom: "8px",
                }}
              >
                {meetingResults.average_travel_hours}
              </div>
              <div style={{ fontSize: "1.2rem", color: "var(--text)" }}>
                hours
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Statistics */}
        <div
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
            marginBottom: "32px",
          }}
        >
          <h4
            style={{
              color: "var(--muted)",
              fontSize: "0.9rem",
              margin: "0 0 20px 0",
              fontWeight: 600,
            }}
          >
            📊 TRAVEL TIME STATISTICS
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "20px",
            }}
          >
            <div
              style={{
                textAlign: "center",
                padding: "16px",
                backgroundColor: "var(--bg)",
                borderRadius: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--accent)",
                  marginBottom: "4px",
                }}
              >
                {meetingResults.median_travel_hours}
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                }}
              >
                Median
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                padding: "16px",
                backgroundColor: "var(--bg)",
                borderRadius: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--good)",
                  marginBottom: "4px",
                }}
              >
                {meetingResults.min_travel_hours}
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                }}
              >
                Minimum
              </div>
            </div>
            <div
              style={{
                textAlign: "center",
                padding: "16px",
                backgroundColor: "var(--bg)",
                borderRadius: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--bad)",
                  marginBottom: "4px",
                }}
              >
                {meetingResults.max_travel_hours}
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                }}
              >
                Maximum
              </div>
            </div>
          </div>
        </div>

        {/* Per-City Travel Hours */}
        <div
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
          }}
        >
          <h4
            style={{
              color: "var(--muted)",
              fontSize: "0.9rem",
              margin: "0 0 20px 0",
              fontWeight: 600,
            }}
          >
            🛫 TRAVEL HOURS BY CITY
          </h4>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {Object.entries(meetingResults.attendee_travel_hours).map(
              ([city, hours]) => (
                <div
                  key={city}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 20px",
                    backgroundColor: "var(--bg)",
                    borderRadius: "12px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--panel)";
                    e.currentTarget.style.transform = "translateX(4px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--bg)";
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                >
                  <span
                    style={{
                      color: "var(--text)",
                      fontSize: "1.1rem",
                      fontWeight: 500,
                    }}
                  >
                    {city}
                  </span>
                  <span
                    style={{
                      color: "var(--accent)",
                      fontSize: "1.2rem",
                      fontWeight: 700,
                      backgroundColor: "rgba(122, 162, 255, 0.1)",
                      padding: "6px 16px",
                      borderRadius: "8px",
                    }}
                  >
                    {hours} hrs
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
