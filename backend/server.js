const express = require("express");
const cors = require("cors");
const axios = require("axios");
const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 5002;

// LLM API Configuration (set via environment variables)
const LLM_CONFIG = {
    provider: process.env.LLM_PROVIDER || "gemini", // 'gemini', 'openai', 'anthropic', or 'none'
    apiKey:
        process.env.LLM_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.OPENAI_API_KEY ||
        "",
    model: process.env.LLM_MODEL || "gemini-2.0-flash", // or 'gemini-2.5-flash', 'gemini-2.5-pro', 'gpt-4o', 'claude-sonnet-4-20250514', etc.
};

// Middleware
app.use(cors());
app.use(express.json());

// Database file path
const DB_PATH = path.join(__dirname, "weather.db");

// Database instance
let db = null;

// Initialize SQLite database
async function initDatabase() {
    const SQL = await initSqlJs();

    // Try to load existing database
    try {
        if (fs.existsSync(DB_PATH)) {
            const fileBuffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(fileBuffer);
            console.log("Loaded existing database");
        } else {
            db = new SQL.Database();
            console.log("Created new database");
        }
    } catch (error) {
        console.log("Creating new database");
        db = new SQL.Database();
    }

    // Create favorites table
    db.run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      country TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(latitude, longitude)
    )
  `);

    saveDatabase();
}

// Save database to file
function saveDatabase() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

// Geocoding API - Get coordinates from location name
app.get("/api/geocode", async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res
                .status(400)
                .json({ error: "Query parameter is required" });
        }

        const response = await axios.get(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`,
        );

        if (!response.data.results) {
            return res.json({ results: [] });
        }

        const locations = response.data.results.map((loc) => ({
            id: loc.id,
            name: loc.name,
            latitude: loc.latitude,
            longitude: loc.longitude,
            country: loc.country,
            admin1: loc.admin1,
            timezone: loc.timezone,
        }));

        res.json({ results: locations });
    } catch (error) {
        console.error("Geocoding error:", error.message);
        res.status(500).json({ error: "Failed to fetch location data" });
    }
});

// Weather API - Get current weather and forecasts
app.get("/api/weather", async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res
                .status(400)
                .json({ error: "Latitude and longitude are required" });
        }

        const response = await axios.get(
            `https://api.open-meteo.com/v1/forecast`,
            {
                params: {
                    latitude: lat,
                    longitude: lon,
                    current:
                        "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
                    hourly: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day",
                    daily: "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max",
                    timezone: "auto",
                    forecast_days: 7,
                    temperature_unit: "fahrenheit",
                    wind_speed_unit: "mph",
                    precipitation_unit: "inch",
                },
            },
        );

        res.json(response.data);
    } catch (error) {
        console.error("Weather API error:", error.message);
        res.status(500).json({ error: "Failed to fetch weather data" });
    }
});

// Favorites API
// Get all favorites
app.get("/api/favorites", (req, res) => {
    try {
        const result = db.exec(
            "SELECT * FROM favorites ORDER BY created_at DESC",
        );
        if (result.length === 0) {
            return res.json([]);
        }

        const columns = result[0].columns;
        const favorites = result[0].values.map((row) => {
            const obj = {};
            columns.forEach((col, i) => (obj[col] = row[i]));
            return obj;
        });

        res.json(favorites);
    } catch (error) {
        console.error("Database error:", error.message);
        res.status(500).json({ error: "Failed to fetch favorites" });
    }
});

// Add a favorite
app.post("/api/favorites", (req, res) => {
    try {
        const { name, latitude, longitude, country } = req.body;

        if (!name || latitude === undefined || longitude === undefined) {
            return res
                .status(400)
                .json({ error: "Name, latitude, and longitude are required" });
        }

        db.run(
            "INSERT INTO favorites (name, latitude, longitude, country) VALUES (?, ?, ?, ?)",
            [name, latitude, longitude, country || null],
        );

        saveDatabase();

        // Get the newly inserted record
        const result = db.exec(
            "SELECT * FROM favorites ORDER BY id DESC LIMIT 1",
        );
        const columns = result[0].columns;
        const row = result[0].values[0];
        const newFavorite = {};
        columns.forEach((col, i) => (newFavorite[col] = row[i]));

        res.status(201).json(newFavorite);
    } catch (error) {
        if (error.message.includes("UNIQUE constraint failed")) {
            return res
                .status(409)
                .json({ error: "Location already in favorites" });
        }
        console.error("Database error:", error.message);
        res.status(500).json({ error: "Failed to add favorite" });
    }
});

// Delete a favorite
app.delete("/api/favorites/:id", (req, res) => {
    try {
        const { id } = req.params;

        // Check if exists first
        const check = db.exec(`SELECT id FROM favorites WHERE id = ${id}`);
        if (check.length === 0 || check[0].values.length === 0) {
            return res.status(404).json({ error: "Favorite not found" });
        }

        db.run(`DELETE FROM favorites WHERE id = ${id}`);
        saveDatabase();

        res.json({ message: "Favorite deleted successfully" });
    } catch (error) {
        console.error("Database error:", error.message);
        res.status(500).json({ error: "Failed to delete favorite" });
    }
});

// Extended Weather Forecast API - Get historical and climate data for trading analysis
app.get("/api/weather/extended", async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res
                .status(400)
                .json({ error: "Latitude and longitude are required" });
        }

        // Get current weather and 16-day forecast from Open-Meteo
        const forecastResponse = await axios.get(
            `https://api.open-meteo.com/v1/forecast`,
            {
                params: {
                    latitude: lat,
                    longitude: lon,
                    current:
                        "temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m",
                    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunshine_duration",
                    timezone: "auto",
                    forecast_days: 16,
                    temperature_unit: "fahrenheit",
                },
            },
        );

        // Get historical climate data (past year for comparison)
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const formatDate = (d) => d.toISOString().split("T")[0];

        const historicalResponse = await axios.get(
            `https://archive-api.open-meteo.com/v1/archive`,
            {
                params: {
                    latitude: lat,
                    longitude: lon,
                    start_date: formatDate(oneYearAgo),
                    end_date: formatDate(today),
                    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunshine_duration",
                    timezone: "auto",
                },
            },
        );

        // Get climate normals
        const climateResponse = await axios.get(
            `https://climate-api.open-meteo.com/v1/climate`,
            {
                params: {
                    latitude: lat,
                    longitude: lon,
                    start_date: "2024-01-01",
                    end_date: "2024-12-31",
                    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
                    models: "EC_Earth3P_HR",
                },
            },
        );

        res.json({
            forecast: forecastResponse.data,
            historical: historicalResponse.data,
            climate: climateResponse.data,
        });
    } catch (error) {
        console.error("Extended weather API error:", error.message);
        res.status(500).json({
            error: "Failed to fetch extended weather data",
        });
    }
});

