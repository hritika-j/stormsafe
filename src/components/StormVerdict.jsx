import React from 'react'

export default function StormVerdict({ recommendation }) {
  if (!recommendation) {
    return null
  }

  // Map verdict to color and icon
  const verdictConfig = {
    'Go for it': { color: 'green', bgColor: 'green-50', borderColor: 'green-500', icon: '✓' },
    'Stay nearby': { color: 'yellow', bgColor: 'yellow-50', borderColor: 'yellow-500', icon: '⚠' },
    'Wait it out': { color: 'orange', bgColor: 'orange-50', borderColor: 'orange-500', icon: '⏸' },
    'Not tonight': { color: 'red', bgColor: 'red-50', borderColor: 'red-500', icon: '✕' },
  }

  const config = verdictConfig[recommendation.verdict] || verdictConfig['Wait it out']

  return (
    <div
      className={`bg-${config.bgColor} rounded-lg shadow p-6 mb-4 border-l-4 border-${config.borderColor}`}
    >
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Storm Safety Verdict</h2>

      {/* Verdict */}
      <div className={`text-2xl font-bold text-${config.color}-700 mb-4`}>
        {config.icon} {recommendation.verdict}
      </div>

      {/* Return Risk */}
      <div className="mb-4">
        <span className="text-sm font-semibold text-gray-700">Return Risk: </span>
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
            recommendation.return_risk === 'high'
              ? 'bg-red-200 text-red-800'
              : recommendation.return_risk === 'medium'
                ? 'bg-yellow-200 text-yellow-800'
                : recommendation.return_risk === 'low'
                  ? 'bg-green-200 text-green-800'
                  : 'bg-gray-200 text-gray-800'
          }`}
        >
          {recommendation.return_risk.charAt(0).toUpperCase() + recommendation.return_risk.slice(1)}
        </span>
      </div>

      {/* Summary */}
      <p className="text-gray-700 mb-4 text-lg">{recommendation.summary}</p>

      {/* Reasons */}
      {recommendation.reasons && recommendation.reasons.length > 0 && (
        <div className="mb-4">
          <h3 className="font-semibold text-gray-800 mb-2">Key Factors:</h3>
          <ul className="list-disc list-inside space-y-1">
            {recommendation.reasons.map((reason, idx) => (
              <li key={idx} className="text-gray-700">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Best Route Advice */}
      {recommendation.best_route_advice && (
        <div className={`bg-white bg-opacity-60 rounded p-3 border-l-2 border-${config.borderColor} italic text-gray-700`}>
          💡 {recommendation.best_route_advice}
        </div>
      )}
    </div>
  )
}
