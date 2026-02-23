import { useState } from 'react'
import { SearchBox } from '@mapbox/search-js-react'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_KEY

const TIME_OPTIONS = [
  { value: 'now',   label: 'Now' },
  { value: 'soon',  label: '1–2 hrs' },
  { value: 'later', label: 'Later' },
]

const NYC_BOUNDS = { minLat: 40.4, maxLat: 41.2, minLng: -74.8, maxLng: -73.7 }

function isInNYCArea(coords) {
  return (
    coords.lat >= NYC_BOUNDS.minLat &&
    coords.lat <= NYC_BOUNDS.maxLat &&
    coords.lng >= NYC_BOUNDS.minLng &&
    coords.lng <= NYC_BOUNDS.maxLng
  )
}

// Strip SearchBox's own border/shadow — our wrapper div controls the look
const SEARCHBOX_THEME = {
  variables: {
    border: 'none',
    borderRadius: '0',
    boxShadow: 'none',
    colorBackground: 'white',
    fontFamily: 'DM Sans, sans-serif',
  },
}

export default function InputScreen({ onSubmit }) {
  const [originLabel,      setOriginLabel]      = useState('')
  const [originCoords,     setOriginCoords]     = useState(null)
  const [originAddress,    setOriginAddress]    = useState('')
  const [originError,      setOriginError]      = useState(null)

  const [destinationLabel,   setDestinationLabel]   = useState('')
  const [destinationCoords,  setDestinationCoords]  = useState(null)
  const [destinationAddress, setDestinationAddress] = useState('')
  const [destinationError,   setDestinationError]   = useState(null)

  const [departureTime, setDepartureTime] = useState('now')

  function handleGo() {
    let hasError = false

    if (!originCoords) {
      setOriginError('Please select a starting location from the suggestions.')
      hasError = true
    } else if (!isInNYCArea(originCoords)) {
      setOriginError('Please enter a New York or New Jersey location.')
      hasError = true
    } else {
      setOriginError(null)
    }

    if (!destinationCoords) {
      setDestinationError('Please select a destination from the suggestions.')
      hasError = true
    } else if (!isInNYCArea(destinationCoords)) {
      setDestinationError('Please enter a New York or New Jersey location.')
      hasError = true
    } else {
      setDestinationError(null)
    }

    if (hasError) return

    onSubmit({
      originCoords,
      originLabel,
      originAddress,
      destinationCoords,
      destinationLabel,
      destinationAddress,
      departureTime,
    })
  }

  return (
    <div
      className="min-h-screen flex justify-center font-sans relative overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #F5F0E8, #E8EEF4)' }}
    >

      {/* ── Content column ─────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-[420px] px-5 py-14 flex flex-col">

        {/* Header */}
        <div className="text-center mb-10">
          <h1
            className="font-syne font-bold text-[#1C1C1E] leading-tight"
            style={{ fontSize: '40px' }}
          >
            StormSafe
          </h1>
          <p className="text-[10px] font-bold text-[#5B7FA6] uppercase tracking-[0.3em] mt-2">
            Step out or stay in?
          </p>
          <div className="w-[60px] h-px bg-[#5B7FA6] mx-auto mt-4" />
        </div>

        {/* ── Fields — no card, sit directly on background ────── */}
        <div className="flex flex-col gap-8">

          {/* From */}
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
              From
            </p>
            <div
              className="rounded-xl overflow-hidden bg-white"
              style={{ border: '1px solid #D4CFC8' }}
            >
              <SearchBox
                accessToken={MAPBOX_TOKEN}
                value={originLabel}
                placeholder="Where are you now?"
                onRetrieve={(res) => {
                  const f = res.features?.[0]
                  if (!f) return
                  const [lng, lat] = f.geometry.coordinates
                  const name = f.properties.name ?? ''
                  const formatted = f.properties.place_formatted ?? ''
                  setOriginLabel(name)
                  setOriginAddress(formatted ? `${name}, ${formatted}` : name)
                  setOriginCoords({ lat, lng })
                  setOriginError(null)
                }}
                onChange={(val) => {
                  const text = typeof val === 'string' ? val : (val?.value ?? '')
                  setOriginLabel(text)
                  setOriginCoords(null)
                  setOriginAddress('')
                  setOriginError(null)
                }}
                country="US"
                proximity="-74.006,40.7128"
                types="address,place,neighborhood,poi"
                theme={SEARCHBOX_THEME}
              />
            </div>
            {originCoords && !originError && (
              <p className="text-[11px] text-[#10B981] font-medium mt-1.5">✓ {originLabel}</p>
            )}
            {originError && (
              <p className="text-[11px] text-red-500 font-medium mt-1.5">{originError}</p>
            )}
          </div>

          {/* To */}
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
              To
            </p>
            <div
              className="rounded-xl overflow-hidden bg-white"
              style={{ border: '1px solid #D4CFC8' }}
            >
              <SearchBox
                accessToken={MAPBOX_TOKEN}
                value={destinationLabel}
                placeholder="Where are you headed?"
                onRetrieve={(res) => {
                  const f = res.features?.[0]
                  if (!f) return
                  const [lng, lat] = f.geometry.coordinates
                  const name = f.properties.name ?? ''
                  const formatted = f.properties.place_formatted ?? ''
                  setDestinationLabel(name)
                  setDestinationAddress(formatted ? `${name}, ${formatted}` : name)
                  setDestinationCoords({ lat, lng })
                  setDestinationError(null)
                }}
                onChange={(val) => {
                  const text = typeof val === 'string' ? val : (val?.value ?? '')
                  setDestinationLabel(text)
                  setDestinationCoords(null)
                  setDestinationAddress('')
                  setDestinationError(null)
                }}
                country="US"
                proximity="-74.006,40.7128"
                types="address,place,neighborhood,poi"
                theme={SEARCHBOX_THEME}
              />
            </div>
            {destinationCoords && !destinationError && (
              <p className="text-[11px] text-[#10B981] font-medium mt-1.5">✓ {destinationLabel}</p>
            )}
            {destinationError && (
              <p className="text-[11px] text-red-500 font-medium mt-1.5">{destinationError}</p>
            )}
          </div>

          {/* When */}
          <div>
            <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
              When are you leaving?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDepartureTime(opt.value)}
                  className={`h-10 rounded-full text-sm font-semibold transition-colors border ${
                    departureTime === opt.value
                      ? 'bg-[#5B7FA6] border-[#5B7FA6] text-white'
                      : 'bg-white border-[#5B7FA6] text-[#5B7FA6] active:bg-blue-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* CTA — warmer blue, breathing room above */}
          <button
            type="button"
            onClick={handleGo}
            className="w-full h-14 rounded-xl text-white font-bold text-base tracking-wide active:opacity-75 transition-opacity mt-4"
            style={{
              backgroundColor: '#5B7FA6',
              boxShadow: '0 4px 14px rgba(29, 78, 216, 0.28)',
            }}
          >
            Should I go?
          </button>

        </div>
      </div>
    </div>
  )
}