// AI-Powered Trading Analysis API - Real-time LLM-generated insights
app.post("/api/trading/ai-analysis", async (req, res) => {
    try {
        const { location, weatherData, computedStats } = req.body;

        if (!location || !weatherData) {
            return res
                .status(400)
                .json({ error: "Location and weather data are required" });
        }

        // Check if LLM is configured
        if (!LLM_CONFIG.apiKey || LLM_CONFIG.provider === "none") {
            return res.json({
                available: false,
                message:
                    "AI analysis not configured. Set LLM_API_KEY environment variable to enable.",
                fallbackAdvice: generateFallbackAdvice(location, computedStats),
            });
        }

        // Build the prompt with weather context
        const prompt = buildTradingPrompt(location, weatherData, computedStats);

        // Call the appropriate LLM API
        let aiResponse;
        if (
            LLM_CONFIG.provider === "gemini" ||
            LLM_CONFIG.provider === "google"
        ) {
            aiResponse = await callGeminiAPI(prompt);
        } else if (LLM_CONFIG.provider === "anthropic") {
            aiResponse = await callAnthropicAPI(prompt);
        } else if (LLM_CONFIG.provider === "openai") {
            aiResponse = await callOpenAIAPI(prompt);
        } else {
            return res.json({
                available: false,
                message: `Unknown LLM provider: ${LLM_CONFIG.provider}`,
            });
        }

        res.json({
            available: true,
            analysis: aiResponse,
            generatedAt: new Date().toISOString(),
            provider: LLM_CONFIG.provider,
            disclaimer:
                "AI-generated analysis for educational purposes only. Not financial advice. Always conduct your own research and consult with financial professionals before making investment decisions.",
        });
    } catch (error) {
        console.error("AI Analysis error:", error.message);

        // Extract more detailed error info
        let errorMessage = "Failed to generate AI analysis";
        let errorDetails = error.message;

        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            if (status === 429) {
                errorMessage = "Rate limit exceeded";
                errorDetails =
                    "The AI service is temporarily unavailable due to rate limiting. Please wait a moment and try again.";
            } else if (status === 401 || status === 403) {
                errorMessage = "API authentication failed";
                errorDetails =
                    "Please check that your LLM_API_KEY is valid and has the necessary permissions.";
            } else if (status === 400) {
                errorMessage = "Invalid request";
                errorDetails =
                    data?.error?.message ||
                    "The request to the AI service was invalid.";
            } else {
                errorDetails =
                    data?.error?.message || data?.message || error.message;
            }

            console.error(`AI API Error - Status: ${status}, Details:`, data);
        }

        res.status(500).json({
            error: errorMessage,
            details: errorDetails,
            provider: LLM_CONFIG.provider,
            fallbackAdvice: generateFallbackAdvice(
                req.body?.location,
                req.body?.computedStats,
            ),
        });
    }
});

// Build a comprehensive prompt for the LLM
function buildTradingPrompt(location, weatherData, computedStats) {
    const { forecast, historical } = weatherData;
    const stats = computedStats || {};

    const currentDate = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const currentYear = new Date().getFullYear();

    return `You are an elite weather-commodities trading analyst at a major hedge fund. Your job is to provide SPECIFIC, ACTIONABLE trade recommendations with exact ticker symbols. You have access to your training knowledge about markets, recent events, and financial instruments.

## CRITICAL REQUIREMENTS
1. You MUST provide SPECIFIC TICKER SYMBOLS for every trade (e.g., UNG, XLE, ED, CORN, DVN, etc.)
2. You MUST include concrete entry points, targets, and stop losses
3. You MUST consider current events and news that intersect with weather impacts
4. Think about regional companies headquartered in or heavily exposed to ${location.name}
5. Consider second-order effects: supply chains, consumer behavior, earnings impacts

## Current Date
${currentDate}, ${currentYear}

## Location: ${location.name}, ${location.country || ""}

### Regional Context to Consider
- What major companies are headquartered here or have significant operations?
- What is the local energy infrastructure (utilities, pipelines, power plants)?
- What agricultural products are grown in this region?
- What ports, airports, or logistics hubs could be affected?
- What seasonal retail patterns exist here?
- Are there any current news events or earnings seasons to consider?

## WEATHER DATA

### Current Conditions
| Metric | Value | Context |
|--------|-------|---------|
| Temperature | ${stats.currentTemp?.toFixed(1) || "N/A"}°F | vs ${stats.avgHistTemp?.toFixed(1) || "N/A"}°F historical average |
| Anomaly | ${stats.tempAnomaly?.toFixed(1) || "N/A"}°F | ${Math.abs(stats.tempAnomaly) > 10 ? "SIGNIFICANT DEVIATION" : Math.abs(stats.tempAnomaly) > 5 ? "Notable deviation" : "Within normal range"} |
| Season | ${stats.season || "N/A"} | |
| Humidity | ${stats.avgHumidity || "N/A"}% | |

### Precipitation
| Metric | Value |
|--------|-------|
| Outlook | ${stats.precipOutlook || "N/A"} |
| vs Normal | ${stats.precipRatio ? (stats.precipRatio * 100).toFixed(0) + "%" : "N/A"} of typical |
| Next 7 Days | ${stats.next7DaysPrecip?.toFixed(2) || "N/A"} inches |
| Abnormal? | ${stats.isWetPeriod ? "🌧️ UNUSUALLY WET" : stats.isDryPeriod ? "🏜️ UNUSUALLY DRY" : "Normal"} |

### Forecast Alerts
${stats.forecastHasExtremeHeat ? "🔥 **EXTREME HEAT WARNING** - Heat wave conditions expected\n" : ""}${stats.forecastHasExtremeCold ? "❄️ **EXTREME COLD WARNING** - Arctic conditions expected\n" : ""}${stats.isHighVolatility ? "⚠️ **HIGH VOLATILITY** - Rapid temperature swings expected\n" : ""}

### 14-Day Forecast
${
    forecast?.daily?.time
        ?.slice(0, 14)
        .map(
            (date, i) =>
                `${date}: H:${forecast?.daily?.temperature_2m_max?.[i]?.toFixed(0) || "?"}°F L:${forecast?.daily?.temperature_2m_min?.[i]?.toFixed(0) || "?"}°F ${forecast?.daily?.precipitation_sum?.[i] > 0.1 ? "🌧️" + forecast?.daily?.precipitation_sum?.[i]?.toFixed(1) + '"' : ""}`,
        )
        .join("\n") || "Forecast unavailable"
}

---

## YOUR ANALYSIS (Required Format)

### 📊 Executive Summary
[2-3 sentences: What is THE key weather-driven trade right now for ${location.name}? Be specific and actionable.]

### 💹 Trade Recommendations

Provide EXACTLY 5 specific trades. Use this EXACT format:

---
**Trade 1: [Name]**
- **Ticker:** [EXACT SYMBOL like UNG, XLE, ED, CORN]
- **Action:** [BUY / SELL / SHORT]
- **Entry:** [Specific price or "at market open" or "on dip to $X"]
- **Target:** [+X% or specific price]
- **Stop Loss:** [-X% or specific price]
- **Timeframe:** [X days/weeks]
- **Confidence:** [High/Medium/Low]
- **Why:** [2-3 sentences explaining the weather→trade connection]
- **Risk:** [What could go wrong]
---

[Repeat for Trades 2-5]

### 🏭 Sector Analysis for ${location.name}

**Energy & Utilities**
- Local utilities: [Name specific companies like ConEd (ED), National Grid, etc.]
- Impact: [How does this weather affect them specifically?]
- Heating/Cooling demand outlook: [Specific]

**Regional Companies**
- [List 3-5 companies headquartered in or heavily exposed to ${location.name}]
- [How might their operations/earnings be affected?]

**Agriculture & Commodities**
- Relevant crops for this region: [Be specific]
- Commodity plays: [Specific tickers like CORN, WEAT, SOYB, DBA]

**Retail & Consumer**
- Weather-sensitive retailers with exposure: [Specific names/tickers]
- Consumer behavior impact: [Specific]

**Transportation & Logistics**
- [Airports, ports, rails, trucking companies affected]
- [Disruption risks and plays]

### 📰 News & Catalysts to Watch
1. [Specific upcoming event #1 - earnings, reports, weather events]
2. [Specific upcoming event #2]
3. [Specific upcoming event #3]
4. Government reports to monitor: [EIA storage, USDA crops, etc.]

### 🔄 Contrarian View
[One paragraph: Why might the obvious trade FAIL? What's the other side of this trade thinking? What alternative positioning could work if the consensus is wrong?]

---
Remember: Provide REAL ticker symbols. Be SPECIFIC. Traders need actionable intelligence, not generic commentary.`;
}

