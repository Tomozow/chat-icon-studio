import type { CropSquare, FitMode, ScaleFilter } from './types'

export function fitRect(
  srcW: number,
  srcH: number,
  size: number,
  mode: FitMode,
): { dx: number; dy: number; dw: number; dh: number } {
  const scale =
    mode === 'cover' ? Math.max(size / srcW, size / srcH) : Math.min(size / srcW, size / srcH)
  const dw = srcW * scale
  const dh = srcH * scale
  return { dx: (size - dw) / 2, dy: (size - dh) / 2, dw, dh }
}

export function isIdentityFit(srcW: number, srcH: number, size: number, crop: CropSquare | null): boolean {
  if (crop) return false
  if (srcW !== size || srcH !== size) return false
  return true
}

export function extractSquare(src: ImageData, crop: CropSquare): ImageData {
  const size = Math.max(1, Math.round(crop.size))
  const x0 = Math.max(0, Math.min(src.width - size, Math.round(crop.x)))
  const y0 = Math.max(0, Math.min(src.height - size, Math.round(crop.y)))
  const out = new ImageData(size, size)
  const s = src.data
  const d = out.data
  for (let y = 0; y < size; y++) {
    const sy = y0 + y
    if (sy < 0 || sy >= src.height) continue
    for (let x = 0; x < size; x++) {
      const sx = x0 + x
      if (sx < 0 || sx >= src.width) continue
      const si = (sy * src.width + sx) * 4
      const di = (y * size + x) * 4
      d[di] = s[si]
      d[di + 1] = s[si + 1]
      d[di + 2] = s[si + 2]
      d[di + 3] = s[si + 3]
    }
  }
  return out
}

export function placeOnSquare(src: ImageData, size: number, filter: ScaleFilter, crop: CropSquare | null): ImageData {
  if (crop) {
    return resizeImageData(extractSquare(src, crop), size, size, filter)
  }
  const { dx, dy, dw, dh } = fitRect(src.width, src.height, size, 'contain')
  const scaled = resizeImageData(src, dw, dh, filter)
  const out = new ImageData(size, size)
  blitImageData(out, scaled, Math.round(dx), Math.round(dy))
  return out
}

export function resizeImageData(
  src: ImageData,
  destW: number,
  destH: number,
  filter: ScaleFilter,
): ImageData {
  destW = Math.max(1, Math.round(destW))
  destH = Math.max(1, Math.round(destH))
  if (src.width === destW && src.height === destH) {
    return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height)
  }
  return resizeOnce(src, destW, destH, filter)
}

function resizeOnce(src: ImageData, destW: number, destH: number, filter: ScaleFilter): ImageData {
  destW = Math.max(1, Math.round(destW))
  destH = Math.max(1, Math.round(destH))
  if (src.width === destW && src.height === destH) {
    return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height)
  }
  const out = new ImageData(destW, destH)
  if (filter === 'nearest') nearestResize(src, out)
  else if (filter === 'area') areaResize(src, out)
  else highQualityResize(src, out)
  return out
}

function nearestResize(src: ImageData, dest: ImageData) {
  const { width: sw, height: sh, data: s } = src
  const { width: dw, height: dh, data: d } = dest
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor(((y + 0.5) * sh) / dh))
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor(((x + 0.5) * sw) / dw))
      const si = (sy * sw + sx) * 4
      const di = (y * dw + x) * 4
      d[di] = s[si]
      d[di + 1] = s[si + 1]
      d[di + 2] = s[si + 2]
      d[di + 3] = s[si + 3]
    }
  }
}

function catmullRom(x: number): number {
  const ax = Math.abs(x)
  const ax2 = ax * ax
  const ax3 = ax2 * ax
  if (ax <= 1) return 1.5 * ax3 - 2.5 * ax2 + 1
  if (ax <= 2) return -0.5 * ax3 + 2.5 * ax2 - 4 * ax + 2
  return 0
}

