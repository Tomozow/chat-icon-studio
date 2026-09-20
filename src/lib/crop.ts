import type { CropSquare } from './types'

export function defaultSquareCrop(width: number, height: number): CropSquare {
  const size = Math.max(1, Math.min(width, height))
  return {
    x: Math.round((width - size) / 2),
    y: Math.round((height - size) / 2),
    size,
  }
}

export function clampCrop(crop: CropSquare, width: number, height: number): CropSquare {
  const size = Math.max(1, Math.min(Math.round(crop.size), width, height))
  const x = Math.max(0, Math.min(width - size, Math.round(crop.x)))
  const y = Math.max(0, Math.min(height - size, Math.round(crop.y)))
  return { x, y, size }
}

export function cropCacheKey(crop: CropSquare | null): string {
  return crop ? `${crop.x},${crop.y},${crop.size}` : 'full'
}
