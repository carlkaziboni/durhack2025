import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "./index.css";

// Set your Cesium Ion access token (optional)
// You can get a free token at https://cesium.com/ion/
// If you have a valid token, uncomment and replace with your actual token
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyYzE2YmMyOC1hMTNmLTQzYjctODBmZC1lZDRiZDhjYzM1ZmUiLCJpZCI6MzU2MDk4LCJpYXQiOjE3NjIwMDk3ODF9._fMwQeDx3Q_E2Ge-5bqrpn0ZG9NcTSmiddwHonL7M90E";

// Office locations data (defined outside component to avoid recreation)
const officeLocations = [
  {
    city: "London",
    lon: -0.14,
    lat: 51.49,
    address: "9 Bressenden Place, London SW1E 5BY",
  },
  {
    city: "Paris",
    lon: 2.31,
    lat: 48.87,
    address: "32 rue de Monceau, 75008 Paris, France",
  },
  {
    city: "Hong Kong",
    lon: 114.16,
    lat: 22.28,
    address: "25/F Central Tower, 28 Queen's Road Central, HK",
  },
  {
    city: "Singapore",
    lon: 103.85,
    lat: 1.28,
    address:
      "2 Central Boulevard West Tower #47-01, IOI Central Boulevard Towers, Singapore 018916",
  },
  {
    city: "Mumbai",
    lon: 72.92,
    lat: 19.09,
    address:
      "8A, 8th floor Godrej one, Pirojshanagar, Eastern Express Highway, Vikhroli East, Mumbai 400 079, Maharashtra, India",
  },
  {
    city: "Dubai",
    lon: 55.28,
    lat: 25.21,
    address:
      "Unit 1801, Level 18, East Entrance, Index Tower, Dubai International Financial Centre Dubai, UAE",
  },
  {
    city: "Shanghai",
    lon: 121.5,
    lat: 31.23,
    address:
      "Units 4301-06&16, Two IFC, Shanghai IFC, No.8 Century Avenue, Pudong New District, Shanghai, 200120, PRC",
  },
  {
    city: "Zurich",
    lon: 8.53,
    lat: 47.36,
    address: "Brandschenkestrasse 5, 8001 Zürich",
  },
  {
    city: "Geneva",
    lon: 6.15,
    lat: 46.2,
    address: "Cours de Rive 10, 1204 Geneva",
  },
  {
    city: "Aarhus",
    lon: 10.2,
    lat: 56.15,
    address: "Søendergade 45, 8000 Aarhus C, Denmark",
  },
  {
    city: "Sydney",
    lon: 151.21,
    lat: -33.86,
    address:
      "Aurora Place, Level 24, 88 Phillip Street, Sydney NSW 2000, Australia",
  },
  {
    city: "Wroclaw",
    lon: 17.01,
    lat: 51.11,
    address:
      "Infinity Building, 5th Floor, ul. Legnicka 16, 53-673 Wrocław, Poland",
  },
  {
    city: "Budapest",
    lon: 19.06,
    lat: 47.52,
    address:
      "H2Offices building, 2nd floor, Váci út 23-27., Budapest 1134, Hungary",
  },
];

