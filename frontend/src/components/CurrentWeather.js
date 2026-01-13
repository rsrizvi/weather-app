import React from 'react';
import { getWeatherInfo, getWindDirection } from '../utils/weatherCodes';
import './CurrentWeather.css';

const CurrentWeather = ({ location, weather, isFavorite, onToggleFavorite }) => {
  if (!weather || !weather.current) return null;

  const { current, current_units } = weather;
  const weatherInfo = getWeatherInfo(current.weather_code, current.is_day);

  return (
    <div className="current-weather">
      <div className="current-weather-header">
        <div className="location-info">
          <h1 className="location-name">{location.name}</h1>
          <p className="location-country">
            {location.admin1 && `${location.admin1}, `}{location.country}
          </p>
        </div>
        <button 
          className={`favorite-btn ${isFavorite ? 'is-favorite' : ''}`}
          onClick={onToggleFavorite}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      </div>

      <div className="current-main">
        <div className="temperature-display">
          <span className="weather-icon-large">{weatherInfo.icon}</span>
          <span className="temperature-value">
            {Math.round(current.temperature_2m)}
          </span>
          <span className="temperature-unit">{current_units.temperature_2m}</span>
        </div>
        <div className="weather-description">
          <p className="condition">{weatherInfo.description}</p>
          <p className="feels-like">
            Feels like {Math.round(current.apparent_temperature)}{current_units.apparent_temperature}
          </p>
        </div>
      </div>

      <div className="current-details">
        <div className="detail-item">
          <span className="detail-icon">💧</span>
          <span className="detail-label">Humidity</span>
          <span className="detail-value">{current.relative_humidity_2m}{current_units.relative_humidity_2m}</span>
        </div>
        <div className="detail-item">
          <span className="detail-icon">💨</span>
          <span className="detail-label">Wind</span>
          <span className="detail-value">
            {Math.round(current.wind_speed_10m)} {current_units.wind_speed_10m} {getWindDirection(current.wind_direction_10m)}
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-icon">🌡️</span>
          <span className="detail-label">Pressure</span>
          <span className="detail-value">{Math.round(current.pressure_msl)} {current_units.pressure_msl}</span>
        </div>
        <div className="detail-item">
          <span className="detail-icon">☁️</span>
          <span className="detail-label">Cloud Cover</span>
          <span className="detail-value">{current.cloud_cover}{current_units.cloud_cover}</span>
        </div>
        {current.precipitation > 0 && (
          <div className="detail-item">
            <span className="detail-icon">🌧️</span>
            <span className="detail-label">Precipitation</span>
            <span className="detail-value">{current.precipitation} {current_units.precipitation}</span>
          </div>
        )}
        <div className="detail-item">
          <span className="detail-icon">🌬️</span>
          <span className="detail-label">Wind Gusts</span>
          <span className="detail-value">{Math.round(current.wind_gusts_10m)} {current_units.wind_gusts_10m}</span>
        </div>
      </div>
    </div>
  );
};

export default CurrentWeather;
