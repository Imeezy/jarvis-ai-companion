/**
 * Enhanced Web Search Module
 * Provides intelligent web search with context injection, fallbacks, and result formatting
 * Integrates with Anthropic's web_search tool and provides pre-formatted results
 */

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  snippet?: string;
}

export interface SearchContext {
  query: string;
  results: SearchResult[];
  formattedContext: string;
  source: "anthropic" | "web_search" | "local_context";
}

/**
 * Get current time and date context
 * Useful for time/date questions that don't need web search
 */
export function getCurrentTimeContext(): string {
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

  return `CURRENT TIME & DATE:\nTime: ${timeStr}\nDate: ${dateStr}`;
}

/**
 * Detect if a query is about time/date (local, no web search needed)
 */
export function isTimeOrDateQuery(query: string): boolean {
  const timeKeywords = [
    "what time",
    "current time",
    "what's the time",
    "tell me the time",
    "whats the time",
    "time is",
    "current date",
    "what date",
    "whats the date",
    "today's date",
    "todays date",
    "what day",
    "day of week",
  ];

  const lowerQuery = query.toLowerCase();
  return timeKeywords.some((kw) => lowerQuery.includes(kw));
}

/**
 * Detect if a query needs web search
 * Returns true for queries about current events, real-time info, etc.
 */
export function shouldPerformWebSearch(query: string): boolean {
  // Don't search for time/date queries
  if (isTimeOrDateQuery(query)) return false;

  const searchKeywords = [
    "what is",
    "what are",
    "current",
    "latest",
    "news",
    "today",
    "weather",
    "temperature",
    "search",
    "find",
    "look up",
    "what's",
    "whats",
    "how",
    "when",
    "where",
    "price",
    "rate",
    "stock",
    "trending",
    "top",
    "tell me about",
    "explain",
    "who is",
    "whos",
    "is",
  ];

  const lowerQuery = query.toLowerCase();
  return searchKeywords.some((keyword) => lowerQuery.includes(keyword));
}

/**
 * Extract query intent for smarter web search routing
 */
export function extractSearchIntent(
  query: string
): {
  intent: "time" | "weather" | "news" | "general" | "factual";
  cleanQuery: string;
} {
  const timeKeywords = ["time", "current time", "what time", "date", "day"];
  const weatherKeywords = [
    "weather",
    "temperature",
    "rain",
    "forecast",
    "sunny",
    "cloudy",
    "wind",
  ];
  const newsKeywords = [
    "news",
    "latest",
    "trending",
    "breaking",
    "today",
    "recent",
    "current events",
  ];
  const factualKeywords = [
    "what is",
    "who is",
    "explain",
    "define",
    "tell me",
    "facts",
    "information",
  ];

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

  if (factualKeywords.some((kw) => lowerQuery.includes(kw))) {
    return { intent: "factual", cleanQuery: query };
  }

  return { intent: "general", cleanQuery: query };
}

/**
 * Format search results into enhanced context for the LLM
 * Includes ranking, snippets, and source attribution
 */
export function formatSearchResultsForContext(
  results: SearchResult[],
  query: string
): string {
  if (!results.length) {
    return `[SEARCH COMPLETED] No results found for: "${query}"`;
  }

  const formatted = results
    .slice(0, 5) // Top 5 results
    .map(
      (r, i) =>
        `[Result ${i + 1}] ${r.title}
URL: ${r.url}
Summary: ${r.snippet || r.content.slice(0, 200)}...`
    )
    .join("\n\n");

  return `[WEB SEARCH RESULTS for "${query}"]
\n${formatted}

[END SEARCH RESULTS]`;
}

/**
 * Build enhanced system prompt with context
 */
export function buildContextualSystemPrompt(
  baseSystem: string,
  timeContext?: string,
  weatherContext?: string,
  locationContext?: string
): string {
  const contextParts: string[] = [baseSystem];

  if (timeContext) {
    contextParts.push(`\n\n${timeContext}`);
  }

  if (weatherContext) {
    contextParts.push(`\n\n${weatherContext}`);
  }

  if (locationContext) {
    contextParts.push(`\n\n${locationContext}`);
  }

  return contextParts.join("");
}

/**
 * Process web search tool results from Anthropic
 * Converts tool calls into properly formatted context
 */
export function processAnthropicToolResults(
  toolUseBlocks: any[],
  toolResults: any[]
): { searches: string[]; formattedContext: string } {
  const searches: string[] = [];
  const contextLines: string[] = [];

  for (const toolUse of toolUseBlocks) {
    if (toolUse.name === "web_search") {
      const query = toolUse.input?.query || "unknown";
      searches.push(query);
      contextLines.push(`[SEARCHED] "${query}"`);
    }
  }

  return {
    searches,
    formattedContext:
      contextLines.length > 0
        ? contextLines.join("\n")
        : "[No web searches performed]",
  };
}

/**
 * Validate and sanitize search query for API calls
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .slice(0, 300) // Limit length
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/\s+/g, " "); // Normalize whitespace
}

/**
 * Get enhanced weather context string
 */
export function buildWeatherContext(weatherData: {
  temp: number;
  condition: string;
  city: string;
  windspeed?: number;
}): string {
  const windInfo =
    weatherData.windspeed !== undefined ? ` Wind: ${weatherData.windspeed} km/h` : "";
  return `CURRENT WEATHER:\nLocation: ${weatherData.city}\nTemperature: ${weatherData.temp}°C\nCondition: ${weatherData.condition}${windInfo}`;
}

/**
 * Get location context string
 */
export function buildLocationContext(location: {
  lat: number;
  lon: number;
  city?: string;
}): string {
  return `LOCATION CONTEXT:\nCoordinates: ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}${location.city ? `\nCity: ${location.city}` : ""}`;
}
