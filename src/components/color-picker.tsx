import { useEffect, useRef, useState } from 'react'

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return { h: 270, s: 0.45, v: 0.36 }
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const hsv = hexToHsv(value)
  const hueColor = hsvToHex(hsv.h, 1, 1)
  const [hexDraft, setHexDraft] = useState(value)
  const svRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHexDraft(value)
  }, [value])

  function setFromPointer(clientX: number, clientY: number) {
    const el = svRef.current
    if (!el) return
    const box = el.getBoundingClientRect()
    const s = Math.min(1, Math.max(0, (clientX - box.left) / box.width))
    const v = Math.min(1, Math.max(0, 1 - (clientY - box.top) / box.height))
    onChange(hsvToHex(hsv.h, s, v))
  }

  return (
    <div className="w-[220px] max-w-full rounded-xl border border-zinc-200 bg-white p-2 text-zinc-900 shadow">
      <div
        ref={svRef}
        className="relative h-[140px] w-full cursor-crosshair rounded-lg"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          setFromPointer(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (e.buttons) setFromPointer(e.clientX, e.clientY)
        }}
      >
        <span
          className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={360}
        value={Math.round(hsv.h)}
        aria-label="色相"
        className="mt-2 h-3 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
        onChange={(e) => onChange(hsvToHex(Number(e.target.value), hsv.s, hsv.v))}
      />
      <p className="mt-2 text-xs font-medium">Hexカラーコード</p>
      <input
        value={hexDraft}
        onChange={(e) => {
          const next = e.target.value
          setHexDraft(next)
          if (/^#?[0-9a-f]{6}$/i.test(next.trim())) {
            const hex = next.startsWith('#') ? next : `#${next}`
            onChange(hex.toLowerCase())
          }
        }}
        className="mt-1 h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
        spellCheck={false}
      />
    </div>
  )
}
