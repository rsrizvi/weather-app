import React from 'react';
import { getWeatherInfo, formatTime } from '../utils/weatherCodes';
import './HourlyForecast.css';

const HourlyForecast = ({ weather }) => {
  if (!weather || !weather.hourly) return null;

  const { hourly, hourly_units } = weather;
  const currentHour = new Date().getHours();
  
  // Get next 24 hours starting from current hour
  const currentIndex = hourly.time.findIndex(time => {
    const hour = new Date(time).getHours();
    const date = new Date(time).toDateString();
    const today = new Date().toDateString();
    return date === today && hour >= currentHour;
  });

  const startIndex = currentIndex >= 0 ? currentIndex : 0;
  const hours = [];
  
  for (let i = startIndex; i < startIndex + 24 && i < hourly.time.length; i++) {
    hours.push({
      time: hourly.time[i],
      temperature: hourly.temperature_2m[i],
      weatherCode: hourly.weather_code[i],
      precipitation: hourly.precipitation_probability[i],
      isDay: hourly.is_day[i],
      windSpeed: hourly.wind_speed_10m[i],
    });
  }

  return (
    <div className="hourly-forecast">
      <h2 className="section-title">Hourly Forecast</h2>
      <div className="hourly-scroll">
        <div className="hourly-container">
          {hours.map((hour, index) => {
            const weatherInfo = getWeatherInfo(hour.weatherCode, hour.isDay);
            const isNow = index === 0;
            
            return (
              <div key={hour.time} className={`hourly-item ${isNow ? 'now' : ''}`}>
                <span className="hourly-time">{isNow ? 'Now' : formatTime(hour.time)}</span>
                <span className="hourly-icon">{weatherInfo.icon}</span>
                <span className="hourly-temp">
                  {Math.round(hour.temperature)}{hourly_units.temperature_2m}
                </span>
                {hour.precipitation > 0 && (
                  <span className="hourly-precip">
                    💧 {hour.precipitation}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HourlyForecast;