// Call Google Gemini API with automatic fallback for rate limits or unavailable models
async function callGeminiAPI(prompt, retryCount = 0) {
    // Model priority list - using models confirmed available via ListModels API
    const modelOptions = [
        LLM_CONFIG.model,
        "gemini-2.0-flash", // Fast and capable
        "gemini-2.5-flash", // Latest flash model
        "gemini-2.0-flash-lite", // Lightweight option
        "gemini-flash-latest", // Generic latest flash
        "gemini-pro-latest", // Pro model fallback
    ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates

    const model = modelOptions[Math.min(retryCount, modelOptions.length - 1)];

    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${LLM_CONFIG.apiKey}`,
            {
                contents: [
                    {
                        parts: [
                            {
                                text: prompt,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 8192,
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_ONLY_HIGH",
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_ONLY_HIGH",
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_ONLY_HIGH",
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_ONLY_HIGH",
                    },
                ],
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
                timeout: 60000,
            },
        );

        // Extract text from Gemini response
        const candidate = response.data.candidates?.[0];
        const content = candidate?.content?.parts?.[0]?.text;

        if (!content) {
            throw new Error("No content in Gemini response");
        }
        return content;
    } catch (error) {
        const status = error.response?.status;
        // If rate limited (429) or model not found (404), try next model
        if (
            (status === 429 || status === 404) &&
            retryCount < modelOptions.length - 1
        ) {
            // Wait a moment before retry
            await new Promise((resolve) => setTimeout(resolve, 500));
            return callGeminiAPI(prompt, retryCount + 1);
        }
        throw error;
    }
}

// Call Anthropic Claude API
async function callAnthropicAPI(prompt) {
    const response = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
            model: LLM_CONFIG.model.includes("claude")
                ? LLM_CONFIG.model
                : "claude-sonnet-4-20250514",
            max_tokens: 2000,
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
        },
        {
            headers: {
                "Content-Type": "application/json",
                "x-api-key": LLM_CONFIG.apiKey,
                "anthropic-version": "2023-06-01",
            },
            timeout: 60000,
        },
    );

    return response.data.content[0].text;
}

// Call OpenAI API
async function callOpenAIAPI(prompt) {
    const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
            model: LLM_CONFIG.model.includes("gpt")
                ? LLM_CONFIG.model
                : "gpt-4o",
            max_tokens: 2000,
            messages: [
                {
                    role: "system",
                    content:
                        "You are an expert weather-commodities trading analyst. Provide specific, actionable trading insights based on weather patterns. Use appropriate regional market instruments.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
        },
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LLM_CONFIG.apiKey}`,
            },
            timeout: 60000,
        },
    );

    return response.data.choices[0].message.content;
}

// Fallback advice when LLM is not available
function generateFallbackAdvice(location, stats) {
    const tips = [];

    if (stats?.tempAnomaly > 5) {
        tips.push(
            `Significant heat anomaly (+${stats.tempAnomaly.toFixed(1)}°F) detected. Consider energy sector exposure for increased cooling demand.`,
        );
    } else if (stats?.tempAnomaly < -5) {
        tips.push(
            `Significant cold anomaly (${stats.tempAnomaly.toFixed(1)}°F) detected. Natural gas and heating-related investments may benefit.`,
        );
    }

    if (
        stats?.isDryPeriod &&
        (stats?.season === "spring" || stats?.season === "summer")
    ) {
        tips.push(
            `Drought conditions during growing season may impact agricultural commodity prices. Monitor crop reports.`,
        );
    }

    if (stats?.isWetPeriod) {
        tips.push(
            `Above-normal precipitation may affect planting/harvest schedules and flood-sensitive industries.`,
        );
    }

    if (tips.length === 0) {
        tips.push(
            `Weather conditions are near normal for ${location?.name || "this location"}. Limited weather-driven trading opportunities at this time.`,
        );
    }

    tips.push(
        `For detailed AI-powered analysis, configure an LLM API key (set LLM_API_KEY environment variable).`,
    );

    return tips;
}

// Trading Analysis API - Generate trade recommendations based on weather
app.post("/api/trading/analyze", async (req, res) => {
    try {
        const { location, weatherData } = req.body;

        if (!location || !weatherData) {
            return res
                .status(400)
                .json({ error: "Location and weather data are required" });
        }

        // Generate trading analysis based on weather patterns
        const analysis = generateTradingAnalysis(location, weatherData);

        res.json(analysis);
    } catch (error) {
        console.error("Trading analysis error:", error.message);
        res.status(500).json({ error: "Failed to generate trading analysis" });
    }
});

// Weather-based trading analysis generator - fully dynamic and location-aware
function generateTradingAnalysis(location, weatherData) {
    const { forecast, historical, climate } = weatherData;

    // Compute comprehensive weather statistics from actual data
    const stats = computeWeatherStatistics(forecast, historical, climate);

    // Determine region and market context
    const regionInfo = getRegionInfo(location);

    // Generate dynamic synopsis based on actual computed data
    const synopsis = {
        days30: generateDynamicSynopsis(30, stats, regionInfo),
        days60: generateDynamicSynopsis(60, stats, regionInfo),
        days90: generateDynamicSynopsis(90, stats, regionInfo),
        days180: generateDynamicSynopsis(180, stats, regionInfo),
        days360: generateDynamicSynopsis(360, stats, regionInfo),
    };

    // Generate location-appropriate trade recommendations
    const trades = generateDynamicTradeRecommendations(
        stats,
        regionInfo,
        location,
    );

    return {
        location: location.name,
        country: location.country,
        region: regionInfo.region,
        generatedAt: new Date().toISOString(),
        currentConditions: {
            temperature: stats.currentTemp,
            tempAnomaly: stats.tempAnomaly.toFixed(1),
            precipitationOutlook: stats.precipOutlook,
            season:
                stats.season.charAt(0).toUpperCase() + stats.season.slice(1),
            humidity: stats.avgHumidity,
            windSpeed: stats.avgWindSpeed,
        },
        synopsis,
        trades,
        disclaimer:
            "This analysis is for educational purposes only and should not be considered financial advice. Weather-based trading involves significant risk. Past weather patterns do not guarantee future market performance.",
    };
}

// Convert Celsius to Fahrenheit
function celsiusToFahrenheit(celsius) {
    if (celsius === null || celsius === undefined || isNaN(celsius))
        return null;
    return (celsius * 9) / 5 + 32;
}

