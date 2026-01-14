# Weather App 🌤️

A full-stack weather information web application built with React, Node.js, and SQLite.

## Features

- **Current Weather**: Display real-time weather conditions for any location
- **Hourly Forecast**: 24-hour weather forecast with temperature and conditions
- **7-Day Forecast**: Extended weekly forecast with high/low temperatures
- **Favorite Locations**: Save and quickly access your favorite locations
- **📈 Weather-Based Trading Insights** (NEW): Get trading recommendations based on weather patterns
  - **Extended Weather Synopsis**: 30-, 60-, 90-, 180-, and 360-day weather outlooks
  - **Trade Recommendations**: AI-generated trade ideas correlated with weather conditions
  - **Sector Analysis**: Energy, Agriculture, Retail, Utilities, and more
  - **Risk Assessment**: Confidence levels and risk ratings for each trade idea

## Tech Stack

- **Frontend**: React 18
- **Backend**: Node.js with Express
- **Database**: SQLite (using better-sqlite3)
- **Weather API**: [Open-Meteo](https://open-meteo.com/) (free, no API key required)

## Getting Started

### Prerequisites

- Node.js 16+ installed
- npm or yarn

### Installation & Running

1. **Install and start the backend:**
   ```bash
   cd backend
   npm install
   npm start
   ```
   The API server will start on http://localhost:5002

2. **Install and start the frontend (in a new terminal):**
   ```bash
   cd frontend
   npm install
   npm start
   ```
   The React app will open on http://localhost:3000

### Quick Start (Both servers)

Run both servers with the startup script:
```bash
./start.sh
```

## API Endpoints

### Weather API
- `GET /api/geocode?query={city}` - Search for locations
- `GET /api/weather?lat={lat}&lon={lon}` - Get weather data
- `GET /api/weather/extended?lat={lat}&lon={lon}` - Get extended weather data (16-day forecast + historical)

### Trading API
- `POST /api/trading/analyze` - Generate trading analysis based on weather patterns
  - Request body: `{ location, weatherData }`
  - Returns: Weather synopsis for multiple time periods and trade recommendations
- `POST /api/trading/ai-analysis` - AI-powered real-time trading analysis
  - Request body: `{ location, weatherData, computedStats }`
  - Returns: LLM-generated trading insights, sector analysis, and specific recommendations
  - Requires LLM API key configuration (see below)

### Favorites API
- `GET /api/favorites` - Get all saved favorites
- `POST /api/favorites` - Add a new favorite location
- `DELETE /api/favorites/:id` - Remove a favorite

## Project Structure

```
├── backend/
│   ├── server.js       # Express API server
│   ├── package.json
│   └── weather.db      # SQLite database (created on first run)
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── utils/      # API and helper utilities
│   │   ├── App.js      # Main app component
│   │   └── index.js    # React entry point
│   └── package.json
├── start.sh            # Startup script
└── README.md
```

## Screenshots

The app features a beautiful gradient UI with:
- Search bar with autocomplete
- Current conditions with detailed metrics
- Scrollable hourly forecast
- 7-day forecast with temperature bar visualization
- Favorites panel for quick access
- **Trading Dashboard** with:
  - Current conditions summary with temperature anomaly
  - Tabbed interface for Synopsis and Trade Ideas
  - Interactive time period selector (30/60/90/180/360 days)
  - Trade cards with action signals, confidence levels, and risk ratings

## Trading Feature Details

The trading feature analyzes weather patterns to generate **dynamic, location-aware** trade recommendations:

### How It Works
1. **Data Collection**: Fetches current forecast, historical data (past year), and climate normals
2. **Statistical Analysis**: Computes temperature anomalies, precipitation ratios, trend analysis, and volatility
3. **Regional Detection**: Automatically identifies region (North America, Europe, Asia Pacific, etc.) from coordinates
4. **Dynamic Recommendations**: Generates trades with region-appropriate instruments (ETFs, stocks, futures)

### Computed Metrics
- **Temperature Anomaly**: Current vs historical average with statistical significance (in °F)
- **Precipitation Ratio**: Forecast vs normal (e.g., "85% of normal")
- **Trend Analysis**: 30-day vs 90-day temperature/precipitation trends
- **Volatility Assessment**: Standard deviation analysis for risk evaluation
- **Extreme Event Detection**: Identifies heat waves, cold snaps, drought, flooding risks

### Confidence Levels
- **High**: 1-14 day forecasts with strong weather signals
- **Moderate-High**: 15-30 day outlook
- **Moderate**: 31-60 day outlook
- **Low-Moderate**: 61-90 day outlook  
- **Seasonal Average**: 90+ days (based on historical patterns)

### Regional Markets Supported
- **North America**: US and Canadian exchanges (NYSE, NASDAQ, TSX)
- **Europe**: EU markets (Xetra, LSE, Euronext, Eurex)
- **Asia Pacific**: Japan (TSE), Australia (ASX), India (NSE), China, Southeast Asia
- **Latin America**: Brazil (B3), broader LatAm exposure
- **Middle East & Africa**: Regional and global instruments

### Supported Sectors
- **Energy**: Regional energy ETFs, natural gas (TTF for EU, Henry Hub for US, etc.)
- **Agriculture**: Region-relevant crops (corn/soy in Americas, wheat in Australia/EU, rice in Asia)
- **Utilities**: Local utility sector exposure
- **Soft Commodities**: Coffee, sugar, cocoa based on growing regions
- **Broad Market**: Regional index ETFs for diversified exposure

### Data Sources
- **Open-Meteo Forecast API**: 16-day weather forecasts
- **Open-Meteo Archive API**: Historical weather data (past year)
- **Open-Meteo Climate API**: Climate normals and projections

### Disclaimer
The trading feature is for educational purposes only and should not be considered financial advice. Weather-based trading involves significant risk. Past weather patterns do not guarantee future market performance.

## AI-Powered Analysis

The app supports real-time AI-powered trading analysis using LLM APIs. This provides dynamic, up-to-date insights that adapt to changing market conditions and ticker symbols.

### Supported LLM Providers
- **Google Gemini** (gemini-2.0-flash, gemini-2.5-flash, gemini-2.5-pro, etc.) - Default
- **Anthropic Claude** (claude-sonnet-4-20250514, etc.)
- **OpenAI GPT** (gpt-4o, etc.)

### Configuration

Set the following environment variables before starting the backend:

```bash
# Required
export LLM_API_KEY=your_api_key_here

# Optional (defaults shown)
export LLM_PROVIDER=gemini   # or 'anthropic', 'openai'
export LLM_MODEL=gemini-2.0-flash  # or 'gemini-2.5-flash', 'gemini-2.5-pro', 'claude-sonnet-4-20250514', 'gpt-4o'
```

Or create a `.env` file in the backend directory:

```
LLM_API_KEY=your_api_key_here
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.0-flash
```

You can also use provider-specific environment variable names:
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` for Gemini
- `ANTHROPIC_API_KEY` for Claude
- `OPENAI_API_KEY` for GPT

### AI Analysis Features
- **Executive Summary**: Key weather-driven trading thesis
- **Specific Trade Ideas**: Ticker symbols, direction, rationale, timeframe, and risks
- **Sector Impact Analysis**: Energy, Agriculture, Retail, Utilities
- **Events to Watch**: Upcoming weather events and market catalysts
- **Contrarian View**: Alternative scenarios to consider

### Fallback Mode
When no LLM API key is configured, the app provides:
- Rule-based trade recommendations (still functional)
- Quick insights based on weather anomalies
- Instructions for enabling AI analysis

## License

MIT
