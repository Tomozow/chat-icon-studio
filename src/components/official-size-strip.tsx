import { useEffect, useState, type CSSProperties } from 'react'
import { getCachedRaster } from '@/lib/preview-cache'
import { cropCacheKey } from '@/lib/crop'
import type { LibraryAsset, ScaleFilter } from '@/lib/types'

type Props = {
  asset: LibraryAsset
  sizes: readonly number[]
  filter: ScaleFilter
  checkerStyle: CSSProperties
}

export function OfficialSizeStrip({ asset, sizes, filter, checkerStyle }: Props) {
  const [urls, setUrls] = useState<Record<number, string>>({})
  const ordered = [...sizes].sort((a, b) => a - b)

  useEffect(() => {
    let cancelled = false
    const created: string[] = []
    void (async () => {
      const next: Record<number, string> = {}
      for (const size of ordered) {
        const out = await getCachedRaster(asset, size, filter)
        if (cancelled) return
        const copy = new Uint8Array(out.bytes.byteLength)
        copy.set(out.bytes)
        const url = URL.createObjectURL(new Blob([copy.buffer], { type: out.mime }))
        created.push(url)
        next[size] = url
      }
      if (!cancelled) setUrls(next)
    })()
    return () => {
      cancelled = true
      for (const u of created) URL.revokeObjectURL(u)
    }
  }, [asset, cropCacheKey(asset.crop), filter, ordered.join(',')])

  const rendering = filter === 'nearest' ? 'pixelated' : 'auto'

  return (
    <div className="flex flex-wrap items-end gap-3">
      {ordered.map((size) => (
        <div key={size} className="flex flex-col items-center gap-1">
          <div
            style={{
              ...checkerStyle,
              width: size,
              height: size,
              border: '1px solid #3f3f46',
            }}
          >
            {urls[size] ? (
              <img
                src={urls[size]}
                alt={`${size}ピクセル`}
                width={size}
                height={size}
                style={{ width: size, height: size, display: 'block', imageRendering: rendering }}
              />
            ) : (
              <div style={{ width: size, height: size }} />
            )}
          </div>
          <span className="text-[10px] text-zinc-400">
            {size}×{size} px
          </span>
        </div>
      ))}
    </div>
  )
}