// Compute comprehensive statistics from weather data
function computeWeatherStatistics(forecast, historical, climate) {
    const now = new Date();
    const month = now.getMonth();

    // Historical temperature analysis (archive API returns Celsius, convert to Fahrenheit)
    const histTempMaxC = historical?.daily?.temperature_2m_max || [];
    const histTempMinC = historical?.daily?.temperature_2m_min || [];
    const histTempMax = histTempMaxC
        .map(celsiusToFahrenheit)
        .filter((v) => v !== null);
    const histTempMin = histTempMinC
        .map(celsiusToFahrenheit)
        .filter((v) => v !== null);
    const histPrecip = historical?.daily?.precipitation_sum || [];
    const histWind = historical?.daily?.wind_speed_10m_max || [];

    // Forecast data (already in Fahrenheit from API with temperature_unit param)
    const forecastTempMax = (forecast?.daily?.temperature_2m_max || []).filter(
        (v) => v !== null,
    );
    const forecastTempMin = (forecast?.daily?.temperature_2m_min || []).filter(
        (v) => v !== null,
    );
    const forecastPrecip = forecast?.daily?.precipitation_sum || [];

    // Current conditions (already in Fahrenheit from API)
    const currentTemp =
        forecast?.current?.temperature_2m ?? forecastTempMax[0] ?? 68;
    const currentHumidity = forecast?.current?.relative_humidity_2m || 50;
    const currentWind = forecast?.current?.wind_speed_10m || 10;

    // Calculate historical averages
    const avgHistTempMax = calculateAverage(histTempMax);
    const avgHistTempMin = calculateAverage(histTempMin);
    const avgHistTemp = (avgHistTempMax + avgHistTempMin) / 2;
    const avgHistPrecip = calculateAverage(histPrecip);
    const avgHistWind = calculateAverage(histWind);

    // Calculate standard deviations for anomaly significance
    const tempStdDev = calculateStdDev(histTempMax);
    const precipStdDev = calculateStdDev(histPrecip);

    // Temperature anomaly (current vs historical average)
    const tempAnomaly = currentTemp - avgHistTemp;
    const tempAnomalySignificance =
        tempStdDev > 0 ? Math.abs(tempAnomaly) / tempStdDev : 0;

    // Precipitation analysis (next 7 days vs historical average)
    const next7DaysPrecip = forecastPrecip
        .slice(0, 7)
        .reduce((a, b) => a + (b || 0), 0);
    const avgWeeklyPrecip = avgHistPrecip * 7;
    const precipRatio =
        avgWeeklyPrecip > 0 ? next7DaysPrecip / avgWeeklyPrecip : 1;

    // Trend analysis (comparing recent period to longer historical)
    const last30DaysTemp = histTempMax.slice(-30);
    const last90DaysTemp = histTempMax.slice(-90);
    const recentTempTrend =
        calculateAverage(last30DaysTemp) - calculateAverage(last90DaysTemp);

    const last30DaysPrecip = histPrecip.slice(-30);
    const last90DaysPrecip = histPrecip.slice(-90);
    const recentPrecipTrend =
        calculateAverage(last30DaysPrecip) - calculateAverage(last90DaysPrecip);

    // Seasonal determination based on latitude
    const latitude = forecast?.latitude || 45;
    const isNorthernHemisphere = latitude >= 0;

    let season;
    if (isNorthernHemisphere) {
        if (month >= 2 && month <= 4) season = "spring";
        else if (month >= 5 && month <= 7) season = "summer";
        else if (month >= 8 && month <= 10) season = "fall";
        else season = "winter";
    } else {
        if (month >= 2 && month <= 4) season = "fall";
        else if (month >= 5 && month <= 7) season = "winter";
        else if (month >= 8 && month <= 10) season = "spring";
        else season = "summer";
    }

    // Determine precipitation outlook
    let precipOutlook;
    if (precipRatio > 1.5) precipOutlook = "Much Above Normal";
    else if (precipRatio > 1.2) precipOutlook = "Above Normal";
    else if (precipRatio < 0.5) precipOutlook = "Much Below Normal";
    else if (precipRatio < 0.8) precipOutlook = "Below Normal";
    else precipOutlook = "Near Normal";

    // Volatility analysis (threshold adjusted for Fahrenheit)
    const tempVolatility = tempStdDev;
    const isHighVolatility = tempVolatility > 14;

    // Extreme event detection
    const extremeHeatThreshold = avgHistTempMax + 2 * tempStdDev;
    const extremeColdThreshold = avgHistTempMin - 2 * tempStdDev;
    const forecastHasExtremeHeat = forecastTempMax.some(
        (t) => t > extremeHeatThreshold,
    );
    const forecastHasExtremeCold = forecastTempMin.some(
        (t) => t < extremeColdThreshold,
    );

    return {
        currentTemp,
        avgHistTemp,
        tempAnomaly,
        tempAnomalySignificance,
        tempStdDev,
        avgHistPrecip,
        precipRatio,
        precipStdDev,
        precipOutlook,
        next7DaysPrecip,
        avgWeeklyPrecip,
        recentTempTrend,
        recentPrecipTrend,
        season,
        isNorthernHemisphere,
        latitude,
        avgHumidity: Math.round(currentHumidity),
        avgWindSpeed: Math.round(currentWind),
        avgHistWind,
        tempVolatility,
        isHighVolatility,
        forecastHasExtremeHeat,
        forecastHasExtremeCold,
        isWetPeriod: precipRatio > 1.3,
        isDryPeriod: precipRatio < 0.7,
        forecastDays: forecastTempMax.length,
    };
}

function calculateAverage(arr) {
    if (!arr || arr.length === 0) return 0;
    const validValues = arr.filter(
        (v) => v !== null && v !== undefined && !isNaN(v),
    );
    return validValues.length > 0
        ? validValues.reduce((a, b) => a + b, 0) / validValues.length
        : 0;
}

function calculateStdDev(arr) {
    const validValues = arr.filter(
        (v) => v !== null && v !== undefined && !isNaN(v),
    );
    if (validValues.length < 2) return 0;
    const avg = calculateAverage(validValues);
    const squareDiffs = validValues.map((v) => Math.pow(v - avg, 2));
    return Math.sqrt(calculateAverage(squareDiffs));
}

// Get region information for location-appropriate recommendations
function getRegionInfo(location) {
    const country = (location.country || "").toLowerCase();
    const lat = location.latitude || 0;
    const lon = location.longitude || 0;

    // Determine region and market based on country and coordinates
    let region, market, currency, commodityRelevance;

    // North America
    if (
        ["united states", "usa", "us"].includes(country) ||
        (lon >= -130 && lon <= -60 && lat >= 25 && lat <= 50)
    ) {
        region = "North America";
        market = "US";
        currency = "USD";
        commodityRelevance = [
            "corn",
            "soybeans",
            "wheat",
            "natural_gas",
            "oil",
        ];
    }
    // Canada
    else if (
        country === "canada" ||
        (lon >= -140 && lon <= -50 && lat >= 50 && lat <= 85)
    ) {
        region = "North America";
        market = "Canada";
        currency = "CAD";
        commodityRelevance = [
            "wheat",
            "canola",
            "natural_gas",
            "oil",
            "lumber",
        ];
    }
    // Europe
    else if (
        [
            "germany",
            "france",
            "italy",
            "spain",
            "united kingdom",
            "uk",
            "netherlands",
            "belgium",
            "austria",
            "switzerland",
            "poland",
            "sweden",
            "norway",
            "denmark",
            "finland",
            "ireland",
            "portugal",
            "greece",
            "czech republic",
            "hungary",
        ].includes(country) ||
        (lon >= -10 && lon <= 40 && lat >= 35 && lat <= 70)
    ) {
        region = "Europe";
        market = "EU";
        currency = "EUR";
        commodityRelevance = ["wheat", "natural_gas", "wine", "olive_oil"];
    }
    // UK specific
    else if (country === "united kingdom" || country === "uk") {
        region = "Europe";
        market = "UK";
        currency = "GBP";
        commodityRelevance = ["wheat", "natural_gas", "barley"];
    }
    // Japan
    else if (
        country === "japan" ||
        (lon >= 129 && lon <= 146 && lat >= 31 && lat <= 46)
    ) {
        region = "Asia Pacific";
        market = "Japan";
        currency = "JPY";
        commodityRelevance = ["rice", "natural_gas", "lng"];
    }
    // China
    else if (
        country === "china" ||
        (lon >= 73 && lon <= 135 && lat >= 18 && lat <= 54)
    ) {
        region = "Asia Pacific";
        market = "China";
        currency = "CNY";
        commodityRelevance = ["rice", "soybeans", "wheat", "coal", "pork"];
    }
    // Australia
    else if (
        country === "australia" ||
        (lon >= 113 && lon <= 154 && lat >= -44 && lat <= -10)
    ) {
        region = "Asia Pacific";
        market = "Australia";
        currency = "AUD";
        commodityRelevance = ["wheat", "iron_ore", "coal", "wool", "cattle"];
    }
    // India
    else if (
        country === "india" ||
        (lon >= 68 && lon <= 97 && lat >= 8 && lat <= 37)
    ) {
        region = "Asia Pacific";
        market = "India";
        currency = "INR";
        commodityRelevance = ["rice", "wheat", "cotton", "sugar", "tea"];
    }
    // Brazil
    else if (
        country === "brazil" ||
        (lon >= -74 && lon <= -34 && lat >= -34 && lat <= 5)
    ) {
        region = "Latin America";
        market = "Brazil";
        currency = "BRL";
        commodityRelevance = [
            "coffee",
            "soybeans",
            "sugar",
            "orange_juice",
            "cattle",
        ];
    }
    // Other Latin America
    else if (lon >= -120 && lon <= -34 && lat >= -56 && lat <= 33) {
        region = "Latin America";
        market = "LatAm";
        currency = "USD";
        commodityRelevance = ["coffee", "sugar", "grains", "copper"];
    }
    // Middle East
    else if (
        (lon >= 25 && lon <= 65 && lat >= 12 && lat <= 42) ||
        [
            "saudi arabia",
            "uae",
            "united arab emirates",
            "qatar",
            "kuwait",
            "iran",
            "iraq",
            "israel",
        ].includes(country)
    ) {
        region = "Middle East";
        market = "MENA";
        currency = "USD";
        commodityRelevance = ["oil", "natural_gas", "dates"];
    }
    // Africa
    else if (lon >= -20 && lon <= 55 && lat >= -35 && lat <= 37) {
        region = "Africa";
        market = "Africa";
        currency = "USD";
        commodityRelevance = ["cocoa", "coffee", "oil", "gold", "cotton"];
    }
    // Southeast Asia
    else if (lon >= 90 && lon <= 140 && lat >= -10 && lat <= 25) {
        region = "Asia Pacific";
        market = "SEA";
        currency = "USD";
        commodityRelevance = ["rice", "palm_oil", "rubber", "coffee"];
    }
    // Default - Global
    else {
        region = "Global";
        market = "Global";
        currency = "USD";
        commodityRelevance = ["oil", "gold", "grains"];
    }

    return {
        region,
        market,
        currency,
        commodityRelevance,
        country: location.country,
    };
}