function encodeSrgbPremul(src: ImageData): Float32Array {
  const s = src.data
  const out = new Float32Array(s.length)
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3] / 255
    out[i] = (s[i] / 255) * a
    out[i + 1] = (s[i + 1] / 255) * a
    out[i + 2] = (s[i + 2] / 255) * a
    out[i + 3] = a
  }
  return out
}

function decodeSrgbPremul(buf: Float32Array, dest: ImageData) {
  const d = dest.data
  for (let i = 0; i < d.length; i += 4) {
    const a = buf[i + 3]
    if (a <= 1 / 255) {
      d[i] = 0
      d[i + 1] = 0
      d[i + 2] = 0
      d[i + 3] = 0
      continue
    }
    d[i] = Math.max(0, Math.min(255, Math.round((buf[i] / a) * 255)))
    d[i + 1] = Math.max(0, Math.min(255, Math.round((buf[i + 1] / a) * 255)))
    d[i + 2] = Math.max(0, Math.min(255, Math.round((buf[i + 2] / a) * 255)))
    d[i + 3] = Math.max(0, Math.min(255, Math.round(a * 255)))
  }
}

function resizeAxis(
  src: Float32Array,
  srcW: number,
  srcH: number,
  destLen: number,
  axis: 'x' | 'y',
): { data: Float32Array; width: number; height: number } {
  const destW = axis === 'x' ? destLen : srcW
  const destH = axis === 'y' ? destLen : srcH
  const dest = new Float32Array(destW * destH * 4)
  const srcSpan = axis === 'x' ? srcW : srcH
  const destSpan = axis === 'x' ? destW : destH
  const scale = srcSpan / destSpan
  const support = Math.max(1, scale) * 2

  for (let y = 0; y < destH; y++) {
    for (let x = 0; x < destW; x++) {
      const t = axis === 'x' ? x : y
      const center = (t + 0.5) * scale - 0.5
      const i0 = Math.floor(center - support)
      const i1 = Math.ceil(center + support)
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let wsum = 0
      for (let i = i0; i <= i1; i++) {
        const w = catmullRom((center - i) / Math.max(1, scale))
        if (w === 0) continue
        const ci = i < 0 ? 0 : i >= srcSpan ? srcSpan - 1 : i
        const sx = axis === 'x' ? ci : x
        const sy = axis === 'y' ? ci : y
        const si = (sy * srcW + sx) * 4
        r += src[si] * w
        g += src[si + 1] * w
        b += src[si + 2] * w
        a += src[si + 3] * w
        wsum += w
      }
      const di = (y * destW + x) * 4
      if (wsum === 0) continue
      dest[di] = Math.max(0, r / wsum)
      dest[di + 1] = Math.max(0, g / wsum)
      dest[di + 2] = Math.max(0, b / wsum)
      dest[di + 3] = Math.max(0, Math.min(1, a / wsum))
      dest[di] = Math.min(dest[di], dest[di + 3])
      dest[di + 1] = Math.min(dest[di + 1], dest[di + 3])
      dest[di + 2] = Math.min(dest[di + 2], dest[di + 3])
    }
  }
  return { data: dest, width: destW, height: destH }
}

function highQualityResize(src: ImageData, dest: ImageData) {
  const premul = encodeSrgbPremul(src)
  const horiz = resizeAxis(premul, src.width, src.height, dest.width, 'x')
  const vert = resizeAxis(horiz.data, horiz.width, horiz.height, dest.height, 'y')
  decodeSrgbPremul(vert.data, dest)
}

