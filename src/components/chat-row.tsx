import { useEffect, useMemo, useRef, useState } from 'react'
import { getChatPreviewUrls } from '@/lib/preview-cache'
import { cropCacheKey } from '@/lib/crop'
import type { AssetKind, LibraryAsset, MessagePart, ScaleFilter } from '@/lib/types'
import { chatCssSize } from '@/lib/twitch-sizes'

const MOD_BADGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><rect width="18" height="18" rx="2" fill="#00ad03"/><path d="M4 12 L9 5 L14 12 Z" fill="white"/></svg>`,
  )
const VIP_BADGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><rect width="18" height="18" rx="2" fill="#e005b9"/><path d="M9 3 L11.5 8 L17 8.5 L12.8 12 L14 17 L9 14.2 L4 17 L5.2 12 L1 8.5 L6.5 8 Z" fill="white"/></svg>`,
  )
const SUB_BADGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><rect width="18" height="18" rx="2" fill="#9146ff"/><text x="9" y="13" text-anchor="middle" font-size="10" font-family="Arial,sans-serif" fill="white">★</text></svg>`,
  )

export function parseMessage(text: string): MessagePart[] {
  const parts: MessagePart[] = []
  const re = /\[emote:([^\]]+)\]/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ type: 'text', text: text.slice(last, m.index) })
    parts.push({ type: 'emote', assetId: m[1] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) })
  if (!parts.length) parts.push({ type: 'text', text })
  return parts
}

function previewKey(kind: AssetKind, id: string) {
  return `${kind}:${id}`
}

function useSharedChatUrls(
  items: { asset: LibraryAsset; kind: AssetKind }[],
  filter: ScaleFilter,
  animSync: string,
) {
  const signature = items
    .map((item) => `${previewKey(item.kind, item.asset.id)}:${cropCacheKey(item.asset.crop)}`)
    .join('|')
  const [urls, setUrls] = useState<Record<string, string[]>>({})

  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    let cancelled = false
    const list = itemsRef.current
    void (async () => {
      const next: Record<string, string[]> = {}
      await Promise.all(
        list.map(async ({ asset, kind }) => {
          next[previewKey(kind, asset.id)] = await getChatPreviewUrls(asset, kind, filter, animSync)
        }),
      )
      if (!cancelled) setUrls(next)
    })()
    return () => {
      cancelled = true
    }
  }, [signature, filter, animSync])

  return urls
}

function OfficialInlineImage({
  urls,
  densityKind,
  filter,
  className,
  title,
  alt,
}: {
  urls: string[] | undefined
  densityKind: AssetKind
  filter: ScaleFilter
  className: string
  title?: string
  alt: string
}) {
  const css = chatCssSize(densityKind)
  if (!urls?.length) {
    return <span className={className} style={{ display: 'inline-block', width: css, height: css }} />
  }
  const srcSet = urls.map((u, i) => `${u} ${i + 1}x`).join(', ')
  return (
    <img
      src={urls[0]}
      srcSet={srcSet}
      alt={alt}
      title={title}
      width={css}
      height={css}
      className={className}
      style={{
        width: css,
        height: css,
        imageRendering: filter === 'nearest' ? 'pixelated' : 'auto',
      }}
    />
  )
}

type Props = {
  theme: 'dark' | 'light'
  displayName: string
  nameColor: string
  message: string
  showMod: boolean
  showVip: boolean
  showSub: boolean
  customBadges: LibraryAsset[]
  assetsById: Map<string, LibraryAsset>
  filter: ScaleFilter
  animSync: string
}

export function ChatRow({
  theme,
  displayName,
  nameColor,
  message,
  showMod,
  showVip,
  showSub,
  customBadges,
  assetsById,
  filter,
  animSync,
}: Props) {
  const dark = theme === 'dark'
  const parts = parseMessage(message)
  const text = dark ? '#efeff1' : '#0e0e10'
  const unique = useMemo(() => {
    const seen = new Map<string, { asset: LibraryAsset; kind: AssetKind }>()
    for (const badge of customBadges) {
      seen.set(previewKey('badge', badge.id), { asset: badge, kind: 'badge' })
    }
    for (const part of parts) {
      if (part.type !== 'emote') continue
      const emote = assetsById.get(part.assetId)
      if (emote) seen.set(previewKey('emote', emote.id), { asset: emote, kind: 'emote' })
    }
    return [...seen.values()]
  }, [customBadges, message, assetsById])
  const urls = useSharedChatUrls(unique, filter, animSync)

  return (
    <div
      className="chat-line"
      data-theme={theme}
      style={{
        background: dark ? '#18181b' : '#ffffff',
        color: text,
        fontFamily: 'Inter, Roobert, "Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
    >
      {showMod ? (
        <img src={MOD_BADGE} alt="" title="モデレーター" width={18} height={18} className="tw-badge" />
      ) : null}
      {showVip ? <img src={VIP_BADGE} alt="" title="VIP" width={18} height={18} className="tw-badge" /> : null}
      {showSub ? (
        <img src={SUB_BADGE} alt="" title="サブスクライバー" width={18} height={18} className="tw-badge" />
      ) : null}
      {customBadges.map((b) => (
        <OfficialInlineImage
          key={b.id}
          urls={urls[previewKey('badge', b.id)]}
          densityKind="badge"
          filter={filter}
          className="tw-badge"
          title={b.name}
          alt=""
        />
      ))}
      <span className="tw-name" style={{ color: nameColor, fontWeight: 700 }}>
        {displayName}
      </span>
      <span style={{ color: text }}>: </span>
      <span>
        {parts.map((p, i) => {
          if (p.type === 'text') return <span key={i}>{p.text}</span>
          const emote = assetsById.get(p.assetId)
          if (!emote) return <span key={i}>[?]</span>
          return (
            <span key={`${i}-${emote.id}`} className="tw-emote-slot">
              <OfficialInlineImage
                urls={urls[previewKey('emote', emote.id)]}
                densityKind="emote"
                filter={filter}
                className="tw-emote"
                alt={emote.name}
              />
            </span>
          )
        })}
      </span>
    </div>
  )
}
