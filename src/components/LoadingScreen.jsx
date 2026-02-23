import { useState, useEffect } from 'react'

const MESSAGES = [
  'Is it worth stepping out?',
  'Checking the storm...',
  'Reading the streets...',
]

export default function LoadingScreen() {
  const [msgIndex, setMsgIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out, swap text, fade in
      setVisible(false)
      setTimeout(() => {
        setMsgIndex((i) => (i + 1) % MESSAGES.length)
        setVisible(true)
      }, 300)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#F7F5F2] flex flex-col items-center justify-center gap-7 font-sans">
      {/* Cobalt spinner */}
      <div className="w-14 h-14 rounded-full border-4 border-[#E2E8F0] border-t-[#5B7FA6] animate-spin" />
      <p
        className="text-[#1A1A2E] text-xl font-semibold tracking-wide transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {MESSAGES[msgIndex]}
      </p>
    </div>
  )
}
