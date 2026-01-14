import axios from "axios";

const API_BASE_URL = "http://localhost:5002/api";

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // Default timeout for most requests
});

// Separate instance for AI analysis with longer timeout
const aiApi = axios.create({
    baseURL: API_BASE_URL,
    timeout: 90000, // 90 seconds for AI analysis (LLM can be slow)
});

export const searchLocations = async (query) => {
    const response = await api.get("/geocode", { params: { query } });
    return response.data.results;
};

export const getWeather = async (lat, lon) => {
    const response = await api.get("/weather", { params: { lat, lon } });
    return response.data;
};

export const getFavorites = async () => {
    const response = await api.get("/favorites");
    return response.data;
};

export const addFavorite = async (location) => {
    const response = await api.post("/favorites", location);
    return response.data;
};

export const removeFavorite = async (id) => {
    const response = await api.delete(`/favorites/${id}`);
    return response.data;
};

// Extended weather data for trading analysis
export const getExtendedWeather = async (lat, lon) => {
    const response = await api.get("/weather/extended", {
        params: { lat, lon },
    });
    return response.data;
};

// Trading analysis based on weather
export const getTradingAnalysis = async (location, weatherData) => {
    const response = await api.post("/trading/analyze", {
        location,
        weatherData,
    });
    return response.data;
};

// AI-powered trading analysis (uses longer timeout since LLM can be slow)
export const getAITradingAnalysis = async (
    location,
    weatherData,
    computedStats,
) => {
    const response = await aiApi.post("/trading/ai-analysis", {
        location,
        weatherData,
        computedStats,
    });
    return response.data;
};

export default api;
