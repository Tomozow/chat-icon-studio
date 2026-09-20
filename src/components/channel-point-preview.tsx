import { useEffect, useMemo, useState } from 'react'
import { ColorPicker } from '@/components/color-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getCachedRaster } from '@/lib/preview-cache'
import { cropCacheKey } from '@/lib/crop'
import type { LibraryAsset } from '@/lib/types'
import { cn } from '@/lib/utils'

type RewardMeta = {
  title: string
  description: string
  cost: number
  color: string
}

const TILE_COLORS = ['#b7e07a', '#b39ddb', '#c8e6a0', '#ffe082', '#ef9a9a', '#ff8a65', '#f48fb1', '#ce93d8', '#90caf9']

function Coin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="9" fill="#efaf2c" />
    </svg>
  )
}

function RewardIcon({ asset, size }: { asset: LibraryAsset; size: number }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    let created: string | null = null
    void (async () => {
      const out = await getCachedRaster(asset, 112, 'lanczos')
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
  }, [asset.id, asset.kind, cropCacheKey(asset.crop)])
  if (!url) return <div style={{ width: size, height: size }} />
  return <img src={url} alt="" width={size} height={size} style={{ width: size, height: size, display: 'block' }} />
}

export function ChannelPointPreview({
  assets,
  selectedId,
  onSelect,
}: {
  assets: LibraryAsset[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [meta, setMeta] = useState<Record<string, RewardMeta>>({})
  const [detailId, setDetailId] = useState<string | null>(null)
  const [fillWidth, setFillWidth] = useState(true)

  const resolved = useMemo(() => {
    return assets.map((asset, i) => {
      const fallback: RewardMeta = {
        title: `サンプル${i + 1}`,
        description: `サンプル${i + 1}をチャンネルポイントで交換する`,
        cost: 50,
        color: TILE_COLORS[i % TILE_COLORS.length],
      }
      return { asset, meta: meta[asset.id] ?? fallback }
    })
  }, [assets, meta])

  const detail = resolved.find((row) => row.asset.id === detailId) ?? null

  function patch(id: string, current: RewardMeta, next: Partial<RewardMeta>) {
    setMeta((prev) => ({ ...prev, [id]: { ...current, ...next } }))
  }

  if (detail) {
    const { asset, meta: m } = detail
    return (
      <div className="flex min-h-[280px] flex-col">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            className="text-sm text-zinc-300 hover:text-white"
            onClick={() => setDetailId(null)}
          >
            ← {m.title}
          </button>
        </div>
        <div className="mb-4 flex w-[295px] max-w-full flex-col items-center gap-5">
          <p className="px-2 text-center text-sm leading-relaxed text-zinc-300">{m.description}</p>
          <div
            className="flex size-[93px] items-center justify-center rounded-lg"
            style={{ background: m.color }}
          >
            <RewardIcon asset={asset} size={28} />
          </div>
          <button
            type="button"
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-violet-600 text-sm font-semibold text-white"
          >
            交換
            <Coin className="size-5" />
            {m.cost}
          </button>
        </div>
        <div className="mb-4">
          <Label>タイル色</Label>
          <div className="mt-1">
            <ColorPicker value={m.color} onChange={(color) => patch(asset.id, m, { color })} />
          </div>
        </div>
        <details className="mt-auto rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2">
          <summary className="cursor-pointer select-none text-sm text-zinc-400">タイトル・コスト・説明</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="cp-title">タイトル</Label>
              <Input id="cp-title" value={m.title} onChange={(e) => patch(asset.id, m, { title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cp-cost">コスト</Label>
              <Input
                id="cp-cost"
                type="number"
                min={1}
                value={m.cost}
                onChange={(e) => patch(asset.id, m, { cost: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="mt-2">
            <Label htmlFor="cp-desc">説明</Label>
            <textarea
              id="cp-desc"
              value={m.description}
              onChange={(e) => patch(asset.id, m, { description: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-600"
            />
          </div>
        </details>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">チャンネルポイント</h2>
        <div className="flex w-fit items-center gap-2 text-xs">
          <span>3列</span>
          <Switch checked={fillWidth} onCheckedChange={setFillWidth} />
          <span>自動</span>
        </div>
      </div>
      <div className={fillWidth ? 'w-full' : 'w-[295px] max-w-full'}>
        <div
          className={
            fillWidth ? 'grid grid-cols-[repeat(auto-fill,93px)] justify-start gap-2' : 'grid grid-cols-3 gap-2'
          }
        >
          {resolved.map(({ asset, meta: m }) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => {
                onSelect(asset.id)
                setDetailId(asset.id)
              }}
              className="flex w-[93px] flex-col items-center text-center"
            >
              <span
                className={cn(
                  'relative flex size-[93px] items-center justify-center rounded-lg',
                  selectedId === asset.id ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-zinc-900' : '',
                )}
                style={{ background: m.color }}
              >
                <RewardIcon asset={asset} size={28} />
                <span className="absolute bottom-1 left-1/2 flex h-5 -translate-x-1/2 items-center gap-0.5 rounded-full bg-black/40 px-1 text-[10px] font-semibold text-white">
                  <Coin className="size-3" />
                  {m.cost}
                </span>
              </span>
              <span className="mt-1 line-clamp-2 text-center text-xs leading-snug text-zinc-200">{m.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
