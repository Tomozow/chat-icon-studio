import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function nextSerialId(existing: { id: string }[]): number {
  let max = 0
  for (const item of existing) {
    if (/^\d+$/.test(item.id)) max = Math.max(max, Number(item.id))
  }
  return max + 1
}

export function sanitizeFileStem(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '')
  const cleaned = stem.replace(/[^\w.\-一-龠ぁ-ゔァ-ヴー々〆〤]+/g, '_').replace(/^_+|_+$/g, '')
  return cleaned || 'asset'
}
