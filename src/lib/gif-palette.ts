/** Map RGBA to GIF indices, preserving an existing palette when possible. */

export function uniqueRgbPalette(tables: Array<Array<[number, number, number] | number[]>>): number[][] {
  const seen = new Set<string>()
  const out: number[][] = []
  for (const table of tables) {
    for (const c of table) {
      const r = c[0] ?? 0
      const g = c[1] ?? 0
      const b = c[2] ?? 0
      const key = `${r},${g},${b}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push([r, g, b])
      if (out.length >= 255) return out
    }
  }
  return out
}

export function indexRgbaWithPalette(
  rgba: Uint8ClampedArray | Uint8Array,
  palette: number[][],
  transparentIndex: number,
): Uint8Array {
  const count = rgba.length / 4
  const index = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    const o = i * 4
    if (rgba[o + 3] < 16) {
      index[i] = transparentIndex
      continue
    }
    index[i] = nearestColor(rgba[o], rgba[o + 1], rgba[o + 2], palette, transparentIndex)
  }
  return index
}

function nearestColor(
  r: number,
  g: number,
  b: number,
  palette: number[][],
  skipIndex: number,
): number {
  let best = skipIndex === 0 ? 1 : 0
  if (best >= palette.length) best = 0
  let bestD = Infinity
  for (let i = 0; i < palette.length; i++) {
    if (i === skipIndex) continue
    const p = palette[i]
    const dr = p[0] - r
    const dg = p[1] - g
    const db = p[2] - b
    const d = dr * dr + dg * dg + db * db
    if (d < bestD) {
      bestD = d
      best = i
      if (d === 0) return i
    }
  }
  return best
}

export function withTransparentSlot(colors: number[][]): { palette: number[][]; transparentIndex: number } {
  const palette = colors.map((c) => [c[0], c[1], c[2]])
  const transparentIndex = palette.length
  palette.push([0, 0, 0])
  return { palette, transparentIndex }
}
