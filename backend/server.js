const express = require('express');
const cors = require('cors');
const axios = require('axios');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5002;

// Middleware
app.use(cors());
app.use(express.json());

// Database file path
const DB_PATH = path.join(__dirname, 'weather.db');

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
      console.log('Loaded existing database');
    } else {
      db = new SQL.Database();
      console.log('Created new database');
    }
  } catch (error) {
    console.log('Creating new database');
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
app.get('/api/geocode', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const response = await axios.get(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
    );

    if (!response.data.results) {
      return res.json({ results: [] });
    }

    const locations = response.data.results.map(loc => ({
      id: loc.id,
      name: loc.name,
      latitude: loc.latitude,
      longitude: loc.longitude,
      country: loc.country,
      admin1: loc.admin1,
      timezone: loc.timezone
    }));

    res.json({ results: locations });
  } catch (error) {
    console.error('Geocoding error:', error.message);
    res.status(500).json({ error: 'Failed to fetch location data' });
  }
});

// Weather API - Get current weather and forecasts
app.get('/api/weather', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const response = await axios.get(
      `https://api.open-meteo.com/v1/forecast`, {
        params: {
          latitude: lat,
          longitude: lon,
          current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
          hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day',
          daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
          timezone: 'auto',
          forecast_days: 7
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Weather API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

// Favorites API
// Get all favorites
app.get('/api/favorites', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM favorites ORDER BY created_at DESC');
    if (result.length === 0) {
      return res.json([]);
    }
    
    const columns = result[0].columns;
    const favorites = result[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
    
    res.json(favorites);
  } catch (error) {
    console.error('Database error:', error.message);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Add a favorite
app.post('/api/favorites', (req, res) => {
  try {
    const { name, latitude, longitude, country } = req.body;
    
    if (!name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
    }

    db.run(
      'INSERT INTO favorites (name, latitude, longitude, country) VALUES (?, ?, ?, ?)',
      [name, latitude, longitude, country || null]
    );
    
    saveDatabase();
    
    // Get the newly inserted record
    const result = db.exec('SELECT * FROM favorites ORDER BY id DESC LIMIT 1');
    const columns = result[0].columns;
    const row = result[0].values[0];
    const newFavorite = {};
    columns.forEach((col, i) => newFavorite[col] = row[i]);
    
    res.status(201).json(newFavorite);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Location already in favorites' });
    }
    console.error('Database error:', error.message);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Delete a favorite
app.delete('/api/favorites/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if exists first
    const check = db.exec(`SELECT id FROM favorites WHERE id = ${id}`);
    if (check.length === 0 || check[0].values.length === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }
    
    db.run(`DELETE FROM favorites WHERE id = ${id}`);
    saveDatabase();
    
    res.json({ message: 'Favorite deleted successfully' });
  } catch (error) {
    console.error('Database error:', error.message);
    res.status(500).json({ error: 'Failed to delete favorite' });
  }
});

// Start server after database is initialized
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Weather API server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