// Generate dynamic synopsis based on computed statistics
function generateDynamicSynopsis(days, stats, regionInfo) {
    const {
        tempAnomaly,
        tempAnomalySignificance,
        precipRatio,
        precipOutlook,
        season,
        recentTempTrend,
        recentPrecipTrend,
        isHighVolatility,
        forecastHasExtremeHeat,
        forecastHasExtremeCold,
        currentTemp,
        avgHistTemp,
        next7DaysPrecip,
        avgWeeklyPrecip,
        isNorthernHemisphere,
        latitude,
    } = stats;

    // Determine temperature trend description
    let tempDescription;
    if (tempAnomalySignificance > 2) {
        tempDescription =
            tempAnomaly > 0
                ? "significantly warmer than normal"
                : "significantly cooler than normal";
    } else if (tempAnomalySignificance > 1) {
        tempDescription =
            tempAnomaly > 0 ? "warmer than normal" : "cooler than normal";
    } else if (Math.abs(tempAnomaly) > 1) {
        tempDescription =
            tempAnomaly > 0
                ? "slightly above normal temperatures"
                : "slightly below normal temperatures";
    } else {
        tempDescription = "near normal temperatures";
    }

    // Determine precipitation description
    let precipDescription;
    if (precipRatio > 2)
        precipDescription = "exceptionally wet conditions expected";
    else if (precipRatio > 1.5)
        precipDescription = "above average precipitation likely";
    else if (precipRatio > 1.2)
        precipDescription = "slightly wetter than normal";
    else if (precipRatio < 0.3)
        precipDescription = "very dry conditions persisting";
    else if (precipRatio < 0.5)
        precipDescription = "below average precipitation expected";
    else if (precipRatio < 0.8)
        precipDescription = "slightly drier than normal";
    else precipDescription = "near normal precipitation";

    // Build summary
    const summary = `${tempDescription.charAt(0).toUpperCase() + tempDescription.slice(1)} with ${precipDescription}.`;

    // Generate period-specific details based on actual data
    let details;
    const trendInfo =
        recentTempTrend > 1
            ? "warming trend observed"
            : recentTempTrend < -1
              ? "cooling trend observed"
              : "stable temperature pattern";

    const extremeWarning = forecastHasExtremeHeat
        ? " Extreme heat events possible in the near term."
        : forecastHasExtremeCold
          ? " Extreme cold events possible in the near term."
          : "";

    const volatilityNote = isHighVolatility
        ? " High temperature variability may create challenging conditions."
        : "";

    // Climate zone context
    const climateContext =
        Math.abs(latitude) > 55
            ? "High latitude location experiences significant seasonal variation."
            : Math.abs(latitude) < 23.5
              ? "Tropical location with minimal seasonal temperature variation."
              : Math.abs(latitude) < 35
                ? "Subtropical climate with moderate seasonal changes."
                : "Mid-latitude location with distinct seasonal patterns.";

    if (days <= 30) {
        const weeklyPrecipInfo =
            next7DaysPrecip > 0
                ? `Next 7 days: ${next7DaysPrecip.toFixed(1)}mm precipitation expected (avg: ${avgWeeklyPrecip.toFixed(1)}mm).`
                : "Minimal precipitation expected in the near term.";
        details = `Current temperature ${currentTemp.toFixed(1)}°F vs historical average ${avgHistTemp.toFixed(1)}°F. ${weeklyPrecipInfo} ${trendInfo}.${extremeWarning}${volatilityNote}`;
    } else if (days <= 60) {
        const seasonalTransition = getSeason(
            new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
            isNorthernHemisphere,
        );
        details = `${trendInfo}. ${seasonalTransition !== season ? `Seasonal transition toward ${seasonalTransition} expected.` : `${season.charAt(0).toUpperCase() + season.slice(1)} conditions to continue.`} ${precipDescription}.${volatilityNote}`;
    } else if (days <= 90) {
        details = `${climateContext} Based on historical patterns, expect ${tempDescription} to moderate toward seasonal norms. ${precipDescription} as seasonal patterns evolve.`;
    } else if (days <= 180) {
        const seasons = getSeasonSequence(season, days, isNorthernHemisphere);
        details = `Extended outlook spans ${seasons.join(" → ")}. Historical data suggests ${precipOutlook.toLowerCase()} precipitation tendency. Temperature patterns typically follow climatological norms with ${isHighVolatility ? "significant" : "moderate"} variability.`;
    } else {
        details = `Full annual cycle analysis. ${climateContext} Region experiences ${season} currently, cycling through all seasons. Long-term patterns based on historical climatology for ${regionInfo.country || regionInfo.region}.`;
    }

    // Calculate confidence based on forecast reliability and data quality
    let confidence;
    if (days <= 14) confidence = "High";
    else if (days <= 30) confidence = "Moderate-High";
    else if (days <= 60) confidence = "Moderate";
    else if (days <= 90) confidence = "Low-Moderate";
    else confidence = "Seasonal Average";

    return {
        period: `${days}-Day Outlook`,
        summary,
        details,
        confidence,
        temperatureOutlook:
            tempAnomaly > 2
                ? "Above Normal"
                : tempAnomaly < -2
                  ? "Below Normal"
                  : "Near Normal",
        precipitationOutlook: precipOutlook,
        dataPoints: {
            currentTemp: currentTemp.toFixed(1),
            historicalAvg: avgHistTemp.toFixed(1),
            anomaly: (tempAnomaly > 0 ? "+" : "") + tempAnomaly.toFixed(1),
            precipRatio: (precipRatio * 100).toFixed(0) + "% of normal",
        },
    };
}

function getSeason(date, isNorthern) {
    const month = date.getMonth();
    if (isNorthern) {
        if (month >= 2 && month <= 4) return "spring";
        if (month >= 5 && month <= 7) return "summer";
        if (month >= 8 && month <= 10) return "fall";
        return "winter";
    } else {
        if (month >= 2 && month <= 4) return "fall";
        if (month >= 5 && month <= 7) return "winter";
        if (month >= 8 && month <= 10) return "spring";
        return "summer";
    }
}

function getSeasonSequence(currentSeason, days, isNorthern) {
    const seasons = isNorthern
        ? ["winter", "spring", "summer", "fall"]
        : ["summer", "fall", "winter", "spring"];
    const idx = seasons.indexOf(currentSeason);
    const numSeasons = Math.min(Math.ceil(days / 90), 4);
    const result = [];
    for (let i = 0; i < numSeasons; i++) {
        result.push(seasons[(idx + i) % 4]);
    }
    return result;
}

