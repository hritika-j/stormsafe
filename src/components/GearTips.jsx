import React from 'react'

export default function GearTips() {
  const tips = [
    '☂️ Bring an umbrella',
    '⛑️ Wear protective gear',
    '👟 Wear comfortable shoes',
    '🧥 Dress for the weather',
  ]

  return (
    <div className="bg-green-50 rounded-lg shadow p-6 border-l-4 border-green-500">
      <h2 className="text-xl font-bold text-green-900 mb-4">Travel Gear Tips</h2>
      <ul className="space-y-2">
        {tips.map((tip, index) => (
          <li key={index} className="text-gray-700">{tip}</li>
        ))}
      </ul>
    </div>
  )
}
