import React, { useState, useEffect } from "react";
import {
    getExtendedWeather,
    getTradingAnalysis,
    getAITradingAnalysis,
} from "../utils/api";
import "./TradingDashboard.css";

const TradingDashboard = ({ location, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [selectedPeriod, setSelectedPeriod] = useState("days30");
    const [activeTab, setActiveTab] = useState("synopsis");
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [weatherData, setWeatherData] = useState(null);

    useEffect(() => {
        if (location) {
            // Reset AI analysis when location changes
            setAiAnalysis(null);
            setAiError(null);
            setAiLoading(false);
            fetchAnalysis();
        }
    }, [location]);

    const fetchAnalysis = async () => {
        setLoading(true);
        setError(null);
        setWeatherData(null); // Reset weather data
        setAnalysis(null); // Reset analysis
        try {
            // First get extended weather data
            const extendedWeather = await getExtendedWeather(
                location.latitude,
                location.longitude,
            );
            // Then get trading analysis
            const analysisData = await getTradingAnalysis(
                location,
                extendedWeather,
            );
            // Set both at the end after successful fetch
            setWeatherData(extendedWeather);
            setAnalysis(analysisData);
        } catch (err) {
            console.error("Failed to fetch trading analysis:", err);
            setError("Failed to load trading analysis. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const fetchAIAnalysis = async () => {
        // Check if we have the required data
        if (!weatherData || !analysis) {
            setAiError({
                title: "Data not ready",
                details: "Please wait for weather data to load first.",
            });
            return;
        }

        // Capture current values to avoid stale closure issues
        const currentLocation = location;
        const currentWeatherData = weatherData;
        const currentAnalysis = analysis;

        setAiLoading(true);
        setAiError(null);
        try {
            // Build computed stats from the analysis
            const computedStats = {
                currentTemp: currentAnalysis.currentConditions?.temperature,
                avgHistTemp:
                    parseFloat(
                        currentAnalysis.synopsis?.days30?.dataPoints
                            ?.historicalAvg,
                    ) || 0,
                tempAnomaly:
                    parseFloat(
                        currentAnalysis.currentConditions?.tempAnomaly,
                    ) || 0,
                tempAnomalySignificance:
                    Math.abs(
                        parseFloat(
                            currentAnalysis.currentConditions?.tempAnomaly,
                        ) || 0,
                    ) / 10,
                season: currentAnalysis.currentConditions?.season?.toLowerCase(),
                avgHumidity: currentAnalysis.currentConditions?.humidity,
                precipOutlook:
                    currentAnalysis.currentConditions?.precipitationOutlook,
                precipRatio: currentAnalysis.synopsis?.days30?.dataPoints
                    ?.precipRatio
                    ? parseFloat(
                          currentAnalysis.synopsis.days30.dataPoints
                              .precipRatio,
                      ) / 100
                    : 1,
                isWetPeriod:
                    currentAnalysis.currentConditions?.precipitationOutlook?.includes(
                        "Above",
                    ),
                isDryPeriod:
                    currentAnalysis.currentConditions?.precipitationOutlook?.includes(
                        "Below",
                    ),
                forecastHasExtremeHeat:
                    currentAnalysis.synopsis?.days30?.details?.includes(
                        "Extreme heat",
                    ),
                forecastHasExtremeCold:
                    currentAnalysis.synopsis?.days30?.details?.includes(
                        "Extreme cold",
                    ),
                isHighVolatility:
                    currentAnalysis.synopsis?.days30?.details?.includes(
                        "volatility",
                    ),
                tempVolatility: 10,
                next7DaysPrecip: 0,
                recentTempTrend: 0,
            };

            const aiResult = await getAITradingAnalysis(
                currentLocation,
                currentWeatherData,
                computedStats,
            );

            // Only update state if location hasn't changed during the fetch
            if (location?.name === currentLocation?.name) {
                setAiAnalysis(aiResult);
            }
        } catch (err) {
            console.error("Failed to fetch AI analysis:", err);

            // Handle different error types
            if (
                err.code === "ECONNABORTED" ||
                err.message?.includes("timeout")
            ) {
                setAiError({
                    title: "Request timed out",
                    details:
                        "The AI analysis is taking longer than expected. This may be due to high demand. Please try again in a moment.",
                    provider: "gemini",
                });
            } else if (err.response?.data?.error) {
                // Extract error details from response
                const errorData = err.response.data;
                setAiError({
                    title: errorData.error,
                    details: errorData.details,
                    provider: errorData.provider,
                    fallbackAdvice: errorData.fallbackAdvice,
                });
            } else if (err.message?.includes("Network Error")) {
                setAiError({
                    title: "Network error",
                    details:
                        "Could not connect to the server. Please check your connection.",
                });
            } else {
                setAiError({
                    title: "Failed to load AI analysis",
                    details:
                        err.message ||
                        "An unexpected error occurred. Please try again.",
                });
            }
        } finally {
            setAiLoading(false);
        }
    };

    const periods = [
        { key: "days30", label: "30 Days" },
        { key: "days60", label: "60 Days" },
        { key: "days90", label: "90 Days" },
        { key: "days180", label: "180 Days" },
        { key: "days360", label: "360 Days" },
    ];

    const getConfidenceClass = (confidence) => {
        switch (confidence) {
            case "High":
                return "confidence-high";
            case "Moderate-High":
                return "confidence-high";
            case "Medium":
            case "Moderate":
                return "confidence-medium";
            case "Low-Moderate":
                return "confidence-medium";
            case "Low":
                return "confidence-low";
            case "Seasonal Average":
                return "confidence-seasonal";
            default:
                return "confidence-low";
        }
    };

    const getActionClass = (action) => {
        switch (action) {
            case "BUY":
                return "action-buy";
            case "ACCUMULATE":
                return "action-accumulate";
            case "SELL":
                return "action-sell";
            case "HOLD":
                return "action-hold";
            case "WATCH":
                return "action-watch";
            default:
                return "";
        }
    };

    const getRiskClass = (risk) => {
        switch (risk) {
            case "High":
                return "risk-high";
            case "Medium":
                return "risk-medium";
            case "Low":
                return "risk-low";
            default:
                return "";
        }
    };

    // Simple markdown formatter with error handling
    const formatMarkdown = (text) => {
        if (!text) return "";

        try {
            let html = text
                // Escape any HTML in the content first (security)
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                // Now convert markdown
                // Headers (must come before other patterns)
                .replace(/^#### (.*$)/gim, '<h5 class="md-h5">$1</h5>')
                .replace(/^### (.*$)/gim, '<h4 class="md-h4">$1</h4>')
                .replace(/^## (.*$)/gim, '<h3 class="md-h3">$1</h3>')
                .replace(/^# (.*$)/gim, '<h2 class="md-h2">$1</h2>')
                // Bold (before italic to handle ***)
                .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                // Italic
                .replace(/\*(.*?)\*/g, "<em>$1</em>")
                // Code blocks
                .replace(
                    /```([\s\S]*?)```/g,
                    '<pre class="md-pre"><code>$1</code></pre>',
                )
                // Inline code
                .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
                // Tables (simple support)
                .replace(/\|(.+)\|/g, (match) => {
                    const cells = match.split("|").filter((c) => c.trim());
                    if (cells.every((c) => c.trim().match(/^[-:]+$/))) {
                        return ""; // Skip separator rows
                    }
                    const cellHtml = cells
                        .map((c) => `<td>${c.trim()}</td>`)
                        .join("");
                    return `<tr>${cellHtml}</tr>`;
                })
                // Horizontal rules
                .replace(/^---+$/gim, '<hr class="md-hr"/>')
                // Unordered lists
                .replace(/^\s*[-*]\s+(.*$)/gim, "<li>$1</li>")
                // Numbered lists
                .replace(/^\s*\d+\.\s+(.*$)/gim, "<li>$1</li>")
                // Line breaks - double newline = paragraph break
                .replace(/\n\n+/g, "</p><p>")
                // Single newline = line break
                .replace(/\n/g, "<br/>");

            // Wrap in paragraph tags
            html = "<p>" + html + "</p>";

            // Clean up empty paragraphs
            html = html.replace(/<p>\s*<\/p>/g, "");
            html = html.replace(/<p>\s*<br\/>\s*<\/p>/g, "");

            return html;
        } catch (e) {
            console.error("Markdown parsing error:", e);
            // Fallback: just escape HTML and preserve line breaks
            return text
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n/g, "<br/>");
        }
    };

    if (loading) {
        return (
            <div className="trading-dashboard">
                <div className="trading-header">
                    <h2>📈 Weather-Based Trading Insights</h2>
                    <button className="close-btn" onClick={onClose}>
                        ×
                    </button>
                </div>
                <div className="trading-loading">
                    <div className="loading-spinner-large"></div>
                    <p>
                        Analyzing weather patterns and generating trade
                        recommendations...
                    </p>
                    <p className="loading-subtext">
                        Fetching historical data and climate models
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="trading-dashboard">
                <div className="trading-header">
                    <h2>📈 Weather-Based Trading Insights</h2>
                    <button className="close-btn" onClick={onClose}>
                        ×
                    </button>
                </div>
                <div className="trading-error">
                    <span className="error-icon">⚠️</span>
                    <p>{error}</p>
                    <button className="retry-btn" onClick={fetchAnalysis}>
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const currentSynopsis = analysis?.synopsis?.[selectedPeriod];

    return (
        <div className="trading-dashboard">
            <div className="trading-header">
                <div className="header-title">
                    <h2>📈 Weather-Based Trading Insights</h2>
                    <span className="header-location">
                        {analysis?.location}, {analysis?.country}
                    </span>
                </div>
                <button className="close-btn" onClick={onClose}>
                    ×
                </button>
            </div>

            {/* Current Conditions Summary */}
            <div className="conditions-summary">
                <div className="condition-card">
                    <span className="condition-icon">🌡️</span>
                    <div className="condition-info">
                        <span className="condition-label">Temperature</span>
                        <span className="condition-value">
                            {analysis?.currentConditions?.temperature?.toFixed?.(
                                1,
                            ) || analysis?.currentConditions?.temperature}
                            °F
                        </span>
                        <span
                            className={`condition-badge ${parseFloat(analysis?.currentConditions?.tempAnomaly) > 0 ? "warm" : "cool"}`}
                        >
                            {parseFloat(
                                analysis?.currentConditions?.tempAnomaly,
                            ) > 0
                                ? "+"
                                : ""}
                            {analysis?.currentConditions?.tempAnomaly}° anomaly
                        </span>
                    </div>
                </div>
                <div className="condition-card">
                    <span className="condition-icon">💧</span>
                    <div className="condition-info">
                        <span className="condition-label">Precipitation</span>
                        <span className="condition-value">
                            {analysis?.currentConditions?.precipitationOutlook}
                        </span>
                    </div>
                </div>
                <div className="condition-card">
                    <span className="condition-icon">📅</span>
                    <div className="condition-info">
                        <span className="condition-label">Season</span>
                        <span className="condition-value">
                            {analysis?.currentConditions?.season}
                        </span>
                    </div>
                </div>
                <div className="condition-card">
                    <span className="condition-icon">🌍</span>
                    <div className="condition-info">
                        <span className="condition-label">Region</span>
                        <span className="condition-value">
                            {analysis?.region || "Global"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="trading-tabs">
                <button
                    className={`tab-btn ${activeTab === "synopsis" ? "active" : ""}`}
                    onClick={() => setActiveTab("synopsis")}
                >
                    📊 Weather Synopsis
                </button>
                <button
                    className={`tab-btn ${activeTab === "trades" ? "active" : ""}`}
                    onClick={() => setActiveTab("trades")}
                >
                    💹 Trade Ideas ({analysis?.trades?.length || 0})
                </button>
                <button
                    className={`tab-btn ai-tab ${activeTab === "ai" ? "active" : ""}`}
                    onClick={() => {
                        setActiveTab("ai");
                        if (!aiAnalysis && !aiLoading) {
                            fetchAIAnalysis();
                        }
                    }}
                >
                    🤖 AI Analysis
                    <span className="ai-badge">LIVE</span>
                </button>
            </div>

            {activeTab === "synopsis" && (
                <div className="synopsis-section">
                    {/* Period Selector */}
                    <div className="period-selector">
                        {periods.map((period) => (
                            <button
                                key={period.key}
                                className={`period-btn ${selectedPeriod === period.key ? "active" : ""}`}
                                onClick={() => setSelectedPeriod(period.key)}
                            >
                                {period.label}
                            </button>
                        ))}
                    </div>

                    {/* Synopsis Display */}
                    {currentSynopsis && (
                        <div className="synopsis-content">
                            <div className="synopsis-header">
                                <h3>{currentSynopsis.period}</h3>
                                <span
                                    className={`confidence-badge ${getConfidenceClass(currentSynopsis.confidence)}`}
                                >
                                    {currentSynopsis.confidence} Confidence
                                </span>
                            </div>

                            <p className="synopsis-summary">
                                {currentSynopsis.summary}
                            </p>
                            <p className="synopsis-details">
                                {currentSynopsis.details}
                            </p>

                            <div className="outlook-grid">
                                <div className="outlook-item">
                                    <span className="outlook-label">
                                        Temperature Outlook
                                    </span>
                                    <span
                                        className={`outlook-value ${
                                            currentSynopsis.temperatureOutlook ===
                                            "Above Normal"
                                                ? "above"
                                                : currentSynopsis.temperatureOutlook ===
                                                    "Below Normal"
                                                  ? "below"
                                                  : "normal"
                                        }`}
                                    >
                                        {currentSynopsis.temperatureOutlook}
                                    </span>
                                </div>
                                <div className="outlook-item">
                                    <span className="outlook-label">
                                        Precipitation Outlook
                                    </span>
                                    <span
                                        className={`outlook-value ${
                                            currentSynopsis.precipitationOutlook?.includes(
                                                "Above",
                                            )
                                                ? "above"
                                                : currentSynopsis.precipitationOutlook?.includes(
                                                        "Below",
                                                    )
                                                  ? "below"
                                                  : "normal"
                                        }`}
                                    >
                                        {currentSynopsis.precipitationOutlook}
                                    </span>
                                </div>
                            </div>

                            {/* Data Points from actual analysis */}
                            {currentSynopsis.dataPoints && (
                                <div className="data-points">
                                    <div className="data-point">
                                        <span className="data-label">
                                            Current Temp
                                        </span>
                                        <span className="data-value">
                                            {
                                                currentSynopsis.dataPoints
                                                    .currentTemp
                                            }
                                            °F
                                        </span>
                                    </div>
                                    <div className="data-point">
                                        <span className="data-label">
                                            Historical Avg
                                        </span>
                                        <span className="data-value">
                                            {
                                                currentSynopsis.dataPoints
                                                    .historicalAvg
                                            }
                                            °F
                                        </span>
                                    </div>
                                    <div className="data-point">
                                        <span className="data-label">
                                            Anomaly
                                        </span>
                                        <span
                                            className={`data-value ${currentSynopsis.dataPoints.anomaly?.startsWith("+") ? "positive" : "negative"}`}
                                        >
                                            {currentSynopsis.dataPoints.anomaly}
                                            °F
                                        </span>
                                    </div>
                                    <div className="data-point">
                                        <span className="data-label">
                                            Precip vs Normal
                                        </span>
                                        <span className="data-value">
                                            {
                                                currentSynopsis.dataPoints
                                                    .precipRatio
                                            }
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === "trades" && (
                <div className="trades-section">
                    <div className="trades-intro">
                        <p>
                            Trade recommendations based on current weather
                            patterns and seasonal analysis. Higher confidence
                            trades have stronger historical correlation with
                            weather conditions.
                        </p>
                    </div>

                    <div className="trades-list">
                        {analysis?.trades?.map((trade) => (
                            <div key={trade.id} className="trade-card">
                                <div className="trade-header">
                                    <div className="trade-identity">
                                        <span
                                            className={`trade-action ${getActionClass(trade.action)}`}
                                        >
                                            {trade.action}
                                        </span>
                                        <span className="trade-ticker">
                                            {trade.ticker}
                                        </span>
                                        <span className="trade-name">
                                            {trade.name}
                                        </span>
                                        {trade.exchange &&
                                            trade.exchange !== "Primary" && (
                                                <span className="trade-exchange">
                                                    {trade.exchange}
                                                </span>
                                            )}
                                    </div>
                                    <div className="trade-sector-region">
                                        <span className="trade-sector">
                                            {trade.sector}
                                        </span>
                                        {trade.region && (
                                            <span className="trade-region">
                                                {trade.region}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {trade.instrumentType && (
                                    <div className="trade-instrument-type">
                                        {trade.instrumentType}
                                    </div>
                                )}

                                <p className="trade-rationale">
                                    {trade.rationale}
                                </p>

                                <div className="trade-meta">
                                    <div className="trade-meta-item">
                                        <span className="meta-label">
                                            Catalyst
                                        </span>
                                        <span className="meta-value">
                                            {trade.catalyst}
                                        </span>
                                    </div>
                                    <div className="trade-meta-item">
                                        <span className="meta-label">
                                            Timeframe
                                        </span>
                                        <span className="meta-value">
                                            {trade.timeframe}
                                        </span>
                                    </div>
                                    <div className="trade-meta-item">
                                        <span className="meta-label">
                                            Expected Return
                                        </span>
                                        <span className="meta-value expected-return">
                                            {trade.expectedReturn}
                                        </span>
                                    </div>
                                </div>

                                <div className="trade-badges">
                                    <span
                                        className={`confidence-tag ${getConfidenceClass(trade.confidence)}`}
                                    >
                                        {trade.confidence} Confidence
                                    </span>
                                    <span
                                        className={`risk-tag ${getRiskClass(trade.riskLevel)}`}
                                    >
                                        {trade.riskLevel} Risk
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === "ai" && (
                <div className="ai-analysis-section">
                    {aiLoading && (
                        <div className="ai-loading">
                            <div className="loading-spinner-large"></div>
                            <p>Generating AI-powered analysis...</p>
                            <p className="loading-subtext">
                                Analyzing weather patterns, market conditions,
                                and regional factors
                            </p>
                        </div>
                    )}

                    {aiError && (
                        <div className="ai-error">
                            <span className="error-icon">⚠️</span>
                            <h3>{aiError.title || "Error"}</h3>
                            {aiError.details && (
                                <p className="error-details">
                                    {aiError.details}
                                </p>
                            )}
                            {aiError.provider && (
                                <p className="error-provider">
                                    Provider: {aiError.provider}
                                </p>
                            )}

                            {aiError.fallbackAdvice &&
                                aiError.fallbackAdvice.length > 0 && (
                                    <div className="fallback-advice error-fallback">
                                        <h4>Quick Insights (Rule-based)</h4>
                                        <ul>
                                            {aiError.fallbackAdvice.map(
                                                (tip, i) => (
                                                    <li key={i}>{tip}</li>
                                                ),
                                            )}
                                        </ul>
                                    </div>
                                )}

                            <button
                                className="retry-btn"
                                onClick={fetchAIAnalysis}
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {!aiLoading && !aiError && aiAnalysis && (
                        <div className="ai-content">
                            {!aiAnalysis.available ? (
                                <div className="ai-not-configured">
                                    <div className="ai-not-configured-icon">
                                        🔧
                                    </div>
                                    <h3>AI Analysis Not Configured</h3>
                                    <p>{aiAnalysis.message}</p>

                                    {aiAnalysis.fallbackAdvice && (
                                        <div className="fallback-advice">
                                            <h4>Quick Insights</h4>
                                            <ul>
                                                {aiAnalysis.fallbackAdvice.map(
                                                    (tip, i) => (
                                                        <li key={i}>{tip}</li>
                                                    ),
                                                )}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="ai-setup-instructions">
                                        <h4>To Enable AI Analysis:</h4>
                                        <p>
                                            Set the following environment
                                            variables before starting the
                                            backend:
                                        </p>
                                        <code>
                                            LLM_API_KEY=your_api_key
                                            <br />
                                            LLM_PROVIDER=gemini (or anthropic,
                                            openai)
                                            <br />
                                            LLM_MODEL=gemini-2.0-flash (or
                                            gemini-2.5-flash, gemini-2.5-pro,
                                            claude-sonnet-4-20250514, gpt-4o)
                                        </code>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="ai-header">
                                        <div className="ai-provider-badge">
                                            Powered by{" "}
                                            {aiAnalysis.provider === "gemini" ||
                                            aiAnalysis.provider === "google"
                                                ? "Gemini"
                                                : aiAnalysis.provider ===
                                                    "anthropic"
                                                  ? "Claude"
                                                  : "GPT-4"}
                                        </div>
                                        <span className="ai-timestamp">
                                            Generated:{" "}
                                            {new Date(
                                                aiAnalysis.generatedAt,
                                            ).toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="ai-analysis-content">
                                        {aiAnalysis.analysis ? (
                                            <div
                                                className="ai-markdown"
                                                dangerouslySetInnerHTML={{
                                                    __html: formatMarkdown(
                                                        aiAnalysis.analysis,
                                                    ),
                                                }}
                                            />
                                        ) : (
                                            <p>
                                                No analysis content available.
                                            </p>
                                        )}
                                    </div>

                                    <div className="ai-disclaimer">
                                        <span className="disclaimer-icon">
                                            ⚠️
                                        </span>
                                        <p>{aiAnalysis.disclaimer}</p>
                                    </div>

                                    <button
                                        className="refresh-ai-btn"
                                        onClick={fetchAIAnalysis}
                                    >
                                        🔄 Regenerate Analysis
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {!aiLoading && !aiError && !aiAnalysis && (
                        <div className="ai-initial">
                            <div className="ai-initial-icon">🤖</div>
                            <h3>AI-Powered Trading Analysis</h3>
                            <p>
                                Get real-time, intelligent trading insights
                                based on current weather patterns, regional
                                market context, and up-to-date analysis.
                            </p>
                            <button
                                className="generate-ai-btn"
                                onClick={fetchAIAnalysis}
                            >
                                Generate AI Analysis
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Disclaimer */}
            <div className="trading-disclaimer">
                <span className="disclaimer-icon">⚠️</span>
                <p>{analysis?.disclaimer}</p>
            </div>

            {/* Generated timestamp */}
            <div className="trading-footer">
                <span>
                    Analysis generated:{" "}
                    {new Date(analysis?.generatedAt).toLocaleString()}
                </span>
                <button className="refresh-btn" onClick={fetchAnalysis}>
                    🔄 Refresh Analysis
                </button>
            </div>
        </div>
    );
};

export default TradingDashboard;
