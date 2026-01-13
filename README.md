# Weather App 🌤️

A full-stack weather information web application built with React, Node.js, and SQLite.

## Features

- **Current Weather**: Display real-time weather conditions for any location
- **Hourly Forecast**: 24-hour weather forecast with temperature and conditions
- **7-Day Forecast**: Extended weekly forecast with high/low temperatures
- **Favorite Locations**: Save and quickly access your favorite locations

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
   The API server will start on http://localhost:5000

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

## License

MIT
