import React from 'react';
import { getWeatherInfo, formatDayName } from '../utils/weatherCodes';
import './DailyForecast.css';

const DailyForecast = ({ weather }) => {
  if (!weather || !weather.daily) return null;

  const { daily, daily_units } = weather;

  const days = daily.time.map((time, index) => ({
    date: time,
    weatherCode: daily.weather_code[index],
    tempMax: daily.temperature_2m_max[index],
    tempMin: daily.temperature_2m_min[index],
    precipProb: daily.precipitation_probability_max[index],
    precipSum: daily.precipitation_sum[index],
    sunrise: daily.sunrise[index],
    sunset: daily.sunset[index],
    windSpeed: daily.wind_speed_10m_max[index],
  }));

  // Calculate temperature range for the bar visualization
  const allTemps = [...daily.temperature_2m_max, ...daily.temperature_2m_min];
  const minTemp = Math.min(...allTemps);
  const maxTemp = Math.max(...allTemps);
  const tempRange = maxTemp - minTemp;

  return (
    <div className="daily-forecast">
      <h2 className="section-title">7-Day Forecast</h2>
      <div className="daily-list">
        {days.map((day, index) => {
          const weatherInfo = getWeatherInfo(day.weatherCode, true);
          const isToday = index === 0;
          
          // Calculate position for temperature bar
          const lowPercent = ((day.tempMin - minTemp) / tempRange) * 100;
          const highPercent = ((day.tempMax - minTemp) / tempRange) * 100;
          
          return (
            <div key={day.date} className={`daily-item ${isToday ? 'today' : ''}`}>
              <div className="daily-day">
                <span className="day-name">{formatDayName(day.date)}</span>
                {isToday && <span className="today-badge">Today</span>}
              </div>
              
              <div className="daily-icon-container">
                <span className="daily-icon">{weatherInfo.icon}</span>
                {day.precipProb > 20 && (
                  <span className="daily-precip-badge">💧{day.precipProb}%</span>
                )}
              </div>
              
              <div className="daily-condition">{weatherInfo.description}</div>
              
              <div className="daily-temps">
                <span className="temp-low">{Math.round(day.tempMin)}°</span>
                <div className="temp-bar-container">
                  <div 
                    className="temp-bar"
                    style={{
                      left: `${lowPercent}%`,
                      width: `${highPercent - lowPercent}%`
                    }}
                  />
                </div>
                <span className="temp-high">{Math.round(day.tempMax)}°</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailyForecast;
