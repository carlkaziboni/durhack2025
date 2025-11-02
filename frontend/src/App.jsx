import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as Cesium from "cesium";
import "./index.css";
import ExpandedView from "./ExpandedView";
import { exportToCalendar } from "./utils/exportToCalendar";
import { getLatLonFromCity, getWeatherForDate } from "./utils/weatherService";

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

// Mock backend function - generates realistic response based on input
const mockBackend = (meetingData) => {
  // Simulate API delay
  return new Promise((resolve) => {
    setTimeout(() => {
      const attendeeCities = Object.keys(meetingData.attendees);

      // Find best location (simplified: pick first available office or Dubai as default)
      const availableLocations = officeLocations.map((office) => office.city);
      let eventLocation = "Dubai"; // Default

      // Try to find a location that's in the office list
      if (availableLocations.length > 0) {
        // Simple heuristic: pick the location that appears most in attendee list
        // or pick a central location
        const attendeeOffices = attendeeCities.filter((city) =>
          availableLocations.includes(city)
        );
        if (attendeeOffices.length > 0) {
          eventLocation = attendeeOffices[0];
        } else {
          // Pick a central location from available offices
          eventLocation = availableLocations.includes("Dubai")
            ? "Dubai"
            : availableLocations.includes("London")
            ? "London"
            : availableLocations[0];
        }
      }

      // Find event location coordinates
      const eventOffice = officeLocations.find(
        (office) => office.city === eventLocation
      );

      // Calculate realistic travel hours (mock data)
      const attendeeTravelHours = {};
      let totalHours = 0;
      let minHours = Infinity;
      let maxHours = 0;

      attendeeCities.forEach((city) => {
        // Mock travel hours based on distance
        const cityOffice = officeLocations.find(
          (office) => office.city === city
        );
        if (cityOffice && eventOffice) {
          // Simple distance-based calculation
          const latDiff = Math.abs(cityOffice.lat - eventOffice.lat);
          const lonDiff = Math.abs(cityOffice.lon - eventOffice.lon);
          const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
          const hours = Math.max(
            2,
            Math.min(
              24,
              Math.round((distance * 15 + Math.random() * 5) * 10) / 10
            )
          );

          attendeeTravelHours[city] = hours;
          totalHours += hours;
          minHours = Math.min(minHours, hours);
          maxHours = Math.max(maxHours, hours);
        } else {
          // Default if city not found
          const hours = 8 + Math.random() * 12;
          attendeeTravelHours[city] = Math.round(hours * 10) / 10;
          totalHours += hours;
          minHours = Math.min(minHours, hours);
          maxHours = Math.max(maxHours, hours);
        }
      });

      const avgHours =
        Math.round((totalHours / attendeeCities.length) * 10) / 10;
      const sortedHours = Object.values(attendeeTravelHours).sort(
        (a, b) => a - b
      );
      const medianHours =
        sortedHours.length % 2 === 0
          ? (sortedHours[sortedHours.length / 2 - 1] +
              sortedHours[sortedHours.length / 2]) /
            2
          : sortedHours[Math.floor(sortedHours.length / 2)];

      // Calculate CO2 (mock: roughly 0.2 kg CO2 per km, assume 800 km per hour of flight)
      const totalCO2 = Math.round(totalHours * 800 * 0.2);

      // Calculate event dates (mock: use availability window start, add some buffer)
      const availabilityStart = new Date(meetingData.availability_window.start);
      const availabilityEnd = new Date(meetingData.availability_window.end);
      const eventDurationMs =
        (meetingData.event_duration.days * 24 +
          meetingData.event_duration.hours) *
        60 *
        60 *
        1000;

      // Event starts 1 day after availability start (to account for travel)
      const eventStart = new Date(availabilityStart);
      eventStart.setDate(eventStart.getDate() + 1);
      eventStart.setHours(9, 30, 0, 0); // Start at 9:30 AM

      const eventEnd = new Date(eventStart.getTime() + eventDurationMs);

      // Event span includes travel time (starts earlier, ends later)
      const eventSpanStart = new Date(eventStart);
      eventSpanStart.setDate(eventSpanStart.getDate() - 1);
      eventSpanStart.setHours(17, 30, 0, 0); // Previous day 5:30 PM

      const eventSpanEnd = new Date(eventEnd);
      eventSpanEnd.setDate(eventSpanEnd.getDate() + 1);
      eventSpanEnd.setHours(22, 27, 0, 0); // Next day 10:27 PM

      const result = {
        event_location: eventLocation,
        event_dates: {
          start: eventStart.toISOString(),
          end: eventEnd.toISOString(),
        },
        event_span: {
          start: eventSpanStart.toISOString(),
          end: eventSpanEnd.toISOString(),
        },
        total_co2: totalCO2,
        average_travel_hours: avgHours,
        median_travel_hours: Math.round(medianHours * 10) / 10,
        max_travel_hours: Math.round(maxHours * 10) / 10,
        min_travel_hours: Math.round(minHours * 10) / 10,
        attendee_travel_hours: attendeeTravelHours,
        // Include original input data for display
        meeting_data: meetingData,
      };

      resolve(result);
    }, 1500); // Simulate 1.5 second API delay
  });
};

