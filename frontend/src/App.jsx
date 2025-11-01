import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "./index.css";
import ExpandedView from "./ExpandedView";

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

  // Meeting planning state
  const [cities, setCities] = useState([
    { id: Date.now(), city: "", attendees: 1 },
  ]);
  const [jsonInput, setJsonInput] = useState("");
  const [availabilityStart, setAvailabilityStart] = useState("");
  const [availabilityEnd, setAvailabilityEnd] = useState("");
  const [eventDurationDays, setEventDurationDays] = useState(0);
  const [eventDurationHours, setEventDurationHours] = useState(4);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Hover card state
  const [hoveredOffice, setHoveredOffice] = useState(null);
  const [hoverCardPosition, setHoverCardPosition] = useState({ x: 0, y: 0 });

  // Results state
  const [meetingResults, setMeetingResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const eventLocationEntityRef = useRef(null);
  const resultsFlightPathsRef = useRef([]);
  const [showExpandedView, setShowExpandedView] = useState(false);

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
    } catch (error) {
      showError("Error loading JSON data: " + error.message);
    }
  };

  const handleLoadJSON = () => {
    try {
      const data = JSON.parse(jsonInput);

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
    } catch (error) {
      showError("Invalid JSON. Please check the format.");
    }
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

  // Visualize meeting results on the globe
  const visualizeMeetingResults = (results) => {
    if (!viewerRef.current) return;

    // Clear previous results visualization
    if (eventLocationEntityRef.current) {
      viewerRef.current.entities.remove(eventLocationEntityRef.current);
      eventLocationEntityRef.current = null;
    }
    resultsFlightPathsRef.current.forEach((entity) => {
      viewerRef.current.entities.remove(entity);
    });
    resultsFlightPathsRef.current = [];

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
        text: `★ ${results.event_location} (Event Location)`,
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

    // Draw flight paths from attendee cities to event location
    Object.keys(results.attendee_travel_hours).forEach((cityName) => {
      const cityOffice = officeLocations.find(
        (office) => office.city === cityName
      );
      if (!cityOffice || cityOffice.city === results.event_location) return;

      // Create curved path
      const positions = createCurvedPath(
        cityOffice.lon,
        cityOffice.lat,
        eventOffice.lon,
        eventOffice.lat
      );

      // Add flight path (green/yellow gradient based on travel hours)
      const travelHours = results.attendee_travel_hours[cityName];
      const color =
        travelHours < 8
          ? Cesium.Color.GREEN
          : travelHours < 16
          ? Cesium.Color.YELLOW
          : Cesium.Color.ORANGE;

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
    });

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

    flightPathsRef.current = [];
    viewerRef.current.clock.shouldAnimate = false;
    setErrorMessage("");
    setMeetingResults(null);
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
          <h4>Import Meeting JSON</h4>
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
            Or paste JSON below
          </p>
          <textarea
            rows="6"
            placeholder="Paste JSON here..."
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            style={{
              width: "100%",
              fontFamily: "monospace",
              marginTop: "10px",
            }}
          ></textarea>
          <button onClick={handleLoadJSON} style={{ marginTop: "10px" }}>
            Load JSON
          </button>
        </div>

        <div className="section">
          {errorMessage && <div className="errorMessage">{errorMessage}</div>}
          {successMessage && (
            <div className="successMessage">{successMessage}</div>
          )}
          <button
            className="submitBtn"
            onClick={handleSubmitMeeting}
            disabled={isLoading}
          >
            {isLoading ? "Calculating..." : "Plan Meeting"}
          </button>
        </div>

        {/* Results Display */}
        {meetingResults && (
          <div className="section resultsSection">
            <h3 style={{ marginBottom: "16px" }}>Meeting Plan Results</h3>

            {/* Event Location */}
            <div className="resultCard">
              <h4 className="resultTitle">📍 Event Location</h4>
              <p className="resultValue">{meetingResults.event_location}</p>
              <button
                className="submitBtn"
                onClick={() => setShowExpandedView(true)}
                style={{ marginTop: "10px", width: "100%" }}
              >
                View Expanded Details →
              </button>
            </div>

            {/* Dates */}
            <div className="resultCard">
              <h4 className="resultTitle">📅 Event Dates</h4>
              <div className="dateInfo">
                <div>
                  <span className="dateLabel">Start:</span>
                  <span className="dateValue">
                    {new Date(
                      meetingResults.event_dates.start
                    ).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="dateLabel">End:</span>
                  <span className="dateValue">
                    {new Date(meetingResults.event_dates.end).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="dateInfo" style={{ marginTop: "8px" }}>
                <div>
                  <span className="dateLabel">Event Span:</span>
                  <span className="dateValue">
                    {new Date(meetingResults.event_span.start).toLocaleString()}{" "}
                    → {new Date(meetingResults.event_span.end).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* CO2 Emissions */}
            <div className="resultCard">
              <h4 className="resultTitle">🌍 Total CO₂ Emissions</h4>
              <p className="resultValue co2Value">
                {meetingResults.total_co2} kg CO₂
              </p>
            </div>

            {/* Travel Hours Statistics */}
            <div className="resultCard">
              <h4 className="resultTitle">✈️ Travel Time Statistics</h4>
              <div className="statsGrid">
                <div className="statItem">
                  <span className="statLabel">Average:</span>
                  <span className="statValue">
                    {meetingResults.average_travel_hours} hrs
                  </span>
                </div>
                <div className="statItem">
                  <span className="statLabel">Median:</span>
                  <span className="statValue">
                    {meetingResults.median_travel_hours} hrs
                  </span>
                </div>
                <div className="statItem">
                  <span className="statLabel">Min:</span>
                  <span className="statValue">
                    {meetingResults.min_travel_hours} hrs
                  </span>
                </div>
                <div className="statItem">
                  <span className="statLabel">Max:</span>
                  <span className="statValue">
                    {meetingResults.max_travel_hours} hrs
                  </span>
                </div>
              </div>
            </div>

            {/* Per-City Travel Hours */}
            <div className="resultCard">
              <h4 className="resultTitle">🛫 Travel Hours by City</h4>
              <div className="cityTravelList">
                {Object.entries(meetingResults.attendee_travel_hours).map(
                  ([city, hours]) => (
                    <div key={city} className="cityTravelItem">
                      <span className="cityName">{city}:</span>
                      <span className="cityHours">{hours} hrs</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

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

      {/* Hover card for office markers - positioned fixed to viewport */}
      {hoveredOffice && (
        <div
          className="officeHoverCard"
          style={{
            position: "fixed",
            left: `${hoverCardPosition.x}px`,
            top: `${hoverCardPosition.y}px`,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 1000,
          }}
        >
          <div className="officeHoverCardContent">
            <h4 className="officeHoverCardTitle">{hoveredOffice.city}</h4>
            <p className="officeHoverCardAddress">{hoveredOffice.address}</p>
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
    </div>
  );
}

export default App;
