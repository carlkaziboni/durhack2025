// utils/cityInfoService.js

// Fetch a summary from Wikipedia for any city
export async function getCitySummary(cityName) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    cityName
  )}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.extract || "No summary available.";
  } catch (e) {
    console.error("Wikipedia fetch error:", e);
    return null;
  }
}

// Fetch country info from RestCountries API
export async function getCountryInfo(countryName) {
  const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(
    countryName
  )}?fullText=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const country = data[0];
    return {
      officialName: country.name?.official,
      region: country.region,
      subregion: country.subregion,
      currency: Object.keys(country.currencies || {})[0],
      languages: Object.values(country.languages || {}).join(", "),
      visaNote: `Visa requirements depend on nationality — ${country.name?.common} typically has clear embassy guidelines.`,
    };
  } catch (e) {
    console.error("RestCountries fetch error:", e);
    return null;
  }
}
