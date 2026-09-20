import { useEffect, useState } from 'react'
import { getCachedRaster } from '@/lib/preview-cache'
import { cropCacheKey } from '@/lib/crop'
import type { LibraryAsset, ScaleFilter } from '@/lib/types'
import { cn } from '@/lib/utils'

function PaletteTile({
  asset,
  filter,
  onPick,
}: {
  asset: LibraryAsset
  filter: ScaleFilter
  onPick: (id: string) => void
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let created: string | null = null
    void (async () => {
      const out = await getCachedRaster(asset, 56, filter)
      if (cancelled) return
      const copy = new Uint8Array(out.bytes.byteLength)
      copy.set(out.bytes)
      created = URL.createObjectURL(new Blob([copy.buffer], { type: out.mime }))
      setUrl(created)
    })()
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [asset.id, cropCacheKey(asset.crop), filter])

  const name = asset.name.replace(/\.[^.]+$/, '')

  return (
    <button
      type="button"
      title={name}
      onClick={() => onPick(asset.id)}
      className="flex size-9 items-center justify-center rounded-md hover:bg-white/10"
    >
      {url ? (
        <img
          src={url}
          alt={name}
          width={28}
          height={28}
          className="size-7"
          style={{ imageRendering: filter === 'nearest' ? 'pixelated' : 'auto' }}
        />
      ) : (
        <span className="size-7 rounded-sm bg-zinc-800" />
      )}
    </button>
  )
}

export function EmotePalette({
  emotes,
  filter,
  onPick,
  theme,
}: {
  emotes: LibraryAsset[]
  filter: ScaleFilter
  onPick: (id: string) => void
  theme: 'dark' | 'light'
}) {
  const dark = theme === 'dark'
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border',
        dark ? 'border-[#3a3a3d] bg-[#18181b]' : 'border-zinc-300 bg-white',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 border-b px-3 py-2 text-xs font-semibold',
          dark ? 'border-[#3a3a3d] text-zinc-200' : 'border-zinc-200 text-zinc-800',
        )}
      >
        <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden>
          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="7.2" cy="8.2" r="1" fill="currentColor" />
          <circle cx="12.8" cy="8.2" r="1" fill="currentColor" />
          <path d="M6.5 12c1.2 1.6 2.6 2.2 3.5 2.2S12.3 13.6 13.5 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        チャンネルのエモート
      </div>
      {emotes.length === 0 ? (
        <p className={cn('px-3 py-4 text-xs', dark ? 'text-zinc-500' : 'text-zinc-500')}>
          ライブラリでタイプを「エモート」にした画像がここに並びます。クリックでメッセージへ挿入します。
        </p>
      ) : (
        <div className="grid max-h-36 grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-0.5 overflow-auto p-2">
          {emotes.map((asset) => (
            <PaletteTile key={asset.id} asset={asset} filter={filter} onPick={onPick} />
          ))}
        </div>
      )}
    </div>
  )
}