// Regional market instruments database
const MARKET_INSTRUMENTS = {
    US: {
        energy: [
            {
                ticker: "XLE",
                name: "Energy Select Sector SPDR Fund",
                type: "ETF",
            },
            { ticker: "VDE", name: "Vanguard Energy ETF", type: "ETF" },
        ],
        naturalGas: [
            {
                ticker: "UNG",
                name: "United States Natural Gas Fund",
                type: "ETF",
            },
            {
                ticker: "BOIL",
                name: "ProShares Ultra Bloomberg Natural Gas",
                type: "ETF",
            },
        ],
        utilities: [
            {
                ticker: "XLU",
                name: "Utilities Select Sector SPDR Fund",
                type: "ETF",
            },
            { ticker: "VPU", name: "Vanguard Utilities ETF", type: "ETF" },
        ],
        agriculture: [
            { ticker: "DBA", name: "Invesco DB Agriculture Fund", type: "ETF" },
            { ticker: "MOO", name: "VanEck Agribusiness ETF", type: "ETF" },
        ],
        corn: [{ ticker: "CORN", name: "Teucrium Corn Fund", type: "ETF" }],
        soybeans: [
            { ticker: "SOYB", name: "Teucrium Soybean Fund", type: "ETF" },
        ],
        wheat: [{ ticker: "WEAT", name: "Teucrium Wheat Fund", type: "ETF" }],
        broadMarket: [
            { ticker: "SPY", name: "SPDR S&P 500 ETF", type: "ETF" },
            {
                ticker: "VTI",
                name: "Vanguard Total Stock Market ETF",
                type: "ETF",
            },
        ],
        retail: [
            { ticker: "XRT", name: "SPDR S&P Retail ETF", type: "ETF" },
            { ticker: "RTH", name: "VanEck Retail ETF", type: "ETF" },
        ],
    },
    EU: {
        energy: [
            {
                ticker: "IEUR.DE",
                name: "iShares STOXX Europe 600 Oil & Gas",
                type: "ETF",
                exchange: "Xetra",
            },
            {
                ticker: "SX6P.DE",
                name: "STOXX Europe 600 Oil & Gas",
                type: "Index",
                exchange: "Eurex",
            },
        ],
        naturalGas: [
            {
                ticker: "TTF",
                name: "Dutch TTF Natural Gas Futures",
                type: "Futures",
                exchange: "ICE",
            },
            {
                ticker: "MNGA.L",
                name: "WisdomTree Natural Gas",
                type: "ETC",
                exchange: "LSE",
            },
        ],
        utilities: [
            {
                ticker: "EXH5.DE",
                name: "iShares STOXX Europe 600 Utilities",
                type: "ETF",
                exchange: "Xetra",
            },
            {
                ticker: "SX6E",
                name: "STOXX Europe 600 Utilities",
                type: "Index",
                exchange: "Eurex",
            },
        ],
        agriculture: [
            {
                ticker: "APTS.L",
                name: "iShares Agribusiness UCITS ETF",
                type: "ETF",
                exchange: "LSE",
            },
            {
                ticker: "FAGR.PA",
                name: "Lyxor MSCI World Agriculture",
                type: "ETF",
                exchange: "Euronext",
            },
        ],
        wheat: [
            {
                ticker: "WEAT.L",
                name: "WisdomTree Wheat",
                type: "ETC",
                exchange: "LSE",
            },
            {
                ticker: "EBM",
                name: "European Milling Wheat Futures",
                type: "Futures",
                exchange: "Euronext",
            },
        ],
        broadMarket: [
            {
                ticker: "MEUD.L",
                name: "iShares Core MSCI Europe UCITS",
                type: "ETF",
                exchange: "LSE",
            },
            {
                ticker: "VGK",
                name: "Vanguard FTSE Europe ETF",
                type: "ETF",
                exchange: "NYSE",
            },
        ],
    },
    UK: {
        energy: [
            {
                ticker: "ISF.L",
                name: "iShares Core FTSE 100 (Energy exposure)",
                type: "ETF",
                exchange: "LSE",
            },
            { ticker: "BP.L", name: "BP plc", type: "Stock", exchange: "LSE" },
        ],
        naturalGas: [
            {
                ticker: "NGAS.L",
                name: "WisdomTree Natural Gas",
                type: "ETC",
                exchange: "LSE",
            },
            {
                ticker: "NBP",
                name: "UK NBP Natural Gas Futures",
                type: "Futures",
                exchange: "ICE",
            },
        ],
        utilities: [
            {
                ticker: "UKX",
                name: "FTSE 100 Utilities Sector",
                type: "Index",
                exchange: "LSE",
            },
            {
                ticker: "NG.L",
                name: "National Grid plc",
                type: "Stock",
                exchange: "LSE",
            },
        ],
        broadMarket: [
            {
                ticker: "ISF.L",
                name: "iShares Core FTSE 100",
                type: "ETF",
                exchange: "LSE",
            },
            {
                ticker: "VUKE.L",
                name: "Vanguard FTSE 100 UCITS ETF",
                type: "ETF",
                exchange: "LSE",
            },
        ],
    },
    Japan: {
        energy: [
            {
                ticker: "1605.T",
                name: "INPEX Corporation",
                type: "Stock",
                exchange: "TSE",
            },
            {
                ticker: "1662.T",
                name: "JGC Holdings",
                type: "Stock",
                exchange: "TSE",
            },
        ],
        utilities: [
            {
                ticker: "9501.T",
                name: "Tokyo Electric Power",
                type: "Stock",
                exchange: "TSE",
            },
            {
                ticker: "9502.T",
                name: "Chubu Electric Power",
                type: "Stock",
                exchange: "TSE",
            },
        ],
        broadMarket: [
            {
                ticker: "EWJ",
                name: "iShares MSCI Japan ETF",
                type: "ETF",
                exchange: "NYSE",
            },
            {
                ticker: "1306.T",
                name: "TOPIX ETF",
                type: "ETF",
                exchange: "TSE",
            },
        ],
    },
    Australia: {
        energy: [
            {
                ticker: "XEJ.AX",
                name: "S&P/ASX 200 Energy",
                type: "ETF",
                exchange: "ASX",
            },
            {
                ticker: "WDS.AX",
                name: "Woodside Energy",
                type: "Stock",
                exchange: "ASX",
            },
        ],
        utilities: [
            {
                ticker: "XUJ.AX",
                name: "S&P/ASX 200 Utilities",
                type: "ETF",
                exchange: "ASX",
            },
            {
                ticker: "AGL.AX",
                name: "AGL Energy",
                type: "Stock",
                exchange: "ASX",
            },
        ],
        wheat: [
            {
                ticker: "WM",
                name: "ASX Wheat Futures",
                type: "Futures",
                exchange: "ASX",
            },
            {
                ticker: "GNC.AX",
                name: "GrainCorp Limited",
                type: "Stock",
                exchange: "ASX",
            },
        ],
        broadMarket: [
            {
                ticker: "STW.AX",
                name: "SPDR S&P/ASX 200",
                type: "ETF",
                exchange: "ASX",
            },
            {
                ticker: "VAS.AX",
                name: "Vanguard Australian Shares",
                type: "ETF",
                exchange: "ASX",
            },
        ],
    },
    Brazil: {
        coffee: [
            {
                ticker: "KC",
                name: "Coffee C Futures",
                type: "Futures",
                exchange: "ICE",
            },
            {
                ticker: "JO",
                name: "iPath Bloomberg Coffee ETN",
                type: "ETN",
                exchange: "NYSE",
            },
        ],
        soybeans: [
            {
                ticker: "SOJA3.SA",
                name: "Boa Safra Sementes",
                type: "Stock",
                exchange: "B3",
            },
            {
                ticker: "SOYB",
                name: "Teucrium Soybean Fund",
                type: "ETF",
                exchange: "NYSE",
            },
        ],
        sugar: [
            {
                ticker: "SB",
                name: "Sugar #11 Futures",
                type: "Futures",
                exchange: "ICE",
            },
            {
                ticker: "CANE",
                name: "Teucrium Sugar Fund",
                type: "ETF",
                exchange: "NYSE",
            },
        ],
        broadMarket: [
            {
                ticker: "EWZ",
                name: "iShares MSCI Brazil ETF",
                type: "ETF",
                exchange: "NYSE",
            },
            {
                ticker: "BOVA11.SA",
                name: "iShares Ibovespa",
                type: "ETF",
                exchange: "B3",
            },
        ],
    },
    China: {
        broadMarket: [
            {
                ticker: "FXI",
                name: "iShares China Large-Cap ETF",
                type: "ETF",
                exchange: "NYSE",
            },
            {
                ticker: "MCHI",
                name: "iShares MSCI China ETF",
                type: "ETF",
                exchange: "NASDAQ",
            },
        ],
        agriculture: [
            {
                ticker: "CHAU",
                name: "Direxion Daily CSI China Internet Bull",
                type: "ETF",
                exchange: "NYSE",
            },
        ],
    },
    India: {
        broadMarket: [
            {
                ticker: "INDA",
                name: "iShares MSCI India ETF",
                type: "ETF",
                exchange: "NASDAQ",
            },
            {
                ticker: "PIN",
                name: "Invesco India ETF",
                type: "ETF",
                exchange: "NYSE",
            },
        ],
        utilities: [
            {
                ticker: "NTPC.NS",
                name: "NTPC Limited",
                type: "Stock",
                exchange: "NSE",
            },
            {
                ticker: "POWERGRID.NS",
                name: "Power Grid Corporation",
                type: "Stock",
                exchange: "NSE",
            },
        ],
    },
    Canada: {
        energy: [
            {
                ticker: "XEG.TO",
                name: "iShares S&P/TSX Capped Energy",
                type: "ETF",
                exchange: "TSX",
            },
            {
                ticker: "ENB.TO",
                name: "Enbridge Inc",
                type: "Stock",
                exchange: "TSX",
            },
        ],
        naturalGas: [
            {
                ticker: "HNU.TO",
                name: "BetaPro Natural Gas Bull",
                type: "ETF",
                exchange: "TSX",
            },
            {
                ticker: "TRP.TO",
                name: "TC Energy Corporation",
                type: "Stock",
                exchange: "TSX",
            },
        ],
        utilities: [
            {
                ticker: "XUT.TO",
                name: "iShares S&P/TSX Capped Utilities",
                type: "ETF",
                exchange: "TSX",
            },
            {
                ticker: "FTS.TO",
                name: "Fortis Inc",
                type: "Stock",
                exchange: "TSX",
            },
        ],
        wheat: [
            {
                ticker: "WCE",
                name: "Winnipeg Commodity Exchange Wheat",
                type: "Futures",
                exchange: "ICE",
            },
        ],
        broadMarket: [
            {
                ticker: "XIU.TO",
                name: "iShares S&P/TSX 60 Index",
                type: "ETF",
                exchange: "TSX",
            },
            {
                ticker: "XIC.TO",
                name: "iShares Core S&P/TSX",
                type: "ETF",
                exchange: "TSX",
            },
        ],
    },
    Global: {
        energy: [
            {
                ticker: "IXC",
                name: "iShares Global Energy ETF",
                type: "ETF",
                exchange: "NYSE",
            },
        ],
        utilities: [
            {
                ticker: "JXI",
                name: "iShares Global Utilities ETF",
                type: "ETF",
                exchange: "NYSE",
            },
        ],
        agriculture: [
            {
                ticker: "DBA",
                name: "Invesco DB Agriculture Fund",
                type: "ETF",
                exchange: "NYSE",
            },
            {
                ticker: "RJA",
                name: "Elements Rogers Agriculture ETN",
                type: "ETN",
                exchange: "NYSE",
            },
        ],
        broadMarket: [
            {
                ticker: "VT",
                name: "Vanguard Total World Stock ETF",
                type: "ETF",
                exchange: "NYSE",
            },
            {
                ticker: "ACWI",
                name: "iShares MSCI ACWI ETF",
                type: "ETF",
                exchange: "NASDAQ",
            },
        ],
    },
};

