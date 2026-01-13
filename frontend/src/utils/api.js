import axios from 'axios';

const API_BASE_URL = 'http://localhost:5002/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export const searchLocations = async (query) => {
  const response = await api.get('/geocode', { params: { query } });
  return response.data.results;
};

export const getWeather = async (lat, lon) => {
  const response = await api.get('/weather', { params: { lat, lon } });
  return response.data;
};

export const getFavorites = async () => {
  const response = await api.get('/favorites');
  return response.data;
};

export const addFavorite = async (location) => {
  const response = await api.post('/favorites', location);
  return response.data;
};

export const removeFavorite = async (id) => {
  const response = await api.delete(`/favorites/${id}`);
  return response.data;
};

export default api;
