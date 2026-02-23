// Weather API integration
// Fetches weather data from OpenWeather API

console.log('VITE_OPENWEATHER_KEY:', import.meta.env.VITE_OPENWEATHER_KEY)

/**
 * Fetch weather data from OpenWeatherMap API
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object|null>} Processed weather object or null if both calls fail
 */
export async function fetchWeather(lat, lng) {
  const apiKey = import.meta.env.VITE_OPENWEATHER_KEY;

  if (!apiKey) {
    console.warn('OpenWeather API key not configured');
    return {
      precipitation: null,
      wind: null,
      visibility: null,
      feelsLike: null,
      alerts: null,
      forecast3hr: null,
    };
  }

  try {
    // Make both API calls in parallel
    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`
      ),
      fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`
      ),
    ]);

    let currentData = null;
    let forecastData = null;

    // Parse current weather
    if (currentResponse.ok) {
      currentData = await currentResponse.json();
    }

    // Parse forecast data
    if (forecastResponse.ok) {
      forecastData = await forecastResponse.json();
    }

    // Process and return clean object
    return {
      precipitation: processPrecipitation(currentData),
      wind: processWind(currentData),
      visibility: processVisibility(currentData),
      feelsLike: processFeelsLike(currentData),
      alerts: processAlerts(currentData),
      forecast3hr: processForecast(currentData, forecastData),
    };
  } catch (error) {
    console.error('Weather fetch error:', error);
    return {
      precipitation: null,
      wind: null,
      visibility: null,
      feelsLike: null,
      alerts: null,
      forecast3hr: null,
    };
  }
}

/**
 * Map precipitation intensity based on mm/hr
 * @param {number} mm - Precipitation in mm/hr
 * @returns {string} 'light', 'moderate', or 'heavy'
 */
function mapIntensity(mm) {
  if (mm < 2.5) return 'light';
  if (mm <= 10) return 'moderate';
  return 'heavy';
}

/**
 * Process precipitation data from current weather
 */
function processPrecipitation(currentData) {
  if (!currentData) return null;

  try {
    // Determine type: rain or snow (prefer snow if both present)
    const snowAmount = currentData.snow?.['1h'] || 0;
    const rainAmount = currentData.rain?.['1h'] || 0;

    if (snowAmount === 0 && rainAmount === 0) {
      return null;
    }

    const type = snowAmount > rainAmount ? 'snow' : 'rain';
    const amount = Math.max(snowAmount, rainAmount);
    const intensity = mapIntensity(amount);

    return { type, intensity };
  } catch (error) {
    console.error('Error processing precipitation:', error);
    return null;
  }
}

/**
 * Process wind data from current weather
 */
function processWind(currentData) {
  if (!currentData?.wind) return null;

  try {
    const speed = Math.round(currentData.wind.speed);
    const gusts = currentData.wind.gust
      ? Math.round(currentData.wind.gust)
      : null;

    if (speed === 0 && !gusts) {
      return null;
    }

    return { speed, gusts };
  } catch (error) {
    console.error('Error processing wind:', error);
    return null;
  }
}

/**
 * Process visibility data from current weather (convert to km)
 */
function processVisibility(currentData) {
  if (!currentData?.visibility) return null;

  try {
    // OpenWeatherMap returns visibility in meters, convert to km
    const visibilityKm = currentData.visibility / 1000;
    return Math.round(visibilityKm * 10) / 10;
  } catch (error) {
    console.error('Error processing visibility:', error);
    return null;
  }
}

/**
 * Process feels like temperature from current weather
 */
function processFeelsLike(currentData) {
  if (currentData?.feels_like === undefined) return null;

  try {
    return Math.round(currentData.feels_like);
  } catch (error) {
    console.error('Error processing feels like:', error);
    return null;
  }
}

/**
 * Process weather alerts from current weather
 */
function processAlerts(currentData) {
  if (!currentData?.alerts || currentData.alerts.length === 0) {
    return null;
  }

  try {
    return currentData.alerts.map((alert) => ({
      title: alert.event || 'Weather Alert',
      severity: mapAlertSeverity(alert),
    }));
  } catch (error) {
    console.error('Error processing alerts:', error);
    return null;
  }
}

/**
 * Map alert severity from OpenWeatherMap data
 */
function mapAlertSeverity(alert) {
  const event = alert.event?.toLowerCase() || '';
  if (
    event.includes('warn') ||
    event.includes('watch') ||
    event.includes('storm')
  ) {
    return 'extreme';
  }
  if (event.includes('advisory')) {
    return 'high';
  }
  return 'moderate';
}

/**
 * Process 3-hour forecast trend from forecast data
 */
function processForecast(currentData, forecastData) {
  if (!forecastData?.list || forecastData.list.length === 0) {
    return null;
  }

  try {
    const current = currentData?.rain?.['1h'] || currentData?.snow?.['1h'] || 0;
    const next3hr =
      forecastData.list[0]?.rain?.['3h'] || forecastData.list[0]?.snow?.['3h'] || 0;

    // Determine trend
    let trend = 'steady';
    if (next3hr > current * 1.5) {
      trend = 'worsening';
    } else if (next3hr < current * 0.75) {
      trend = 'improving';
    }

    const precipExpected = next3hr > 0;

    return { trend, precipExpected };
  } catch (error) {
    console.error('Error processing forecast:', error);
    return null;
  }
}

export async function getWeatherData(latitude, longitude) {
  const apiKey = import.meta.env.VITE_REACT_APP_OPENWEATHER_KEY;
  
  if (!apiKey) {
    console.warn('OpenWeather API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch weather data');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Weather API error:', error);
    return null;
  }
}

export async function getWeatherForecast(latitude, longitude) {
  const apiKey = import.meta.env.VITE_REACT_APP_OPENWEATHER_KEY;
  
  if (!apiKey) {
    console.warn('OpenWeather API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch weather forecast');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Forecast API error:', error);
    return null;
  }
}
