import TransitStatusStrip from './TransitStatusStrip'

// All class strings are literals so Tailwind's scanner includes them at build time
const VERDICT_CONFIG = {
  'Go for it':         { bg: 'bg-[#ECFDF5]', border: 'border-l-4 border-[#10B981]', text: 'text-[#065F46]',  emoji: '✅', accent: '#10B981', textHex: '#065F46' },
  'Go if you have to': { bg: 'bg-[#FFFBEB]', border: 'border-l-4 border-[#F59E0B]', text: 'text-[#92400E]',  emoji: '⚠️', accent: '#F59E0B', textHex: '#92400E' },
  'Wait it out':       { bg: 'bg-[#EFF6FF]', border: 'border-l-4 border-[#3B82F6]', text: 'text-[#1E40AF]',  emoji: '⏸️', accent: '#3B82F6', textHex: '#1E40AF' },
  'Stay in tonight':   { bg: 'bg-[#FEF2F2]', border: 'border-l-4 border-[#EF4444]', text: 'text-[#991B1B]',  emoji: '🚫', accent: '#EF4444', textHex: '#991B1B' },
}

// Light risk pills
const RISK_PILL = {
  low:     'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]',
  medium:  'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]',
  high:    'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]',
  unknown: 'bg-gray-50 text-gray-400 border border-gray-200',
}

const RISK_LABEL = {
  low:     'Low',
  medium:  'Medium',
  high:    'High',
  unknown: 'Unknown',
}

function formatTime(minutes) {
  if (!minutes) return '--'
  if (minutes < 60) return `${minutes}min`
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hrs}hr`
  return `${hrs}hr ${mins}min`
}

export default function ResultScreen({ result, onReset }) {
  const { recommendation, transit, travelData } = result
  const cfg = VERDICT_CONFIG[recommendation.verdict] ?? VERDICT_CONFIG['Wait it out']
  const risk = recommendation.return_risk ?? 'unknown'

  const baseline = travelData?.baseline_minutes ?? null
  const storm    = travelData?.storm_minutes ?? null
  const delta    = baseline != null && storm != null ? storm - baseline : null

  // Suppress transit UI for short/walkable trips
  const isWalkable =
    travelData?.distance_category === 'walkable' ||
    (travelData?.baseline_minutes != null && travelData.baseline_minutes < 20)

  console.log('isWalkable:', isWalkable, '| distance_category:', travelData?.distance_category, '| baseline_minutes:', travelData?.baseline_minutes)

  return (
    <div className="relative min-h-screen bg-[#F7F5F2] flex flex-col font-sans">

      {/* Top nav — back button overlaid on verdict block */}
      <div className="absolute top-0 left-0 right-0 pt-5 px-4 z-10">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 text-[#64748B] hover:text-[#1A1A2E] active:opacity-60 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-semibold tracking-wide">New trip</span>
        </button>
      </div>

      {/* 1. Verdict block — soft colored card with left border accent */}
      <div className={`relative ${cfg.bg} ${cfg.border} px-5 pt-14 pb-9 flex flex-col gap-4`}>
        <p className={`text-5xl font-black ${cfg.text} leading-tight font-display`}>
          {cfg.emoji} {recommendation.verdict}
        </p>

        {/* 2. Reasons */}
        <ul className="flex flex-col gap-2 mt-1">
          {recommendation.reasons.map((reason, i) => (
            <li key={i} className={`${cfg.text} opacity-80 text-[15px] leading-snug`}>
              · {reason}
            </li>
          ))}
        </ul>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-5 flex flex-col gap-4">

        {/* 3. Travel time strip */}
        {baseline != null && storm != null && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl px-4 py-3 flex items-center gap-2 shadow-sm">
            <span className="text-xs text-[#94A3B8] font-medium shrink-0">Normal</span>
            <span className="text-sm font-bold text-[#1A1A2E]">{formatTime(baseline)}</span>
            <span className="text-[#CBD5E1] text-xs px-1">vs</span>
            <span className="text-xs text-[#94A3B8] font-medium shrink-0">Today</span>
            <span className="text-sm font-bold text-[#1A1A2E]">{formatTime(storm)}</span>
            {delta > 15 ? (
              <span className="ml-auto text-sm font-bold text-orange-500 shrink-0">+{formatTime(delta)}</span>
            ) : (
              <span className="ml-auto text-xs text-[#CBD5E1] shrink-0">+{formatTime(delta ?? 0)}</span>
            )}
          </div>
        )}

        {/* 4. Return risk badge */}
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Return risk</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${RISK_PILL[risk] ?? RISK_PILL.unknown}`}>
            {RISK_LABEL[risk] ?? 'Unknown'}
          </span>
        </div>

        {/* 5. Best route callout — hidden for walkable/short trips */}
        {!isWalkable && recommendation.best_route_advice && (
          <div className="bg-white border border-[#BFDBFE] rounded-2xl px-4 py-4 shadow-sm">
            <p className="text-[10px] font-bold text-[#5B7FA6] uppercase tracking-widest mb-1.5">Best route</p>
            <p className="text-sm text-[#1A1A2E] leading-snug">{recommendation.best_route_advice}</p>
          </div>
        )}

        {/* 6. Transit status strip — hidden for walkable/short trips */}
        {!isWalkable && (
          <TransitStatusStrip transit={transit} relevantLines={travelData?.relevantLines} />
        )}

        {/* Summary — the app's final word */}
        {recommendation.summary && (
          <div
            className="mt-2 rounded-lg px-5 py-4 border-l-4"
            style={{
              borderLeftColor: cfg.accent,
              backgroundColor: `${cfg.accent}14`,
            }}
          >
            <p
              className="font-medium italic leading-snug"
              style={{ fontSize: '18px', color: cfg.textHex }}
            >
              {recommendation.summary}
            </p>
          </div>
        )}

        {/* 7. Plan another trip CTA */}
        <button
          type="button"
          onClick={onReset}
          className="w-full mt-4 py-5 rounded-2xl bg-[#5B7FA6] text-white font-bold text-base tracking-wide active:opacity-75 transition-opacity shadow-md"
        >
          Plan another trip
        </button>
      </div>
    </div>
  )
}
