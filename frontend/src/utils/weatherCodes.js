// WMO Weather interpretation codes (WW)
// https://open-meteo.com/en/docs

export const weatherCodes = {
  0: { description: 'Clear sky', icon: '☀️', iconNight: '🌙' },
  1: { description: 'Mainly clear', icon: '🌤️', iconNight: '🌙' },
  2: { description: 'Partly cloudy', icon: '⛅', iconNight: '☁️' },
  3: { description: 'Overcast', icon: '☁️', iconNight: '☁️' },
  45: { description: 'Fog', icon: '🌫️', iconNight: '🌫️' },
  48: { description: 'Depositing rime fog', icon: '🌫️', iconNight: '🌫️' },
  51: { description: 'Light drizzle', icon: '🌧️', iconNight: '🌧️' },
  53: { description: 'Moderate drizzle', icon: '🌧️', iconNight: '🌧️' },
  55: { description: 'Dense drizzle', icon: '🌧️', iconNight: '🌧️' },
  56: { description: 'Light freezing drizzle', icon: '🌧️', iconNight: '🌧️' },
  57: { description: 'Dense freezing drizzle', icon: '🌧️', iconNight: '🌧️' },
  61: { description: 'Slight rain', icon: '🌧️', iconNight: '🌧️' },
  63: { description: 'Moderate rain', icon: '🌧️', iconNight: '🌧️' },
  65: { description: 'Heavy rain', icon: '🌧️', iconNight: '🌧️' },
  66: { description: 'Light freezing rain', icon: '🌧️', iconNight: '🌧️' },
  67: { description: 'Heavy freezing rain', icon: '🌧️', iconNight: '🌧️' },
  71: { description: 'Slight snow', icon: '🌨️', iconNight: '🌨️' },
  73: { description: 'Moderate snow', icon: '🌨️', iconNight: '🌨️' },
  75: { description: 'Heavy snow', icon: '🌨️', iconNight: '🌨️' },
  77: { description: 'Snow grains', icon: '🌨️', iconNight: '🌨️' },
  80: { description: 'Slight rain showers', icon: '🌦️', iconNight: '🌧️' },
  81: { description: 'Moderate rain showers', icon: '🌦️', iconNight: '🌧️' },
  82: { description: 'Violent rain showers', icon: '🌦️', iconNight: '🌧️' },
  85: { description: 'Slight snow showers', icon: '🌨️', iconNight: '🌨️' },
  86: { description: 'Heavy snow showers', icon: '🌨️', iconNight: '🌨️' },
  95: { description: 'Thunderstorm', icon: '⛈️', iconNight: '⛈️' },
  96: { description: 'Thunderstorm with slight hail', icon: '⛈️', iconNight: '⛈️' },
  99: { description: 'Thunderstorm with heavy hail', icon: '⛈️', iconNight: '⛈️' },
};

export const getWeatherInfo = (code, isDay = true) => {
  const weather = weatherCodes[code] || { description: 'Unknown', icon: '❓', iconNight: '❓' };
  return {
    description: weather.description,
    icon: isDay ? weather.icon : weather.iconNight
  };
};

export const getWindDirection = (degrees) => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
};

export const formatTime = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
};

export const formatDate = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

export const formatDayName = (isoString) => {
  const date = new Date(isoString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long' });
};