function App() {
  const cesiumContainerRef = useRef(null);
  const viewerRef = useRef(null);
  const flightPathsRef = useRef([]);
  const planeEntityRef = useRef(null);
  const officeEntitiesRef = useRef([]);
  const resultsPlanesRef = useRef([]);
  const originCityMarkersRef = useRef([]);

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
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonModalTab, setJsonModalTab] = useState("paste");
  const [jsonModalText, setJsonModalText] = useState("");

  // Hover card state
  const [hoveredOffice, setHoveredOffice] = useState(null);
  const [hoverCardPosition, setHoverCardPosition] = useState({ x: 0, y: 0 });

  // Results state
  const [meetingResults, setMeetingResults] = useState(null);
  const [weather, setWeather] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const eventLocationEntityRef = useRef(null);
  const resultsFlightPathsRef = useRef([]);
  const [showExpandedView, setShowExpandedView] = useState(false);

  // Function to show/hide office markers
  const setOfficeMarkersVisibility = (visible) => {
    officeEntitiesRef.current.forEach((entity) => {
      entity.show = visible;
    });
  };

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
          show: false, // Labels are hidden, we use hover card instead
        },
        // Store office data for hover card
        officeData: office,
      });

      officeEntitiesRef.current.push(entity);
    });

    // Add hover event handlers to show/hide hover card
    const handler = new Cesium.ScreenSpaceEventHandler(
      viewerRef.current.scene.canvas
    );

    handler.setInputAction((movement) => {
      const pickedObject = viewerRef.current.scene.pick(movement.endPosition);
      if (
        pickedObject &&
        Cesium.defined(pickedObject.id) &&
        pickedObject.id.officeData
      ) {
        // Check if it's an office entity
        const isOfficeEntity = officeEntitiesRef.current.includes(
          pickedObject.id
        );
        if (isOfficeEntity) {
          const office = pickedObject.id.officeData;
          // Convert 3D position to screen coordinates (relative to canvas)
          const screenPosition =
            Cesium.SceneTransforms.wgs84ToWindowCoordinates(
              viewerRef.current.scene,
              pickedObject.id.position.getValue(
                viewerRef.current.clock.currentTime
              )
            );

          if (screenPosition) {
            // Get canvas position relative to viewport
            const canvas = viewerRef.current.scene.canvas;
            const rect = canvas.getBoundingClientRect();

            setHoveredOffice(office);
            setHoverCardPosition({
              x: screenPosition.x + rect.left,
              y: screenPosition.y + rect.top - 50, // Position above the marker
            });
          }
        }
      } else {
        // Hide hover card when not hovering
        setHoveredOffice(null);
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Store handler for cleanup
    viewerRef.current._officeHandler = handler;
  };

  // Function to create orientation that points the nose toward the destination
  // Uses direction vector from current position to next position
  const createOrientationProperty = (positionProperty) => {
    // Create a custom property that calculates orientation based on direction of travel
    const orientationProperty = new Cesium.CallbackProperty((time, result) => {
      if (!Cesium.defined(time)) {
        return undefined;
      }

      const currentPosition = positionProperty.getValue(time);
      if (!Cesium.defined(currentPosition)) {
        return undefined;
      }

      // Get next position to calculate direction
      const nextTime = Cesium.JulianDate.addSeconds(
        time,
        0.1,
        new Cesium.JulianDate()
      );
      let nextPosition = positionProperty.getValue(nextTime);

      // If no next position (at end), use previous position
      if (!Cesium.defined(nextPosition)) {
        const prevTime = Cesium.JulianDate.addSeconds(
          time,
          -0.1,
          new Cesium.JulianDate()
        );
        const prevPosition = positionProperty.getValue(prevTime);
        if (!Cesium.defined(prevPosition)) {
          return Cesium.Quaternion.IDENTITY;
        }
        // Direction from previous to current
        const direction = Cesium.Cartesian3.subtract(
          currentPosition,
          prevPosition,
          new Cesium.Cartesian3()
        );
        const distance = Cesium.Cartesian3.magnitude(direction);
        if (distance < 0.001) {
          return Cesium.Quaternion.IDENTITY;
        }

        // Use directionToEastNorthUp to get proper orientation in Cesium's frame
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(
          currentPosition,
          undefined,
          undefined
        );
        const east = Cesium.Matrix4.getColumn(
          transform,
          0,
          new Cesium.Cartesian3()
        );
        const north = Cesium.Matrix4.getColumn(
          transform,
          1,
          new Cesium.Cartesian3()
        );
        const up = Cesium.Matrix4.getColumn(
          transform,
          2,
          new Cesium.Cartesian3()
        );

        // Normalize direction
        Cesium.Cartesian3.normalize(direction, direction);

        // Project direction onto east-north plane for heading
        const eastComponent = Cesium.Cartesian3.dot(direction, east);
        const northComponent = Cesium.Cartesian3.dot(direction, north);
        const upComponent = Cesium.Cartesian3.dot(direction, up);

        // Calculate heading (angle in horizontal plane)
        let heading = Math.atan2(eastComponent, northComponent);
        // Adjust for model orientation (90 degrees offset)
        heading -= Cesium.Math.toRadians(90);

        // Calculate pitch (angle up/down)
        const horizontalLength = Math.sqrt(
          eastComponent * eastComponent + northComponent * northComponent
        );
        const pitch = Math.atan2(-upComponent, horizontalLength);

        // Create quaternion from heading, pitch, roll
        const hpr = new Cesium.HeadingPitchRoll(heading, pitch, 0.0);
        return Cesium.Transforms.headingPitchRollQuaternion(
          currentPosition,
          hpr
        );
      }

      // Calculate direction vector (from current to next position)
      const direction = Cesium.Cartesian3.subtract(
        nextPosition,
        currentPosition,
        new Cesium.Cartesian3()
      );

      const distance = Cesium.Cartesian3.magnitude(direction);
      if (distance < 0.001) {
        return Cesium.Quaternion.IDENTITY;
      }

      // Normalize direction
      Cesium.Cartesian3.normalize(direction, direction);

      // Get the local east-north-up frame at the current position
      const transform = Cesium.Transforms.eastNorthUpToFixedFrame(
        currentPosition,
        undefined,
        undefined
      );
      const east = Cesium.Matrix4.getColumn(
        transform,
        0,
        new Cesium.Cartesian3()
      );
      const north = Cesium.Matrix4.getColumn(
        transform,
        1,
        new Cesium.Cartesian3()
      );
      const up = Cesium.Matrix4.getColumn(
        transform,
        2,
        new Cesium.Cartesian3()
      );

      // Project direction onto east-north-up frame
      const eastComponent = Cesium.Cartesian3.dot(direction, east);
      const northComponent = Cesium.Cartesian3.dot(direction, north);
      const upComponent = Cesium.Cartesian3.dot(direction, up);

      // Calculate heading (rotation around up axis, in east-north plane)
      // Heading is 0 when pointing north, increases clockwise
      let heading = Math.atan2(eastComponent, northComponent);
      // Adjust for model orientation (90 degrees offset)
      heading -= Cesium.Math.toRadians(90);

      // Calculate pitch (rotation around east axis)
      // Positive pitch means nose up
      const horizontalLength = Math.sqrt(
        eastComponent * eastComponent + northComponent * northComponent
      );
      const pitch = Math.atan2(-upComponent, horizontalLength);

      // Roll is 0 for now (no banking)
      const roll = 0.0;

      // Create quaternion from heading, pitch, roll
      const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
      return Cesium.Transforms.headingPitchRollQuaternion(currentPosition, hpr);
    }, false);

    return orientationProperty;
  };

  // Initialize Cesium Viewer
  useEffect(() => {
    if (!cesiumContainerRef.current || viewerRef.current) return;

    // Use EllipsoidTerrainProvider which doesn't require Ion token
    // This provides a smooth ellipsoid (no terrain elevation)
    viewerRef.current = new Cesium.Viewer(cesiumContainerRef.current, {
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      animation: false,
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

    // Use CartoDB Dark Matter - a darker, subtle texture
    try {
      const cartoImagery = new Cesium.UrlTemplateImageryProvider({
        url: "https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
        maximumLevel: 18,
      });
      viewerRef.current.imageryLayers.removeAll();
      viewerRef.current.imageryLayers.addImageryProvider(cartoImagery);
    } catch (error) {
      console.warn("Could not set CartoDB imagery, using default");
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

  // Fetch weather when meeting results change
  useEffect(() => {
    async function fetchWeather() {
      if (!meetingResults) return;

      const coords = await getLatLonFromCity(meetingResults.event_location);
      if (!coords) return;

      const eventDate = new Date(meetingResults.event_dates.start);
      const weatherData = await getWeatherForDate(
        coords.lat,
        coords.lon,
        eventDate
      );
      setWeather(weatherData);
    }

    fetchWeather();
  }, [meetingResults]);

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
      if (cityData.city && cityData.city.trim()) {
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

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // TODO: Replace with actual backend API endpoint
      // For now, use mock backend
      const result = await mockBackend(meetingData);

      // Store results
      setMeetingResults(result);

      // Visualize results on globe
      visualizeMeetingResults(result);

      showSuccess("Meeting plan calculated successfully!");
    } catch (error) {
      showError("Failed to calculate meeting plan: " + error.message);
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }

    // TODO: Replace mock backend with actual API call
    // try {
    //   const response = await fetch('YOUR_BACKEND_API_URL', {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify(meetingData),
    //   });
    //   const result = await response.json();
    //   setMeetingResults(result);
    //   visualizeMeetingResults(result);
    //   showSuccess("Meeting plan calculated successfully!");
    // } catch (error) {
    //   showError("Failed to calculate meeting plan: " + error.message);
    // } finally {
    //   setIsLoading(false);
    // }
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
      setShowJsonModal(false);
      setJsonModalTab("paste");
      setJsonModalText("");
    } catch (error) {
      showError("Error loading JSON data: " + error.message);
    }
  };

  const handleLoadJSON = () => {
    try {
      const data = JSON.parse(jsonModalText);

      // Load attendees into the cities state
      if (data.attendees) {
        const newCities = Object.entries(data.attendees).map(
          ([city, count]) => ({
            id: Date.now() + Math.random(),
            city: city,
            attendees: count,
          })
        );
        setCities(newCities);
      }

      // Load availability dates (convert ISO string to datetime-local format)
      if (data.availability_window) {
        if (data.availability_window.start)
          setAvailabilityStart(data.availability_window.start.slice(0, 16));
        if (data.availability_window.end)
          setAvailabilityEnd(data.availability_window.end.slice(0, 16));
      }

      // Load event duration
      if (data.event_duration) {
        if (data.event_duration.days !== undefined)
          setEventDurationDays(data.event_duration.days);
        if (data.event_duration.hours !== undefined)
          setEventDurationHours(data.event_duration.hours);
      }

      showSuccess("JSON loaded successfully!");
      setShowJsonModal(false);
      setJsonModalText("");
    } catch (error) {
      showError("Invalid JSON. Please check the format.");
    }
  };

  // Visualize meeting results on the globe
  const visualizeMeetingResults = (results) => {
    if (!viewerRef.current) return;

    // Hide blue office markers
    setOfficeMarkersVisibility(false);

    // Clear previous results visualization
    if (eventLocationEntityRef.current) {
      viewerRef.current.entities.remove(eventLocationEntityRef.current);
      eventLocationEntityRef.current = null;
    }
    resultsFlightPathsRef.current.forEach((entity) => {
      viewerRef.current.entities.remove(entity);
    });
    resultsFlightPathsRef.current = [];

    // Clear previous plane entities
    resultsPlanesRef.current.forEach((entity) => {
      viewerRef.current.entities.remove(entity);
    });
    resultsPlanesRef.current = [];

    // Clear previous origin city markers
    originCityMarkersRef.current.forEach((entity) => {
      viewerRef.current.entities.remove(entity);
    });
    originCityMarkersRef.current = [];

    // Find event location coordinates
    const eventOffice = officeLocations.find(
      (office) => office.city === results.event_location
    );
    if (!eventOffice) return;

    // Add event location marker (green/star marker)
    eventLocationEntityRef.current = viewerRef.current.entities.add({
      name: `Event Location: ${results.event_location}`,
      position: Cesium.Cartesian3.fromDegrees(
        eventOffice.lon,
        eventOffice.lat,
        0
      ),
      point: {
        pixelSize: 24,
        color: Cesium.Color.GOLD,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 4,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        scaleByDistance: new Cesium.NearFarScalar(1.5e2, 2.0, 1.5e7, 0.5),
      },
      label: {
        text: `🏁 ${results.event_location}`,
        font: "14pt sans-serif",
        fillColor: Cesium.Color.GOLD,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -35),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        show: true,
      },
    });

    // Draw flight paths from attendee cities to event location and add animated planes
    const travelTimes = Object.entries(results.attendee_travel_hours);
    const baseStartTime = viewerRef.current.clock.currentTime;

    // Find the maximum travel hours to determine total animation duration
    const maxTravelHours = Math.max(...travelTimes.map(([, hours]) => hours));
    const totalAnimationDuration = Math.max(
      5,
      Math.min(30, maxTravelHours * 0.5)
    ); // 5-30 seconds

    travelTimes.forEach(([cityName, travelHours], index) => {
      const cityOffice = officeLocations.find(
        (office) => office.city === cityName
      );
      if (!cityOffice || cityOffice.city === results.event_location) return;

      // Create curved path (already returns array of Cartesian3 objects)
      const positions = createCurvedPath(
        cityOffice.lon,
        cityOffice.lat,
        eventOffice.lon,
        eventOffice.lat
      );

      // Add flight path (subtle colors based on travel hours)
      const color =
        travelHours < 8
          ? Cesium.Color.fromBytes(100, 180, 100, 150) // Subtle green
          : travelHours < 16
          ? Cesium.Color.fromBytes(180, 150, 100, 150) // Subtle yellow/orange
          : Cesium.Color.fromBytes(180, 120, 100, 150); // Subtle orange

      const flightPath = viewerRef.current.entities.add({
        name: `Flight: ${cityName} to ${results.event_location}`,
        polyline: {
          positions: positions,
          width: 2,
          material: color,
          clampToGround: false,
          arcType: Cesium.ArcType.NONE,
        },
      });

      resultsFlightPathsRef.current.push(flightPath);

      // Add colored marker for origin city (different color scheme than flight paths)
      const originMarkerColor =
        travelHours < 8
          ? Cesium.Color.CYAN
          : travelHours < 16
          ? Cesium.Color.ORANGE
          : Cesium.Color.MAGENTA;

      const marker = viewerRef.current.entities.add({
        name: `Origin: ${cityName}`,
        position: Cesium.Cartesian3.fromDegrees(
          cityOffice.lon,
          cityOffice.lat,
          0
        ),
        point: {
          pixelSize: 22,
          color: originMarkerColor,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          scaleByDistance: new Cesium.NearFarScalar(1.5e2, 2.0, 1.5e7, 0.5),
        },
      });

      originCityMarkersRef.current.push(marker);

      // Create animated plane for this flight path
      // All planes arrive at the same time, so calculate when to start each plane
      // The duration for each plane is proportional to its travel hours
      const animationDuration =
        (travelHours / maxTravelHours) * totalAnimationDuration;

      // Calculate start time so plane arrives at the end of totalAnimationDuration
      const startDelay = totalAnimationDuration - animationDuration;
      const startTime = Cesium.JulianDate.addSeconds(
        baseStartTime,
        startDelay,
        new Cesium.JulianDate()
      );
      const stopTime = Cesium.JulianDate.addSeconds(
        startTime,
        animationDuration,
        new Cesium.JulianDate()
      );

      // Create sampled position property for plane animation
      const positionProperty = new Cesium.SampledPositionProperty();
      positionProperty.setInterpolationOptions({
        interpolationDegree: 2,
        interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
      });

      // Create orientation property that properly points nose toward destination
      const orientation = createOrientationProperty(positionProperty);

      // Sample positions along the path with time
      // positions is now an array of Cartesian3 objects
      for (let i = 0; i < positions.length; i++) {
        const time = Cesium.JulianDate.addSeconds(
          startTime,
          (animationDuration * i) / (positions.length - 1),
          new Cesium.JulianDate()
        );
        positionProperty.addSample(time, positions[i]);
      }

      // Add airplane entity with 3D model from local GLB file
      const planeEntity = viewerRef.current.entities.add({
        name: `Plane: ${cityName} to ${results.event_location}`,
        availability: new Cesium.TimeIntervalCollection([
          new Cesium.TimeInterval({
            start: startTime,
            stop: stopTime,
          }),
        ]),
        position: positionProperty,
        orientation: orientation,
        model: {
          uri: "/res/planeblender.glb", // Local airplane GLB model
          minimumPixelSize: 128,
          maximumScale: 4000,
        },
      });

      resultsPlanesRef.current.push(planeEntity);
    });

    // Set clock to animation time range
    // All planes now arrive at the same time after totalAnimationDuration
    const clockStopTime = Cesium.JulianDate.addSeconds(
      baseStartTime,
      totalAnimationDuration,
      new Cesium.JulianDate()
    );

    viewerRef.current.clock.startTime = baseStartTime.clone();
    viewerRef.current.clock.stopTime = clockStopTime;
    viewerRef.current.clock.currentTime = baseStartTime.clone();
    viewerRef.current.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    viewerRef.current.clock.multiplier = 1;

    // Start animation
    viewerRef.current.clock.shouldAnimate = true;

    // Center on event location but zoom out to show more of the globe
    // Keep the globe centered on screen while showing the event location
    if (eventLocationEntityRef.current) {
      // Use a high altitude with top-down view to keep globe centered
      // Similar to reset view but centered on event location
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          eventOffice.lon,
          eventOffice.lat,
          20000000 // High altitude to zoom out (20 million meters)
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-90), // Top-down view keeps globe centered
          roll: 0.0,
        },
        duration: 2.0, // Smooth 2 second animation
      });
    }
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

    // Clear results visualization
    if (eventLocationEntityRef.current) {
      viewerRef.current.entities.remove(eventLocationEntityRef.current);
      eventLocationEntityRef.current = null;
    }
    resultsFlightPathsRef.current.forEach((entity) => {
      viewerRef.current.entities.remove(entity);
    });
    resultsFlightPathsRef.current = [];

    // Clear results plane entities
    resultsPlanesRef.current.forEach((entity) => {
      viewerRef.current.entities.remove(entity);
    });
    resultsPlanesRef.current = [];

    // Clear origin city markers
    originCityMarkersRef.current.forEach((entity) => {
      viewerRef.current.entities.remove(entity);
    });
    originCityMarkersRef.current = [];

    flightPathsRef.current = [];
    viewerRef.current.clock.shouldAnimate = false;
    setErrorMessage("");
    setMeetingResults(null);

    // Show blue office markers again
    setOfficeMarkersVisibility(true);
  };

  // Export meeting to Calendar (.ics)
  const handleExportCalendar = () => {
    exportToCalendar(meetingResults, showSuccess, showError);
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
    <div className="grid grid-cols-[420px_1fr] h-screen w-full relative">
      <div className="bg-[var(--bg)] overflow-y-auto border-r border-[var(--border)] flex flex-col text-[var(--text)]">
        {/* Header */}
        <div className="p-8 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[var(--text)] text-xl font-semibold m-0">
              Meeting Planner
            </h1>
            <button
              onClick={() => setShowJsonModal(true)}
              className="px-3 py-1.5 bg-[var(--panel)] border border-[var(--border)] text-[var(--muted)] rounded hover:bg-[var(--card)] hover:text-[var(--text)] transition-colors text-sm font-medium"
            >
              Import JSON
            </button>
          </div>
          <p className="text-[var(--muted)] text-sm m-0">
            Optimal location minimizing carbon emissions
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {!meetingResults ? (
            <>
              {/* Attendees */}
              <div className="mb-8">
                <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-4">
                  Attendees
                </div>
                <div className="space-y-3">
                  {cities.map((cityData) => (
                    <div key={cityData.id} className="flex gap-3 items-center">
                      <select
                        value={cityData.city}
                        onChange={(e) =>
                          updateCity(cityData.id, "city", e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-[var(--border)] rounded bg-[var(--panel)] text-[var(--text)] text-sm cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      >
                        <option value="">Select location...</option>
                        {officeLocations.map((office) => (
                          <option key={office.city} value={office.city}>
                            {office.city}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="#"
                        value={cityData.attendees}
                        min="1"
                        onChange={(e) =>
                          updateCity(
                            cityData.id,
                            "attendees",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-20 px-3 py-2 border border-[var(--border)] rounded bg-[var(--panel)] text-[var(--text)] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                      {cities.length > 1 && (
                        <button
                          onClick={() => removeCity(cityData.id)}
                          className="px-2 py-2 border border-red-600/30 bg-red-600/10 text-red-400 rounded hover:bg-red-600/20 hover:border-red-600/50 transition-colors text-lg leading-none"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">Total Attendees</span>
                  <span className="text-[var(--text)] font-semibold">
                    {cities.reduce(
                      (sum, city) => sum + (parseInt(city.attendees) || 0),
                      0
                    )}
                  </span>
                </div>
                <button
                  onClick={addCity}
                  className="mt-4 w-full py-2 px-4 bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] rounded hover:bg-[var(--accent)]/20 hover:border-[var(--accent)]/50 transition-colors text-sm font-medium"
                >
                  + Add Location
                </button>
              </div>

              <hr className="border-none border-t border-[var(--border)] my-8" />

              {/* Availability Window */}
              <div className="mb-8">
                <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-4">
                  Availability Window
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-[var(--muted)] mb-2">
                      Start
                    </div>
                    <input
                      type="datetime-local"
                      value={availabilityStart}
                      onChange={(e) => setAvailabilityStart(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded bg-[var(--panel)] text-[var(--text)] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-[var(--muted)] mb-2">End</div>
                    <input
                      type="datetime-local"
                      value={availabilityEnd}
                      onChange={(e) => setAvailabilityEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded bg-[var(--panel)] text-[var(--text)] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-none border-t border-[var(--border)] my-8" />

              {/* Event Duration */}
              <div className="mb-8">
                <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-4">
                  Event Duration
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-[var(--muted)] mb-2">Days</div>
                    <input
                      type="number"
                      value={eventDurationDays}
                      min="0"
                      onChange={(e) =>
                        setEventDurationDays(parseInt(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 border border-[var(--border)] rounded bg-[var(--panel)] text-[var(--text)] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-[var(--muted)] mb-2">
                      Hours
                    </div>
                    <input
                      type="number"
                      value={eventDurationHours}
                      min="0"
                      max="23"
                      onChange={(e) =>
                        setEventDurationHours(parseInt(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 border border-[var(--border)] rounded bg-[var(--panel)] text-[var(--text)] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="mb-6 text-red-400 text-xs p-3 bg-red-600/10 border border-red-600/30 rounded">
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="mb-6 text-emerald-400 text-xs p-3 bg-emerald-600/10 border border-emerald-600/30 rounded">
                  {successMessage}
                </div>
              )}

              <button
                onClick={handleSubmitMeeting}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/90 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Calculating..." : "Plan Meeting"}
              </button>
            </>
          ) : (
            <>
              {/* Attendees */}
              <div className="mb-8">
                <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-4">
                  Attendees
                </div>
                <div className="space-y-3">
                  {Object.entries(meetingResults.meeting_data.attendees).map(
                    ([city, count]) => (
                      <div
                        key={city}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-[var(--muted)]">{city}</span>
                        <span className="text-[var(--text)]">{count}</span>
                      </div>
                    )
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">Total Attendees</span>
                  <span className="text-[var(--text)] font-semibold">
                    {Object.values(
                      meetingResults.meeting_data.attendees
                    ).reduce((sum, count) => sum + count, 0)}
                  </span>
                </div>
              </div>

              <hr className="border-none border-t border-[var(--border)] my-8" />

              {/* Recommended Location */}
              <div className="mb-8">
                <div className="inline-block px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs text-emerald-400 mb-4">
                  RECOMMENDED LOCATION
                </div>
                <h2 className="text-[var(--text)] mb-1 text-lg font-semibold">
                  {meetingResults.event_location}
                </h2>

                {/* Weather details */}
                {weather && (
                  <div className="mt-4 bg-[var(--panel)] border border-[var(--border)] rounded-lg p-3">
                    <h4 className="m-0 mb-2 text-xs uppercase tracking-wide text-[var(--muted)] font-medium">
                      Expected Weather
                    </h4>
                    {weather.type === "forecast" ? (
                      <div className="text-xs text-[var(--text)]">
                        <span className="font-medium text-[var(--accent)]">
                          {Math.round(weather.min)}°C –{" "}
                          {Math.round(weather.max)}°C
                        </span>
                        <span className="text-[var(--muted)]"> • </span>
                        <span className="text-[var(--muted)]">
                          {(typeof weather.precipitation === "number"
                            ? weather.precipitation.toFixed(1)
                            : weather.precipitation) || 0}
                          mm rain forecast
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--text)]">
                        <span className="font-medium text-[var(--accent)]">
                          Typical: ~{Math.round(weather.avgTemp)}°C
                        </span>
                        <span className="text-[var(--muted)]"> • </span>
                        <span className="text-[var(--muted)]">
                          {(typeof weather.precipitation === "number"
                            ? weather.precipitation.toFixed(1)
                            : weather.precipitation) || "N/A"}
                          mm avg. rainfall
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4 mt-6">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                      Total Emissions
                    </div>
                    <div className="text-[var(--text)] font-semibold">
                      {meetingResults.total_co2.toLocaleString()} kg CO₂
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                      Average Travel Time
                    </div>
                    <div className="text-[var(--text)] font-semibold">
                      {meetingResults.average_travel_hours.toFixed(1)} hours
                    </div>
                  </div>
                </div>
              </div>

              <button
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white border-0 rounded font-medium transition-colors mb-3"
                onClick={() => setShowExpandedView(true)}
              >
                View Full Details
              </button>

              <button
                className="w-full py-3 px-4 border border-[var(--border)] bg-transparent text-[var(--text)] rounded hover:bg-[var(--panel)] transition-colors text-sm font-medium mb-3"
                onClick={handleExportCalendar}
              >
                📅 Export to Calendar (.ics)
              </button>

              <button
                className="w-full py-3 px-4 border border-[var(--border)] bg-transparent text-[var(--text)] rounded hover:bg-[var(--panel)] transition-colors text-sm font-medium"
                onClick={handleClearPaths}
              >
                Edit Details
              </button>
            </>
          )}
        </div>
      </div>

      <div
        ref={cesiumContainerRef}
        className="w-full h-screen m-0 p-0 relative"
      />

      {/* Hover card for office markers - positioned fixed to viewport */}
      {hoveredOffice && (
        <div
          className="absolute max-w-[300px]"
          style={{
            position: "fixed",
            left: `${hoverCardPosition.x}px`,
            top: `${hoverCardPosition.y}px`,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 1000,
          }}
        >
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-3 shadow-lg backdrop-blur-md">
            <h4 className="m-0 mb-2 text-sm font-semibold text-[var(--text)]">
              {hoveredOffice.city}
            </h4>
            <p className="m-0 text-xs text-[var(--muted)] leading-relaxed">
              {hoveredOffice.address}
            </p>
          </div>
        </div>
      )}

      {/* Expanded View Modal */}
      {showExpandedView && (
        <ExpandedView
          meetingResults={meetingResults}
          onClose={() => setShowExpandedView(false)}
        />
      )}

      {/* JSON Import Modal */}
      {showJsonModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/70 z-[20000] flex items-center justify-center p-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-[var(--border)]">
                <h2 className="text-[var(--text)] text-xl font-semibold m-0">
                  Import Meeting Data
                </h2>
                <p className="text-[var(--muted)] text-sm mt-1 m-0">
                  Upload a JSON file or paste meeting data
                </p>
              </div>

              {/* Tabs */}
              <div className="flex-1 overflow-auto">
                <div className="px-6 pt-4">
                  <div className="flex gap-2 border-b border-[var(--border)]">
                    <button
                      onClick={() => setJsonModalTab("paste")}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        jsonModalTab !== "paste"
                          ? "text-[var(--muted)] hover:text-[var(--text)]"
                          : "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                      }`}
                    >
                      Paste JSON
                    </button>
                    <button
                      onClick={() => setJsonModalTab("upload")}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        jsonModalTab !== "upload"
                          ? "text-[var(--muted)] hover:text-[var(--text)]"
                          : "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                      }`}
                    >
                      Upload File
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {jsonModalTab !== "upload" ? (
                    <PasteTab
                      onFileUpload={handleFileUpload}
                      onLoadJSON={handleLoadJSON}
                      jsonInput={jsonModalText}
                      setJsonInput={setJsonModalText}
                    />
                  ) : (
                    <UploadTab onFileUpload={handleFileUpload} />
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowJsonModal(false);
                    setJsonModalTab("paste");
                    setJsonModalText("");
                  }}
                  className="px-4 py-2 border border-[var(--border)] bg-transparent text-[var(--text)] rounded hover:bg-[var(--panel)] transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function PasteTab({ jsonInput, setJsonInput, onLoadJSON, onFileUpload }) {
  const exampleJson = JSON.stringify(
    {
      attendees: {
        Mumbai: 2,
        Shanghai: 3,
        "Hong Kong": 1,
        Singapore: 2,
        Sydney: 2,
      },
      availability_window: {
        start: "2025-12-10T09:00:00Z",
        end: "2025-12-15T17:00:00Z",
      },
      event_duration: {
        days: 0,
        hours: 4,
      },
    },
    null,
    2
  );

  return (
    <div className="space-y-4">
      <textarea
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder={exampleJson}
        className="w-full px-3 py-2 border border-[var(--border)] rounded bg-[var(--bg)] text-[var(--text)] text-sm font-mono min-h-[300px] resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />
      <div className="flex gap-2">
        <button
          onClick={onLoadJSON}
          disabled={!jsonInput.trim()}
          className="flex-1 py-2 px-4 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Import Meeting Data
        </button>
        <button
          onClick={() => setJsonInput(exampleJson)}
          className="py-2 px-4 border border-[var(--border)] bg-transparent text-[var(--text)] rounded hover:bg-[var(--panel)] transition-colors text-sm font-medium"
        >
          Load Example
        </button>
      </div>
    </div>
  );
}

function UploadTab({ onFileUpload }) {
  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-[var(--border)] rounded-lg p-12 text-center hover:border-[var(--accent)] transition-colors">
        <input
          type="file"
          accept=".json"
          onChange={onFileUpload}
          className="hidden"
          id="json-upload"
        />
        <label htmlFor="json-upload" className="cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-[var(--panel)] mx-auto mb-4 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-[var(--muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <p className="text-[var(--text)] mb-2">Click to upload JSON file</p>
          <p className="text-sm text-[var(--muted)]">or drag and drop</p>
        </label>
      </div>
    </div>
  );
}

export default App;
