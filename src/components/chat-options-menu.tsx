import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ColorPicker } from '@/components/color-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { LibraryAsset } from '@/lib/types'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  displayName: string
  onDisplayNameChange: (name: string) => void
  nameColor: string
  onNameColorChange: (color: string) => void
  showMod: boolean
  onShowModChange: (on: boolean) => void
  showVip: boolean
  onShowVipChange: (on: boolean) => void
  showSub: boolean
  onShowSubChange: (on: boolean) => void
  badges: LibraryAsset[]
  enabledBadgeIds: string[]
  onEnabledBadgeIdsChange: (ids: string[]) => void
  pcChatWidth: boolean
  onPcChatWidthChange: (on: boolean) => void
}

const GAP = 8
const MARGIN = 8

export function ChatOptionsMenu({
  open,
  onOpenChange,
  displayName,
  onDisplayNameChange,
  nameColor,
  onNameColorChange,
  showMod,
  onShowModChange,
  showVip,
  onShowVipChange,
  showSub,
  onShowSubChange,
  badges,
  enabledBadgeIds,
  onEnabledBadgeIdsChange,
  pcChatWidth,
  onPcChatWidthChange,
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [place, setPlace] = useState({ top: 0, right: 0, maxHeight: 360, openUp: false })

  useLayoutEffect(() => {
    if (!open) return
    function update() {
      const el = btnRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const spaceBelow = window.innerHeight - r.bottom - MARGIN
      const spaceAbove = r.top - MARGIN
      const openUp = spaceBelow < 280 && spaceAbove > spaceBelow
      const maxHeight = Math.max(160, openUp ? spaceAbove - GAP : spaceBelow - GAP)
      setPlace({
        top: openUp ? r.top : r.bottom + GAP,
        right: Math.max(MARGIN, window.innerWidth - r.right),
        maxHeight,
        openUp,
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, badges.length])

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-label="表示オプション"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={cn(
          'inline-flex size-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
          open && 'bg-zinc-800 text-zinc-100',
        )}
      >
        <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
          <path
            fill="currentColor"
            d="M8.2 2.4h3.6l.4 1.6c.4.1.8.3 1.2.5l1.5-.8 1.8 1.8-.8 1.5c.2.4.4.8.5 1.2l1.6.4v3.6l-1.6.4c-.1.4-.3.8-.5 1.2l.8 1.5-1.8 1.8-1.5-.8c-.4.2-.8.4-1.2.5l-.4 1.6H8.2l-.4-1.6c-.4-.1-.8-.3-1.2-.5l-1.5.8-1.8-1.8.8-1.5c-.2-.4-.4-.8-.5-1.2L2 11.8V8.2l1.6-.4c.1-.4.3-.8.5-1.2l-.8-1.5 1.8-1.8 1.5.8c.4-.2.8-.4 1.2-.5l.4-1.6ZM10 12.2A2.2 2.2 0 1 0 10 7.8a2.2 2.2 0 0 0 0 4.4Z"
          />
        </svg>
      </button>
      {open
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="閉じる"
                className="fixed inset-0 z-40 bg-black/50"
                onClick={() => onOpenChange(false)}
              />
              <div
                className="fixed z-50 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-zinc-100 shadow-2xl"
                style={{
                  top: place.openUp ? undefined : place.top,
                  bottom: place.openUp ? window.innerHeight - place.top + GAP : undefined,
                  right: place.right,
                  maxHeight: place.maxHeight,
                }}
              >
                <p className="mb-3 text-xs font-semibold text-zinc-300">表示オプション</p>
                <label className="mb-3 flex items-center gap-2 text-sm">
                  <Switch checked={pcChatWidth} onCheckedChange={onPcChatWidthChange} /> Twitch PC幅（340px）
                </label>
                <div>
                  <Label htmlFor="dn">表示名</Label>
                  <Input id="dn" value={displayName} onChange={(e) => onDisplayNameChange(e.target.value)} />
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <Switch checked={showMod} onCheckedChange={onShowModChange} /> モデレーター
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch checked={showVip} onCheckedChange={onShowVipChange} /> VIP
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch checked={showSub} onCheckedChange={onShowSubChange} /> サブスク
                  </label>
                </div>
                {badges.length ? (
                  <div className="mt-3 space-y-1 text-xs">
                    <p className="text-zinc-400">カスタムバッジ</p>
                    {badges.map((a) => (
                      <label key={a.id} className="flex items-center gap-2">
                        <Switch
                          checked={enabledBadgeIds.includes(a.id)}
                          onCheckedChange={(on) =>
                            onEnabledBadgeIdsChange(
                              on ? [...enabledBadgeIds, a.id] : enabledBadgeIds.filter((x) => x !== a.id),
                            )
                          }
                        />
                        <span className="truncate">{a.name}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3">
                  <Label>名前の色</Label>
                  <div className="mt-1">
                    <ColorPicker value={nameColor} onChange={onNameColorChange} />
                  </div>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  )
}
