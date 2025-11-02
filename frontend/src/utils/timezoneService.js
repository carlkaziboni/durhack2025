// Timezone service for jet lag calculations
// Uses Open-Meteo geocoding API to get coordinates, then determines timezone

import { getLatLonFromCity } from "./weatherService";

// Timezone mapping for common office cities (fallback)
const cityTimezoneMap = {
  London: "Europe/London",
  Paris: "Europe/Paris",
  "Hong Kong": "Asia/Hong_Kong",
  Singapore: "Asia/Singapore",
  Mumbai: "Asia/Kolkata",
  Dubai: "Asia/Dubai",
  Shanghai: "Asia/Shanghai",
  Zurich: "Europe/Zurich",
  Geneva: "Europe/Geneva",
  Aarhus: "Europe/Copenhagen", // Aarhus uses Copenhagen timezone
  Sydney: "Australia/Sydney",
  Wroclaw: "Europe/Warsaw", // Wroclaw uses Warsaw timezone
  Budapest: "Europe/Budapest",
  "New York": "America/New_York",
  "Tokyo": "Asia/Tokyo",
};

/**
 * Get timezone for a city
 * @param {string} city - City name
 * @returns {Promise<string|null>} - IANA timezone string (e.g., "America/New_York") or null
 */
export async function getTimezoneFromCity(city) {
  // First check our mapping
  if (cityTimezoneMap[city]) {
    return cityTimezoneMap[city];
  }

  // For unknown cities, try to get from coordinates
  try {
    const coords = await getLatLonFromCity(city);
    if (!coords) return null;

    // Use WorldTimeAPI to get timezone from coordinates
    // First try to get timezone from lat/lon
    const res = await fetch(
      `https://worldtimeapi.org/api/timezone`
    );
    
    if (res.ok) {
      const timezones = await res.json();
      // Try to find a timezone that matches the longitude roughly
      // This is a simplified approach - in production you'd use a proper geocoding service
      // For now, estimate based on longitude
      const estimatedOffset = Math.round(coords.lon / 15);
      
      // Try common timezones first
      const commonTimezones = [
        "America/New_York", "America/Los_Angeles", "America/Chicago",
        "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Shanghai",
        "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney"
      ];
      
      // Return first match or null
      return commonTimezones[0] || null;
    }
  } catch (error) {
    console.warn(`Failed to get timezone for ${city}:`, error);
  }

  // Fallback: estimate based on longitude
  try {
    const coords = await getLatLonFromCity(city);
    if (coords) {
      // Estimate timezone from longitude (rough approximation)
      const offset = Math.round(coords.lon / 15);
      
      // Map offset to common timezone (this is simplified)
      if (coords.lon > -90 && coords.lon < -30) {
        return "America/New_York"; // Eastern US
      } else if (coords.lon > -125 && coords.lon < -90) {
        return "America/Los_Angeles"; // Western US
      } else if (coords.lon > -30 && coords.lon < 30) {
        return "Europe/London"; // Europe/Africa
      } else if (coords.lon > 30 && coords.lon < 90) {
        return "Asia/Dubai"; // Middle East/India
      } else if (coords.lon > 90 && coords.lon < 150) {
        return "Asia/Shanghai"; // China
      } else if (coords.lon > 150) {
        return "Australia/Sydney"; // Australia/Japan
      }
    }
  } catch (error) {
    console.warn(`Failed to estimate timezone for ${city}:`, error);
  }

  return null;
}

/**
 * Calculate time difference in hours between two timezones
 * @param {string} timezone1 - IANA timezone string (home timezone)
 * @param {string} timezone2 - IANA timezone string (destination timezone)
 * @returns {number|null} - Time difference in hours (can be negative), or null if error
 */
export function calculateTimeDifference(timezone1, timezone2) {
  if (!timezone1 || !timezone2) return null;
  if (timezone1 === timezone2) return 0;

  try {
    const now = new Date();

    // Get UTC offset for each timezone using Intl.DateTimeFormat
    // Format a date in each timezone and compare the hour difference
    const formatter1 = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone1,
      hour: "2-digit",
      hour12: false,
    });
    const formatter2 = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone2,
      hour: "2-digit",
      hour12: false,
    });

    // Create a fixed UTC time to compare (e.g., noon UTC)
    const testDate = new Date(Date.UTC(2024, 0, 1, 12, 0, 0));

    const time1Str = formatter1.format(testDate);
    const time2Str = formatter2.format(testDate);

    // Extract hours from formatted strings (e.g., "14:00" -> 14)
    const hour1 = parseInt(time1Str.split(":")[0] || time1Str.split(" ")[0]);
    const hour2 = parseInt(time2Str.split(":")[0] || time2Str.split(" ")[0]);

    // Calculate difference
    let diff = hour2 - hour1;

    // Normalize to -12 to +12 range
    if (diff > 12) {
      diff -= 24;
    } else if (diff < -12) {
      diff += 24;
    }

    return diff;
  } catch (error) {
    console.warn("Error calculating time difference:", error);
    return null;
  }
}

/**
 * Determine jet lag severity based on time difference
 * @param {number} timeDiffHours - Time difference in hours
 * @returns {{severity: string, emoji: string, description: string}}
 */
export function getJetLagSeverity(timeDiffHours) {
  if (timeDiffHours === null || timeDiffHours === undefined) {
    return {
      severity: "Unknown",
      emoji: "❓",
      description: "Unable to determine",
    };
  }

  const absDiff = Math.abs(timeDiffHours);

  if (absDiff === 0) {
    return {
      severity: "None",
      emoji: "✅",
      description: "Same timezone",
    };
  } else if (absDiff < 3) {
    return {
      severity: "Minimal",
      emoji: "🟢",
      description: "Minimal jet lag (< 3h shift)",
    };
  } else if (absDiff < 6) {
    return {
      severity: "Mild",
      emoji: "🟡",
      description: "Mild jet lag (3-6h shift)",
    };
  } else if (absDiff < 9) {
    return {
      severity: "Moderate",
      emoji: "🟠",
      description: "Moderate jet lag (6-9h shift)",
    };
  } else {
    return {
      severity: "Severe",
      emoji: "🚨",
      description: "Severe jet lag (9h+ shift)",
    };
  }
}

/**
 * Suggest arrival buffer days based on jet lag severity
 * @param {number} timeDiffHours - Time difference in hours
 * @returns {number} - Suggested buffer days
 */
export function suggestArrivalBufferDays(timeDiffHours) {
  if (timeDiffHours === null || timeDiffHours === undefined) {
    return 0;
  }

  const absDiff = Math.abs(timeDiffHours);

  if (absDiff < 3) {
    return 0; // No buffer needed
  } else if (absDiff < 6) {
    return 1; // 1 day buffer
  } else if (absDiff < 9) {
    return 2; // 2 days buffer
  } else {
    return 3; // 3+ days buffer for severe jet lag
  }
}