/** Box-filter (area) downscale / bilinear-ish upscale with premultiplied alpha. */
function areaResize(src: ImageData, dest: ImageData) {
  const { width: sw, height: sh, data: s } = src
  const { width: dw, height: dh, data: d } = dest
  for (let y = 0; y < dh; y++) {
    const y0 = (y * sh) / dh
    const y1 = ((y + 1) * sh) / dh
    for (let x = 0; x < dw; x++) {
      const x0 = (x * sw) / dw
      const x1 = ((x + 1) * sw) / dw
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let weight = 0
      const xStart = Math.floor(x0)
      const xEnd = Math.min(sw, Math.ceil(x1))
      const yStart = Math.floor(y0)
      const yEnd = Math.min(sh, Math.ceil(y1))
      for (let sy = yStart; sy < yEnd; sy++) {
        const rowY0 = Math.max(y0, sy)
        const rowY1 = Math.min(y1, sy + 1)
        const yh = rowY1 - rowY0
        if (yh <= 0) continue
        for (let sx = xStart; sx < xEnd; sx++) {
          const colX0 = Math.max(x0, sx)
          const colX1 = Math.min(x1, sx + 1)
          const xw = colX1 - colX0
          if (xw <= 0) continue
          const w = xw * yh
          const si = (sy * sw + sx) * 4
          const pa = s[si + 3] / 255
          r += s[si] * pa * w
          g += s[si + 1] * pa * w
          b += s[si + 2] * pa * w
          a += s[si + 3] * w
          weight += w
        }
      }
      const di = (y * dw + x) * 4
      if (weight <= 0) continue
      const alpha = a / weight
      if (alpha < 128) {
        d[di] = 0
        d[di + 1] = 0
        d[di + 2] = 0
        d[di + 3] = 0
      } else {
        const pa = alpha / 255
        d[di] = Math.round(r / weight / pa)
        d[di + 1] = Math.round(g / weight / pa)
        d[di + 2] = Math.round(b / weight / pa)
        d[di + 3] = 255
      }
    }
  }
}

export function blitImageData(dest: ImageData, src: ImageData, left: number, top: number, opaqueOnly = false) {
  const s = src.data
  const d = dest.data
  for (let y = 0; y < src.height; y++) {
    const dy = top + y
    if (dy < 0 || dy >= dest.height) continue
    for (let x = 0; x < src.width; x++) {
      const dx = left + x
      if (dx < 0 || dx >= dest.width) continue
      const si = (y * src.width + x) * 4
      if (opaqueOnly && s[si + 3] === 0) continue
      const di = (dy * dest.width + dx) * 4
      const sa = s[si + 3]
      if (sa === 255 || opaqueOnly) {
        d[di] = s[si]
        d[di + 1] = s[si + 1]
        d[di + 2] = s[si + 2]
        d[di + 3] = sa
        continue
      }
      if (sa === 0) continue
      const da = d[di + 3] / 255
      const a = sa / 255
      const outA = a + da * (1 - a)
      if (outA <= 0) continue
      d[di] = Math.round((s[si] * a + d[di] * da * (1 - a)) / outA)
      d[di + 1] = Math.round((s[si + 1] * a + d[di + 1] * da * (1 - a)) / outA)
      d[di + 2] = Math.round((s[si + 2] * a + d[di + 2] * da * (1 - a)) / outA)
      d[di + 3] = Math.round(outA * 255)
    }
  }
}

export function clearRect(dest: ImageData, left: number, top: number, w: number, h: number) {
  const d = dest.data
  const x0 = Math.max(0, left)
  const y0 = Math.max(0, top)
  const x1 = Math.min(dest.width, left + w)
  const y1 = Math.min(dest.height, top + h)
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * dest.width + x) * 4
      d[i] = 0
      d[i + 1] = 0
      d[i + 2] = 0
      d[i + 3] = 0
    }
  }
}

export function cloneImageData(src: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height)
}

export function snapBinaryAlpha(src: ImageData, threshold = 128): void {
  const d = src.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < threshold) {
      d[i] = 0
      d[i + 1] = 0
      d[i + 2] = 0
      d[i + 3] = 0
    } else {
      d[i + 3] = 255
    }
  }
}
