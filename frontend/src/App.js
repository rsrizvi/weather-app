import React, { useState, useEffect, useCallback } from 'react';
import SearchBar from './components/SearchBar';
import CurrentWeather from './components/CurrentWeather';
import HourlyForecast from './components/HourlyForecast';
import DailyForecast from './components/DailyForecast';
import Favorites from './components/Favorites';
import { getWeather, getFavorites, addFavorite, removeFavorite } from './utils/api';
import './App.css';

function App() {
  const [location, setLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load favorites on mount
  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const favs = await getFavorites();
      setFavorites(favs);
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  const fetchWeather = useCallback(async (loc) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWeather(loc.latitude, loc.longitude);
      setWeather(data);
      setLocation(loc);
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      setError('Failed to fetch weather data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLocationSelect = (loc) => {
    fetchWeather(loc);
  };

  const isFavorite = location && favorites.some(
    f => f.latitude === location.latitude && f.longitude === location.longitude
  );

  const handleToggleFavorite = async () => {
    if (!location) return;

    try {
      if (isFavorite) {
        const fav = favorites.find(
          f => f.latitude === location.latitude && f.longitude === location.longitude
        );
        if (fav) {
          await removeFavorite(fav.id);
        }
      } else {
        await addFavorite({
          name: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
          country: location.country
        });
      }
      loadFavorites();
    } catch (error) {
      console.error('Failed to update favorite:', error);
    }
  };

  const handleFavoriteSelect = (fav) => {
    fetchWeather({
      name: fav.name,
      latitude: fav.latitude,
      longitude: fav.longitude,
      country: fav.country
    });
  };

  const handleFavoriteRemove = async (id) => {
    try {
      await removeFavorite(id);
      loadFavorites();
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">🌤️ Weather App</h1>
        <p className="app-subtitle">Get current weather and forecasts for any location</p>
      </header>

      <main className="app-main">
        <SearchBar onLocationSelect={handleLocationSelect} />

        <Favorites
          favorites={favorites}
          onSelect={handleFavoriteSelect}
          onRemove={handleFavoriteRemove}
          currentLocation={location}
        />

        {loading && (
          <div className="loading-container">
            <div className="loading-spinner-large"></div>
            <p>Loading weather data...</p>
          </div>
        )}

        {error && (
          <div className="error-container">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && weather && (
          <>
            <CurrentWeather
              location={location}
              weather={weather}
              isFavorite={isFavorite}
              onToggleFavorite={handleToggleFavorite}
            />
            <HourlyForecast weather={weather} />
            <DailyForecast weather={weather} />
          </>
        )}

        {!loading && !error && !weather && (
          <div className="welcome-container">
            <div className="welcome-icon">🌍</div>
            <h2>Welcome to Weather App</h2>
            <p>Search for a city above to see the current weather and forecast</p>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Weather data provided by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a></p>
      </footer>
    </div>
  );
}

export default App;
