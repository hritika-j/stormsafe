import { useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import InputScreen from './components/InputScreen'
import LoadingScreen from './components/LoadingScreen'
import ResultScreen from './components/ResultScreen'
import { fetchWeather } from './api/weather'
import { fetchTravelBan } from './api/travelBan'
import { fetchTransitStatus } from './api/transitStatus'
import { fetchTravelData } from './api/travelData'
import { getRecommendation } from './api/claudeEngine'

export default function App() {
  const [screen, setScreen] = useState('input')
  const [result, setResult] = useState(null)

  async function handleSubmit({
    originCoords,
    originLabel,
    originAddress,
    destinationCoords,
    destinationLabel,
    destinationAddress,
    departureTime,
  }) {
    setScreen('loading')
    try {
      const [weatherData, travelBanData, transitData, travelData] = await Promise.all([
        fetchWeather(originCoords.lat, originCoords.lng),
        fetchTravelBan(),
        // Pass full addresses so isPathRelevant() can detect NJ keywords in state info
        fetchTransitStatus([], originAddress, destinationAddress),
        // Pass destinationCoords directly to skip re-geocoding the short label,
        // which can resolve to the wrong city and produce impossibly large times
        fetchTravelData(originCoords, destinationLabel, 'moderate', destinationCoords),
      ])

      const payload = {
        origin: originCoords,
        origin_name: originLabel,
        destination: destinationCoords,
        destination_name: destinationLabel,
        departure_time: departureTime,
        weather: weatherData,
        travel_ban: travelBanData,
        transit_status: transitData,
        travel_data: travelData,
      }

      // Compute isWalkable here so we can pass it to Claude as a flag
      const isWalkable =
        travelData?.distance_category === 'walkable' ||
        (travelData?.baseline_minutes != null && travelData.baseline_minutes < 20)

      payload.is_walkable = isWalkable

      const recommendation = await getRecommendation(payload)

      setResult({ recommendation, transit: transitData, travelData, weather: weatherData })
      setScreen('result')
    } catch (err) {
      console.error('StormSafe fetch error:', err)
      setScreen('input')
    }
  }

  if (screen === 'loading') return <><LoadingScreen /><Analytics /></>
  if (screen === 'result') return <><ResultScreen result={result} onReset={() => setScreen('input')} /><Analytics /></>
  return <><InputScreen onSubmit={handleSubmit} /><Analytics /></>
}
