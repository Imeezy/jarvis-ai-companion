/**
 * Enhanced Web Search Module
 * Properly integrates web search results with context injection
 * Handles real-time queries (time, date, weather, location-based)
 */

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  snippet?: string;
}

/**
 * Get current time and date context
 * Always available - no API calls needed
 */
export function getTimeContext(): string {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dateStr = now.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `Current time: ${timeStr}\nCurrent date: ${dateStr}`;
}

/**
 * Get weather context for a location
 * Uses Open-Meteo (free, no API key needed)
 */
export async function getWeatherContext(
  lat: number,
  lon: number,
  city?: string
): Promise<string> {
  try {
    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    );

    const w = await wRes.json();
    if (!w.current_weather) return "";

    const WMO_CODES: Record<number, string> = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Foggy",
      48: "Icy fog",
      51: "Light drizzle",
      53: "Drizzle",
      55: "Heavy drizzle",
      61: "Light rain",
      63: "Moderate rain",
      65: "Heavy rain",
      71: "Light snow",
      73: "Snow",
      75: "Heavy snow",
      80: "Showers",
      81: "Heavy showers",
      82: "Violent showers",
      95: "Thunderstorm",
      96: "Thunderstorm & hail",
    };

    const temp = Math.round(w.current_weather.temperature);
    const windspeed = Math.round(w.current_weather.windspeed);
    const condition =
      WMO_CODES[w.current_weather.weathercode] || "Unknown condition";
    const cityName = city || "Your location";

    return `CURRENT WEATHER in ${cityName}:\nTemperature: ${temp}°C\nCondition: ${condition}\nWind speed: ${windspeed} km/h`;
  } catch (error) {
    console.error("Weather context failed:", error);
    return "";
  }
}

/**
 * Build enhanced system context with real-time information
 */
export async function buildEnhancedSystemContext(
  baseSystem: string,
  location?: { lat: number; lon: number; city?: string } | null
): Promise<string> {
  const timeContext = getTimeContext();
  let weatherContext = "";

  if (location?.lat && location?.lon) {
    weatherContext = await getWeatherContext(
      location.lat,
      location.lon,
      location.city
    );
  }

  const contextParts = [baseSystem, timeContext];
  if (weatherContext) contextParts.push(weatherContext);

  return contextParts.join("\n\n");
}

/**
 * Check if query is obviously local (no web search needed)
 */
export function isLocalQuery(query: string): boolean {
  const localPatterns = [
    /^what time is it/i,
    /^what's the time/i,
    /^what is the current time/i,
    /^tell me the time/i,
    /^what is today/i,
    /^what's today/i,
    /^what date is it/i,
  ];

  return localPatterns.some((pattern) => pattern.test(query));
}

/**
 * Extract search intent for query classification
 */
export function extractSearchIntent(query: string): {
  intent: "time" | "weather" | "news" | "general";
  cleanQuery: string;
} {
  const timeKeywords = ["time", "what time", "current time"];
  const weatherKeywords = ["weather", "temperature", "rain", "forecast"];
  const newsKeywords = ["news", "latest", "trending", "breaking"];

  const lowerQuery = query.toLowerCase();

  if (timeKeywords.some((kw) => lowerQuery.includes(kw))) {
    return { intent: "time", cleanQuery: query };
  }

  if (weatherKeywords.some((kw) => lowerQuery.includes(kw))) {
    return { intent: "weather", cleanQuery: query };
  }

  if (newsKeywords.some((kw) => lowerQuery.includes(kw))) {
    return { intent: "news", cleanQuery: query };
  }

  return { intent: "general", cleanQuery: query };
}