function App() {
  const cesiumContainerRef = useRef(null);
  const viewerRef = useRef(null);
  const flightPathsRef = useRef([]);
  const planeEntityRef = useRef(null);
  const officeEntitiesRef = useRef([]);

  // Meeting planning state
  const [cities, setCities] = useState([
    { id: Date.now(), city: "", attendees: 1 },
  ]);
  const [availabilityStart, setAvailabilityStart] = useState("");
  const [availabilityEnd, setAvailabilityEnd] = useState("");
  const [eventDurationDays, setEventDurationDays] = useState(0);
  const [eventDurationHours, setEventDurationHours] = useState(4);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Function to add office location markers
  const addOfficeMarkers = () => {
    if (!viewerRef.current) return;

    // Destroy existing handler if it exists
    if (viewerRef.current._officeHandler) {
      viewerRef.current._officeHandler.destroy();
      viewerRef.current._officeHandler = null;
    }

    // Clear existing office markers
    officeEntitiesRef.current.forEach((entity) => {
      viewerRef.current.entities.remove(entity);
    });
    officeEntitiesRef.current = [];

    officeLocations.forEach((office) => {
      const entity = viewerRef.current.entities.add({
        name: office.city,
        position: Cesium.Cartesian3.fromDegrees(office.lon, office.lat, 0),
        point: {
          pixelSize: 18,
          color: Cesium.Color.BLUE,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.5, 1.5e7, 0.5),
        },
        label: {
          text: office.city,
          font: "12pt sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -30),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          show: false, // Hidden by default, shown on hover
          scale: 0.8,
        },
        description: office.address, // Full address in description
      });

      officeEntitiesRef.current.push(entity);
    });

    // Add hover event handlers to show/hide labels
    const handler = new Cesium.ScreenSpaceEventHandler(
      viewerRef.current.scene.canvas
    );

    handler.setInputAction((movement) => {
      const pickedObject = viewerRef.current.scene.pick(movement.endPosition);
      if (pickedObject && Cesium.defined(pickedObject.id)) {
        // Show label for hovered entity
        officeEntitiesRef.current.forEach((entity) => {
          if (entity === pickedObject.id) {
            entity.label.show = true;
          } else {
            entity.label.show = false;
          }
        });
      } else {
        // Hide all labels when not hovering
        officeEntitiesRef.current.forEach((entity) => {
          entity.label.show = false;
        });
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Store handler for cleanup
    viewerRef.current._officeHandler = handler;
  };

  // Initialize Cesium Viewer
  useEffect(() => {
    if (!cesiumContainerRef.current || viewerRef.current) return;

    // Use EllipsoidTerrainProvider which doesn't require Ion token
    // This provides a smooth ellipsoid (no terrain elevation)
    viewerRef.current = new Cesium.Viewer(cesiumContainerRef.current, {
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      animation: true,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      vrButton: false,
    });

    // Use OpenStreetMap imagery which doesn't require Ion token
    try {
      const osmImagery = new Cesium.OpenStreetMapImageryProvider({
        url: "https://a.tile.openstreetmap.org/",
      });
      viewerRef.current.imageryLayers.removeAll();
      viewerRef.current.imageryLayers.addImageryProvider(osmImagery);
    } catch (error) {
      console.warn("Could not set OpenStreetMap imagery, using default");
    }

    // Add office location markers
    addOfficeMarkers();

    // Cleanup function
    return () => {
      if (viewerRef.current) {
        // Clean up office markers handler
        if (viewerRef.current._officeHandler) {
          viewerRef.current._officeHandler.destroy();
          viewerRef.current._officeHandler = null;
        }
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Function to create a curved arc with intermediate points
  const createCurvedPath = (
    startLon,
    startLat,
    endLon,
    endLat,
    height = 200000,
    numPoints = 100
  ) => {
    const positions = [];
    const start = Cesium.Cartographic.fromDegrees(startLon, startLat);
    const end = Cesium.Cartographic.fromDegrees(endLon, endLat);

    // Calculate distance for arc height scaling
    const ellipsoid = Cesium.Ellipsoid.WGS84;
    const distance = Cesium.Cartesian3.distance(
      ellipsoid.cartographicToCartesian(start),
      ellipsoid.cartographicToCartesian(end)
    );

    // Use a scaled height based on distance
    const arcHeight = Math.min(height, distance * 0.3);

    for (let i = 0; i <= numPoints; i++) {
      const fraction = i / numPoints;
      const longitude = Cesium.Math.lerp(
        start.longitude,
        end.longitude,
        fraction
      );
      const latitude = Cesium.Math.lerp(start.latitude, end.latitude, fraction);

      // Create a parabolic arc
      const arcFactor = 4 * fraction * (1 - fraction);
      const altitude = arcFactor * arcHeight;

      positions.push(longitude, latitude, altitude);
    }

    return Cesium.Cartesian3.fromRadiansArrayHeights(positions);
  };

  // Function to validate coordinates
  const validateCoordinates = (lat, lon) => {
    if (isNaN(lat) || isNaN(lon)) {
      return {
        valid: false,
        message: "Please enter valid numeric coordinates.",
      };
    }

    if (lat < -90 || lat > 90) {
      return { valid: false, message: "Latitude must be between -90 and 90." };
    }

    if (lon < -180 || lon > 180) {
      return {
        valid: false,
        message: "Longitude must be between -180 and 180.",
      };
    }

    return { valid: true };
  };

  // Function to show error message
  const showError = (message) => {
    setErrorMessage(message);
    setSuccessMessage("");
    setTimeout(() => {
      setErrorMessage("");
    }, 5000);
  };

  // Function to show success message
  const showSuccess = (message) => {
    setSuccessMessage(message);
    setErrorMessage("");
    setTimeout(() => {
      setSuccessMessage("");
    }, 5000);
  };

  // Handle JSON file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        validateAndLoadJsonData(jsonData);
      } catch (error) {
        showError("Invalid JSON file: " + error.message);
      }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be uploaded again
    event.target.value = "";
  };

  // Validate and load JSON data into the form
  const validateAndLoadJsonData = (data) => {
    try {
      // Validate structure
      if (!data.attendees || typeof data.attendees !== "object") {
        showError("Invalid JSON: 'attendees' must be an object");
        return;
      }

      if (
        !data.availability_window ||
        !data.availability_window.start ||
        !data.availability_window.end
      ) {
        showError(
          "Invalid JSON: 'availability_window' must have 'start' and 'end'"
        );
        return;
      }

      if (
        !data.event_duration ||
        typeof data.event_duration.days === "undefined" ||
        typeof data.event_duration.hours === "undefined"
      ) {
        showError(
          "Invalid JSON: 'event_duration' must have 'days' and 'hours'"
        );
        return;
      }

      // Load attendees into cities state
      const cityEntries = Object.entries(data.attendees);
      if (cityEntries.length === 0) {
        showError("No attendees found in JSON file");
        return;
      }

      const newCities = cityEntries.map(([city, attendees]) => ({
        id: Date.now() + Math.random(),
        city: city,
        attendees: parseInt(attendees) || 0,
      }));

      setCities(newCities);

      // Load availability window (convert from ISO to datetime-local format)
      const startDate = new Date(data.availability_window.start);
      const endDate = new Date(data.availability_window.end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        showError("Invalid date format in availability_window");
        return;
      }

      // Convert to local datetime format for datetime-local inputs
      // Note: datetime-local expects local time, not UTC
      const formatForInput = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      setAvailabilityStart(formatForInput(startDate));
      setAvailabilityEnd(formatForInput(endDate));

      // Load event duration
      setEventDurationDays(parseInt(data.event_duration.days) || 0);
      setEventDurationHours(parseInt(data.event_duration.hours) || 0);

      showSuccess("JSON file loaded successfully!");
    } catch (error) {
      showError("Error loading JSON data: " + error.message);
    }
  };

  // Add a new city/attendee row
  const addCity = () => {
    setCities([...cities, { id: Date.now(), city: "", attendees: 1 }]);
  };

  // Remove a city/attendee row
  const removeCity = (id) => {
    if (cities.length > 1) {
      setCities(cities.filter((city) => city.id !== id));
    } else {
      showError("At least one city is required");
    }
  };

  // Update city name or attendees count
  const updateCity = (id, field, value) => {
    setCities(
      cities.map((city) =>
        city.id === id ? { ...city, [field]: value } : city
      )
    );
  };

  // Format datetime-local value to ISO string
  const formatDateTimeForAPI = (dateTimeLocal) => {
    if (!dateTimeLocal) return null;
    // Convert from local datetime to ISO string
    const date = new Date(dateTimeLocal);
    return date.toISOString();
  };

  // Prepare data for backend API
  const prepareMeetingData = () => {
    // Build attendees object
    const attendees = {};
    cities.forEach((cityData) => {
      if (cityData.city.trim()) {
        const cityName = cityData.city.trim();
        const count = parseInt(cityData.attendees) || 0;
        if (count > 0) {
          attendees[cityName] = count;
        }
      }
    });

    // Validate
    if (Object.keys(attendees).length === 0) {
      showError("Please add at least one city with attendees");
      return null;
    }

    if (!availabilityStart || !availabilityEnd) {
      showError("Please set availability window (start and end dates)");
      return null;
    }

    const startDate = new Date(availabilityStart);
    const endDate = new Date(availabilityEnd);
    if (startDate >= endDate) {
      showError("Availability start date must be before end date");
      return null;
    }

    const eventDays = parseInt(eventDurationDays) || 0;
    const eventHours = parseInt(eventDurationHours) || 0;
    if (eventDays === 0 && eventHours === 0) {
      showError("Event duration must be greater than 0");
      return null;
    }

    return {
      attendees: attendees,
      availability_window: {
        start: formatDateTimeForAPI(availabilityStart),
        end: formatDateTimeForAPI(availabilityEnd),
      },
      event_duration: {
        days: eventDays,
        hours: eventHours,
      },
    };
  };

  // Handle form submission
  const handleSubmitMeeting = async () => {
    const meetingData = prepareMeetingData();
    if (!meetingData) return;

    // TODO: Replace with actual backend API endpoint
    console.log("Meeting data to send:", JSON.stringify(meetingData, null, 2));

    // For now, just show success message
    showSuccess("Meeting plan submitted successfully!");

    // TODO: Call backend API
    // try {
    //   const response = await fetch('YOUR_BACKEND_API_URL', {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify(meetingData),
    //   });
    //   const result = await response.json();
    //   // Handle result - visualize meeting location and flight paths
    // } catch (error) {
    //   showError("Failed to submit meeting plan: " + error.message);
    // }
  };

  // Draw Flight Path Handler
  const handleDrawPath = () => {
    const startLatNum = parseFloat(startLat);
    const startLonNum = parseFloat(startLon);
    const endLatNum = parseFloat(endLat);
    const endLonNum = parseFloat(endLon);

    if (!viewerRef.current) return;

    // Validate start coordinates
    const startValidation = validateCoordinates(startLatNum, startLonNum);
    if (!startValidation.valid) {
      showError(startValidation.message);
      return;
    }

    // Validate end coordinates
    const endValidation = validateCoordinates(endLatNum, endLonNum);
    if (!endValidation.valid) {
      showError(endValidation.message);
      return;
    }

    // Clear error message
    setErrorMessage("");

    // Create curved path positions
    const positions = createCurvedPath(
      startLonNum,
      startLatNum,
      endLonNum,
      endLatNum
    );

    // Add start beacon (red point at start location)
    const startBeacon = viewerRef.current.entities.add({
      name: "Start Point",
      position: Cesium.Cartesian3.fromDegrees(startLonNum, startLatNum, 0),
      point: {
        pixelSize: 15,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: "START",
        font: "14pt sans-serif",
        fillColor: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -30),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });

    // Add end beacon (red point at end location)
    const endBeacon = viewerRef.current.entities.add({
      name: "End Point",
      position: Cesium.Cartesian3.fromDegrees(endLonNum, endLatNum, 0),
      point: {
        pixelSize: 15,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: "END",
        font: "14pt sans-serif",
        fillColor: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -30),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });

    // Add flight path entity
    const flightPath = viewerRef.current.entities.add({
      name: `Flight Path: (${startLatNum}, ${startLonNum}) to (${endLatNum}, ${endLonNum})`,
      polyline: {
        positions: positions,
        width: 3,
        material: Cesium.Color.RED,
        clampToGround: false,
        arcType: Cesium.ArcType.NONE,
      },
    });

    // Create time-based animation for the plane
    const flightDuration = 10.0; // Duration in seconds
    const startTime = viewerRef.current.clock.currentTime;
    const stopTime = Cesium.JulianDate.addSeconds(
      startTime,
      flightDuration,
      new Cesium.JulianDate()
    );

    // Create sampled position property for animation
    const property = new Cesium.SampledPositionProperty();
    property.setInterpolationOptions({
      interpolationDegree: 1,
      interpolationAlgorithm: Cesium.LinearApproximation,
    });

    // Create orientation property that follows the direction of travel
    const orientation = new Cesium.VelocityOrientationProperty(property);

    // Sample positions along the path with time
    const numSamples = positions.length;
    for (let i = 0; i < numSamples; i++) {
      const time = Cesium.JulianDate.addSeconds(
        startTime,
        (flightDuration * i) / (numSamples - 1),
        new Cesium.JulianDate()
      );
      property.addSample(time, positions[i]);
    }

    // Remove previous plane entity if it exists
    if (planeEntityRef.current) {
      viewerRef.current.entities.remove(planeEntityRef.current);
      planeEntityRef.current = null;
    }

    // Add airplane entity with 3D model from Cesium Ion
    planeEntityRef.current = viewerRef.current.entities.add({
      availability: new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({
          start: startTime,
          stop: stopTime,
        }),
      ]),
      position: property,
      orientation: orientation,
      model: {
        uri: Cesium.IonResource.fromAssetId(3995777), // Boeing 787 Dreamliner
        minimumPixelSize: 64,
        maximumScale: 2000,
      },
    });

    // Store references for clearing
    flightPathsRef.current.push(flightPath);
    flightPathsRef.current.push(startBeacon);
    flightPathsRef.current.push(endBeacon);
    // Note: plane entity is stored in planeEntityRef.current and will be removed with removeAll()

    // Set clock to animation time range
    viewerRef.current.clock.startTime = startTime.clone();
    viewerRef.current.clock.stopTime = stopTime.clone();
    viewerRef.current.clock.currentTime = startTime.clone();
    viewerRef.current.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    viewerRef.current.clock.multiplier = 1;

    // Zoom to the flight path
    viewerRef.current.flyTo(flightPath);

    // Start animation
    viewerRef.current.clock.shouldAnimate = true;
  };

  // Clear All Paths Handler
  const handleClearPaths = () => {
    if (!viewerRef.current) return;

    // Remove all entities except office markers
    const entitiesToRemove = [];
    viewerRef.current.entities.values.forEach((entity) => {
      if (!officeEntitiesRef.current.includes(entity)) {
        entitiesToRemove.push(entity);
      }
    });
    entitiesToRemove.forEach((entity) => {
      viewerRef.current.entities.remove(entity);
    });

    // Reset plane entity reference
    planeEntityRef.current = null;

    flightPathsRef.current = [];
    viewerRef.current.clock.shouldAnimate = false;
    setErrorMessage("");
  };

  // Reset View Handler - Recenter globe to default view
  const handleResetView = () => {
    if (!viewerRef.current) return;

    // Reset camera to default view (globe view)
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0,
      },
    });
  };

  return (
    <div className="appContainer">
      <div className="controlPanel">
        <h3>Meeting Planner</h3>

        <div className="section">
          <h4>Load from JSON</h4>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              background: "#0c1328",
              color: "var(--text)",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          />
          <p
            className="small"
            style={{ marginTop: "8px", textAlign: "center" }}
          >
            Or enter manually below
          </p>
        </div>

        <div className="section">
          <h4>Attendees</h4>
          {cities.map((cityData) => (
            <div key={cityData.id} className="cityAttendeeRow">
              <select
                value={cityData.city}
                onChange={(e) =>
                  updateCity(cityData.id, "city", e.target.value)
                }
              >
                <option value="">Select office location...</option>
                {officeLocations.map((office) => (
                  <option key={office.city} value={office.city}>
                    {office.city}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Count"
                value={cityData.attendees}
                min="1"
                onChange={(e) =>
                  updateCity(
                    cityData.id,
                    "attendees",
                    parseInt(e.target.value) || 0
                  )
                }
              />
              <button onClick={() => removeCity(cityData.id)}>×</button>
            </div>
          ))}
          <button className="addCityButton" onClick={addCity}>
            + Add City
          </button>
        </div>

        <div className="section">
          <h4>Availability Window</h4>
          <label>
            Start Date & Time:
            <input
              type="datetime-local"
              value={availabilityStart}
              onChange={(e) => setAvailabilityStart(e.target.value)}
            />
          </label>
          <label>
            End Date & Time:
            <input
              type="datetime-local"
              value={availabilityEnd}
              onChange={(e) => setAvailabilityEnd(e.target.value)}
            />
          </label>
        </div>

        <div className="section">
          <h4>Event Duration</h4>
          <div className="durationInputs">
            <label>
              Days:
              <input
                type="number"
                value={eventDurationDays}
                min="0"
                onChange={(e) =>
                  setEventDurationDays(parseInt(e.target.value) || 0)
                }
              />
            </label>
            <label>
              Hours:
              <input
                type="number"
                value={eventDurationHours}
                min="0"
                max="23"
                onChange={(e) =>
                  setEventDurationHours(parseInt(e.target.value) || 0)
                }
              />
            </label>
          </div>
        </div>

        <div className="section">
          {errorMessage && <div className="errorMessage">{errorMessage}</div>}
          {successMessage && (
            <div className="successMessage">{successMessage}</div>
          )}
          <button className="submitBtn" onClick={handleSubmitMeeting}>
            Plan Meeting
          </button>
        </div>

        <div className="section">
          <button className="clearBtn" onClick={handleClearPaths}>
            Clear Visualisation
          </button>
          <button className="resetBtn" onClick={handleResetView}>
            Reset View
          </button>
        </div>
      </div>

      <div ref={cesiumContainerRef} className="cesiumContainer" />
    </div>
  );
}

export default App;