// Get instruments for a specific market and sector
function getInstruments(market, sector) {
    const marketInstruments =
        MARKET_INSTRUMENTS[market] || MARKET_INSTRUMENTS["Global"];
    return (
        marketInstruments[sector] || MARKET_INSTRUMENTS["Global"][sector] || []
    );
}

// Generate dynamic trade recommendations based on computed data and region
function generateDynamicTradeRecommendations(stats, regionInfo, location) {
    const trades = [];
    let tradeId = 1;

    const {
        tempAnomaly,
        tempAnomalySignificance,
        precipRatio,
        season,
        isWetPeriod,
        isDryPeriod,
        forecastHasExtremeHeat,
        forecastHasExtremeCold,
        currentTemp,
        avgHistTemp,
        isHighVolatility,
        avgHistWind,
    } = stats;

    const { market, commodityRelevance, region, country } = regionInfo;

    // Helper to add a trade
    const addTrade = (config) => {
        const instruments = getInstruments(market, config.sector);
        const instrument =
            instruments[0] || getInstruments("Global", config.sector)[0];

        if (instrument) {
            trades.push({
                id: tradeId++,
                sector: config.sectorDisplay,
                ticker: instrument.ticker,
                name: instrument.name,
                exchange: instrument.exchange || "Primary",
                instrumentType: instrument.type,
                action: config.action,
                confidence: config.confidence,
                timeframe: config.timeframe,
                rationale: config.rationale,
                catalyst: config.catalyst,
                riskLevel: config.riskLevel,
                expectedReturn: config.expectedReturn,
                region: region,
            });
        }
    };

    // === ENERGY SECTOR ===
    // Extreme heat - cooling demand
    if (
        forecastHasExtremeHeat ||
        (tempAnomaly > 7 && (season === "summer" || currentTemp > 77))
    ) {
        const heatIntensity =
            tempAnomalySignificance > 2 ? "exceptional" : "significant";
        addTrade({
            sector: "energy",
            sectorDisplay: "Energy",
            action: "BUY",
            confidence: tempAnomalySignificance > 2 ? "High" : "Medium",
            timeframe: "2-6 weeks",
            rationale: `${heatIntensity.charAt(0).toUpperCase() + heatIntensity.slice(1)} heat anomaly (+${tempAnomaly.toFixed(1)}°F above normal) driving elevated cooling demand in ${region}. Increased electricity consumption supports energy sector.`,
            catalyst: `Temperature ${tempAnomaly.toFixed(1)}°F above historical average`,
            riskLevel: "Medium",
            expectedReturn: `+${Math.min(5 + Math.floor(tempAnomalySignificance * 3), 15)}% to +${Math.min(8 + Math.floor(tempAnomalySignificance * 4), 20)}%`,
        });
    }

    // Extreme cold - heating demand
    if (
        forecastHasExtremeCold ||
        (tempAnomaly < -7 && (season === "winter" || currentTemp < 41))
    ) {
        const coldIntensity =
            tempAnomalySignificance > 2 ? "exceptional" : "significant";
        addTrade({
            sector: "naturalGas",
            sectorDisplay: "Natural Gas",
            action: "BUY",
            confidence: tempAnomalySignificance > 2 ? "High" : "Medium",
            timeframe: "2-8 weeks",
            rationale: `${coldIntensity.charAt(0).toUpperCase() + coldIntensity.slice(1)} cold anomaly (${tempAnomaly.toFixed(1)}°F below normal) increasing heating demand. Natural gas inventories draw down faster in cold snaps.`,
            catalyst: `Temperature ${Math.abs(tempAnomaly).toFixed(1)}°F below historical average`,
            riskLevel: "High",
            expectedReturn: `+${Math.min(8 + Math.floor(tempAnomalySignificance * 5), 30)}% to +${Math.min(15 + Math.floor(tempAnomalySignificance * 6), 40)}%`,
        });
    }

    // === UTILITIES ===
    // Temperature extremes either direction
    if (
        Math.abs(tempAnomaly) > 3 ||
        forecastHasExtremeHeat ||
        forecastHasExtremeCold
    ) {
        const direction = tempAnomaly > 0 ? "above" : "below";
        addTrade({
            sector: "utilities",
            sectorDisplay: "Utilities",
            action: Math.abs(tempAnomaly) > 5 ? "BUY" : "ACCUMULATE",
            confidence: Math.abs(tempAnomaly) > 5 ? "High" : "Medium",
            timeframe: "4-12 weeks",
            rationale: `Temperature ${Math.abs(tempAnomaly).toFixed(1)}°F ${direction} normal increases ${tempAnomaly > 0 ? "cooling" : "heating"} load on utilities. High demand periods support utility revenues in ${region}.`,
            catalyst: "Temperature-driven demand surge",
            riskLevel: "Low",
            expectedReturn: `+${Math.min(2 + Math.floor(Math.abs(tempAnomaly)), 10)}% to +${Math.min(4 + Math.floor(Math.abs(tempAnomaly) * 1.5), 15)}%`,
        });
    }

    // === AGRICULTURE ===
    // Drought conditions during growing season
    if (isDryPeriod && (season === "spring" || season === "summer")) {
        // Check which agricultural commodities are relevant to this region
        const precipPercent = (precipRatio * 100).toFixed(0);

        if (
            commodityRelevance.includes("corn") ||
            commodityRelevance.includes("grains")
        ) {
            addTrade({
                sector: "corn",
                sectorDisplay: "Grains - Corn",
                action: "BUY",
                confidence: precipRatio < 0.4 ? "High" : "Medium",
                timeframe: "6-12 weeks",
                rationale: `Precipitation at ${precipPercent}% of normal threatens corn yields in ${region}. Crop stress during ${season} growing season historically correlates with price increases.`,
                catalyst: "Drought-induced supply concerns",
                riskLevel: "Medium",
                expectedReturn: `+${Math.min(6 + Math.floor((1 - precipRatio) * 20), 25)}% to +${Math.min(10 + Math.floor((1 - precipRatio) * 25), 35)}%`,
            });
        }

        if (commodityRelevance.includes("soybeans")) {
            addTrade({
                sector: "soybeans",
                sectorDisplay: "Grains - Soybeans",
                action: "BUY",
                confidence: precipRatio < 0.4 ? "High" : "Medium",
                timeframe: "6-14 weeks",
                rationale: `Soybean crops highly sensitive to moisture stress. ${precipPercent}% of normal precipitation in ${region} during critical ${season} development stages threatens yields.`,
                catalyst: "Crop condition deterioration",
                riskLevel: "Medium",
                expectedReturn: `+${Math.min(5 + Math.floor((1 - precipRatio) * 18), 22)}% to +${Math.min(9 + Math.floor((1 - precipRatio) * 22), 30)}%`,
            });
        }

        if (commodityRelevance.includes("wheat")) {
            addTrade({
                sector: "wheat",
                sectorDisplay: "Grains - Wheat",
                action: "BUY",
                confidence: precipRatio < 0.5 ? "Medium" : "Low",
                timeframe: "4-10 weeks",
                rationale: `Dry conditions (${precipPercent}% of normal) affecting wheat development in ${region}. Supply concerns may support prices.`,
                catalyst: "Export and production forecasts",
                riskLevel: "Medium",
                expectedReturn: `+${Math.min(4 + Math.floor((1 - precipRatio) * 15), 18)}% to +${Math.min(8 + Math.floor((1 - precipRatio) * 18), 25)}%`,
            });
        }

        if (commodityRelevance.includes("coffee")) {
            const coffeeDroughtImpact = currentTemp > 68 && precipRatio < 0.6;
            if (coffeeDroughtImpact) {
                addTrade({
                    sector: "coffee",
                    sectorDisplay: "Soft Commodities - Coffee",
                    action: "BUY",
                    confidence: precipRatio < 0.4 ? "High" : "Medium",
                    timeframe: "8-16 weeks",
                    rationale: `Coffee-growing region experiencing ${precipPercent}% of normal rainfall with temperatures at ${currentTemp.toFixed(1)}°F. Drought stress during flowering/fruit development severely impacts yields.`,
                    catalyst:
                        "Crop damage assessments from " + (country || region),
                    riskLevel: "High",
                    expectedReturn: "+12% to +35%",
                });
            }
        }
    }

    // Excessive wetness impacting agriculture
    if (isWetPeriod && season === "spring") {
        const precipPercent = (precipRatio * 100).toFixed(0);

        if (
            commodityRelevance.includes("wheat") ||
            commodityRelevance.includes("grains")
        ) {
            addTrade({
                sector: "wheat",
                sectorDisplay: "Grains - Wheat",
                action: "BUY",
                confidence: precipRatio > 1.8 ? "High" : "Medium",
                timeframe: "4-8 weeks",
                rationale: `Excessive rainfall (${precipPercent}% of normal) in ${region} delaying spring planting. Reduced planted acreage and waterlogged fields threaten production.`,
                catalyst: "Planting progress delays",
                riskLevel: "Medium",
                expectedReturn: `+${Math.min(4 + Math.floor((precipRatio - 1) * 10), 18)}% to +${Math.min(7 + Math.floor((precipRatio - 1) * 12), 25)}%`,
            });
        }
    }

    // === GENERAL/DEFENSIVE ===
    // High volatility - defensive positioning
    if (isHighVolatility) {
        addTrade({
            sector: "utilities",
            sectorDisplay: "Utilities (Defensive)",
            action: "ACCUMULATE",
            confidence: "Medium",
            timeframe: "8-16 weeks",
            rationale: `High weather volatility (σ=${stats.tempVolatility.toFixed(1)}°F) in ${region} creates demand uncertainty. Utilities offer defensive positioning with potential upside from extreme demand events.`,
            catalyst: "Weather volatility persistence",
            riskLevel: "Low",
            expectedReturn: "+3% to +8%",
        });
    }

    // Near-normal conditions - reduced weather alpha
    if (trades.length === 0) {
        addTrade({
            sector: "broadMarket",
            sectorDisplay: "Broad Market",
            action: "HOLD",
            confidence: "Low",
            timeframe: "12-52 weeks",
            rationale: `Weather conditions near historical norms for ${region} (temp anomaly: ${tempAnomaly > 0 ? "+" : ""}${tempAnomaly.toFixed(1)}°F, precip: ${(precipRatio * 100).toFixed(0)}% of normal). Limited weather-driven alpha opportunities. Focus on fundamental analysis.`,
            catalyst: "Monitor for pattern changes",
            riskLevel: "Low",
            expectedReturn: "Market rate (+6-10% annually)",
        });

        addTrade({
            sector: "agriculture",
            sectorDisplay: "Agriculture (Diversified)",
            action: "WATCH",
            confidence: "Low",
            timeframe: "8-24 weeks",
            rationale: `Near-normal weather patterns in ${region} suggest stable agricultural production outlook. Maintain watchlist position for potential pattern shifts.`,
            catalyst: "Weather pattern deviation",
            riskLevel: "Medium",
            expectedReturn: "Conditional on weather shifts",
        });
    }

    // If we have very few trades, add a market-appropriate broad exposure suggestion
    if (trades.length < 2) {
        addTrade({
            sector: "broadMarket",
            sectorDisplay: `${region} Market`,
            action: "HOLD",
            confidence: "Medium",
            timeframe: "26-52 weeks",
            rationale: `Current weather patterns suggest monitoring ${region} markets for weather-sensitive sectors. Broad market exposure provides diversification while awaiting clearer signals.`,
            catalyst: "Seasonal patterns",
            riskLevel: "Low",
            expectedReturn: "Index returns (varies by market)",
        });
    }

    // Sort by confidence, then by expected impact
    return trades.sort((a, b) => {
        const confOrder = { High: 0, Medium: 1, Low: 2 };
        const confDiff = confOrder[a.confidence] - confOrder[b.confidence];
        if (confDiff !== 0) return confDiff;

        const actionOrder = {
            BUY: 0,
            ACCUMULATE: 1,
            HOLD: 2,
            WATCH: 3,
            SELL: 4,
        };
        return actionOrder[a.action] - actionOrder[b.action];
    });
}

// Start server after database is initialized
initDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(
                `Weather API server running on http://localhost:${PORT}`,
            );
        });
    })
    .catch((err) => {
        console.error("Failed to initialize database:", err);
        process.exit(1);
    });
