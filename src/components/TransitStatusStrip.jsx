// Light theme: clean colored tags with subtle backgrounds
const PILL_NORMAL    = 'bg-[#ECFDF5] rounded-md text-[#065F46] border border-[#A7F3D0]'
const PILL_DELAYS    = 'bg-[#FFFBEB] rounded-md text-[#92400E] border border-[#FDE68A]'
const PILL_SUSPENDED = 'bg-[#FEF2F2] rounded-md text-[#991B1B] border border-[#FECACA]'
const PILL_UNKNOWN   = 'bg-gray-50 rounded-md text-gray-400 border border-gray-200'

function getPillClass(status, message) {
  if (!status) return PILL_UNKNOWN
  const isSuspended = typeof message === 'string' && message.toLowerCase().includes('suspend')
  if (isSuspended) return PILL_SUSPENDED
  if (status === 'delays' || message) return PILL_DELAYS
  if (status === 'normal') return PILL_NORMAL
  return PILL_UNKNOWN
}

// relevantLines: string[] of line IDs for this specific trip (e.g. ['A','C','E'])
// If empty or undefined, render nothing — never show all 20+ subway lines
export default function TransitStatusStrip({ transit, relevantLines }) {
  if (!transit) return null
  if (!relevantLines || relevantLines.length === 0) return null

  const { subway = {}, path } = transit

  // Only render the lines explicitly passed for this trip, with live status colors
  const lines = relevantLines.map((id) => ({
    id,
    status: subway[id] ?? { status: null, message: null },
  }))

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl px-4 py-4 shadow-sm">
      <p className="text-[10px] font-bold text-[#5B7FA6] uppercase tracking-widest mb-3">Transit</p>

      <div className="flex flex-wrap gap-2">
        {lines.map(({ id, status: s }) => (
          <span
            key={id}
            title={s.message ?? undefined}
            className={`px-3 py-1.5 text-xs font-bold ${getPillClass(s.status, s.message)}`}
          >
            {id}
          </span>
        ))}

        {/* PATH pill — only rendered when path is not null */}
        {path !== null && path !== undefined && (
          <span
            title={path?.message ?? undefined}
            className={`px-3 py-1.5 text-xs font-bold ${getPillClass(path?.status, path?.message)}`}
          >
            PATH
          </span>
        )}
      </div>
    </div>
  )
}
