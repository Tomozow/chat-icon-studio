import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AssetCropEditor } from '@/components/asset-crop-editor'
import { ChatOptionsMenu } from '@/components/chat-options-menu'
import { ChatRow } from '@/components/chat-row'
import { ChannelPointPreview } from '@/components/channel-point-preview'
import { EmotePalette } from '@/components/emote-palette'
import { LibraryThumb } from '@/components/library-thumb'
import { OfficialSizeStrip } from '@/components/official-size-strip'
import { exportOfficialImages } from '@/lib/export-assets'
import { githubInstallerUrl, githubReleasesUrl } from '@/lib/github-pages'
import { inspectImageBytes } from '@/lib/image-codec'
import { invalidateAssetCache } from '@/lib/preview-cache'
import {
  filesFromHtmlDrop,
  isTauriRuntime,
  listenNativeDrop,
  openImageDialog,
  readDroppedFile,
  saveExportedImages,
} from '@/lib/tauri-files'
import { defaultSquareCrop } from '@/lib/crop'
import type { AssetKind, LibraryAsset } from '@/lib/types'
import { ALL_EXPORT_SIZES, EXPORT_PRESETS, KIND_LABEL, TWITCH_PC_CHAT_WIDTH } from '@/lib/twitch-sizes'
import { cn, nextSerialId } from '@/lib/utils'

type ChatPosted = {
  id: string
  fromSelf: boolean
  displayName: string
  nameColor: string
  message: string
  showMod: boolean
  showVip: boolean
  showSub: boolean
  badgeIds: string[]
}

const SCALE_FILTER = 'lanczos' as const
const DEFAULT_NAME_COLOR = '#ff7f50'
const OTHER_VIEWER_COLOR = '#1e90ff'

function initialPosts(): ChatPosted[] {
  return [
    {
      id: 'seed-self',
      fromSelf: true,
      displayName: '配信者さん',
      nameColor: DEFAULT_NAME_COLOR,
      message: 'サイズ感どう？ この行が配信者のプレビューです',
      showMod: true,
      showVip: false,
      showSub: true,
      badgeIds: [],
    },
    {
      id: 'seed',
      fromSelf: false,
      displayName: '別の視聴者',
      nameColor: OTHER_VIEWER_COLOR,
      message: 'エモートいいね！',
      showMod: false,
      showVip: true,
      showSub: false,
      badgeIds: [],
    },
  ]
}

export default function App() {
  const [assets, setAssets] = useState<LibraryAsset[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [exportSizes, setExportSizes] = useState<number[]>([...EXPORT_PRESETS.emote])
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [pcChatWidth, setPcChatWidth] = useState(false)
  const [displayName, setDisplayName] = useState('配信者さん')
  const [draft, setDraft] = useState('')
  const [nameColor, setNameColor] = useState(DEFAULT_NAME_COLOR)
  const [showMod, setShowMod] = useState(true)
  const [showVip, setShowVip] = useState(false)
  const [showSub, setShowSub] = useState(true)
  const [enabledBadgeIds, setEnabledBadgeIds] = useState<string[]>([])
  const [posts, setPosts] = useState<ChatPosted[]>(initialPosts)
  const [isTauri, setIsTauri] = useState(false)
  const [htmlDropActive, setHtmlDropActive] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [exportNotes, setExportNotes] = useState<string[]>([])
  const [chatOptionsOpen, setChatOptionsOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const nextIdRef = useRef(1)

  const emoteAnimSync = useMemo(
    () => posts.map((p) => p.message).join('|'),
    [posts],
  )
  const installerUrl = useMemo(() => githubInstallerUrl(), [])
  const releasesUrl = useMemo(() => githubReleasesUrl(), [])
  const selected = assets.find((a) => a.id === selectedId) ?? null
  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])
  const customBadges = assets.filter((a) => a.kind === 'badge' && enabledBadgeIds.includes(a.id))
  const channelPoints = assets.filter((a) => a.kind === 'channel_point')

  useEffect(() => {
    if (!selectedId) return
    const asset = assets.find((a) => a.id === selectedId)
    if (asset) setExportSizes([...EXPORT_PRESETS[asset.kind]])
  }, [selectedId])

  useEffect(() => {
    void isTauriRuntime().then(setIsTauri)
  }, [])

  const addFiles = useCallback(async (items: { name: string; bytes: Uint8Array }[]) => {
    if (!items.length) return
    const next: LibraryAsset[] = []
    const skipped: string[] = []
    for (const item of items) {
      if (!/\.(png|gif|webp)$/i.test(item.name)) {
        skipped.push(item.name)
        continue
      }
      const kind: AssetKind = 'emote'
      const inspected = await inspectImageBytes(item.bytes, item.name, kind)
      const blob = new Blob([item.bytes.slice()], { type: inspected.mime })
      next.push({
        id: '',
        name: item.name,
        kind,
        objectUrl: URL.createObjectURL(blob),
        ...inspected,
      })
    }
    const skipNote = skipped.length
      ? `${skipped.join('、')} は png / gif / webp ではないためスキップしました。`
      : ''
    if (!next.length) {
      setStatus(skipNote || 'png / gif / webp のみ追加できます。')
      return
    }
    let firstId = ''
    setAssets((prev) => {
      let n = Math.max(nextIdRef.current, nextSerialId(prev))
      const numbered = next.map((a) => {
        const id = String(n++)
        if (!firstId) firstId = id
        return { ...a, id }
      })
      nextIdRef.current = n
      return [...prev, ...numbered]
    })
    setSelectedId((cur) => cur ?? firstId)
    setStatus(
      `${next.length}件をライブラリに追加しました（セッションのみ）。${skipNote ? ` ${skipNote}` : ''}`,
    )
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    void (async () => {
      if (!(await isTauriRuntime())) return
      unlisten = await listenNativeDrop(async (paths) => {
        const items = await Promise.all(paths.map((p) => readDroppedFile(p)))
        await addFiles(items)
      })
    })()
    return () => {
      unlisten?.()
    }
  }, [addFiles])

  useEffect(() => {
    if (isTauri) return
    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      setHtmlDropActive(true)
    }
    const onDragLeave = () => setHtmlDropActive(false)
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      setHtmlDropActive(false)
      if (e.dataTransfer) void filesFromHtmlDrop(e.dataTransfer).then(addFiles)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [isTauri, addFiles])

  async function changeKind(id: string, kind: AssetKind) {
    const current = assets.find((a) => a.id === id)
    if (!current) return
    const inspected = await inspectImageBytes(current.bytes, current.name, kind)
    invalidateAssetCache(id)
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, kind, sourceWarnings: inspected.sourceWarnings } : a)),
    )
    if (kind === 'badge') {
      setEnabledBadgeIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
    }
    if (id === selectedId) setExportSizes([...EXPORT_PRESETS[kind]])
  }

  function removeAsset(id: string) {
    setAssets((prev) => {
      const hit = prev.find((a) => a.id === id)
      if (hit) URL.revokeObjectURL(hit.objectUrl)
      return prev.filter((a) => a.id !== id)
    })
    setEnabledBadgeIds((ids) => ids.filter((x) => x !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
    invalidateAssetCache(id)
    const token = `[emote:${id}]`
    setDraft((m) => m.split(token).join(''))
    setPosts((prev) => prev.map((p) => ({ ...p, message: p.message.split(token).join('') })))
  }

  function insertEmote(id: string) {
    const token = `[emote:${id}]`
    const el = messageRef.current
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart
      const end = el.selectionEnd ?? start
      const next = draft.slice(0, start) + token + draft.slice(end)
      setDraft(next)
      requestAnimationFrame(() => {
        el.focus()
        const pos = start + token.length
        el.setSelectionRange(pos, pos)
      })
    } else {
      setDraft((m) => m + token)
    }
    setSelectedId(id)
  }

  function sendChat() {
    const text = draft
    if (!text.trim()) return
    setPosts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        fromSelf: true,
        displayName,
        nameColor,
        message: text,
        showMod,
        showVip,
        showSub,
        badgeIds: [...enabledBadgeIds],
      },
    ])
    setDraft('')
  }

  function clearChat() {
    setPosts([])
    setStatus('チャット欄を空にしました。')
  }

  useEffect(() => {
    const el = logRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [posts.length])

  async function onExport() {
    if (!selected || exporting) {
      setStatus(selected ? '書き出し中です。' : '書き出す素材を選択してください。')
      return
    }
    const sizes = [...exportSizes].sort((a, b) => a - b)
    if (!sizes.length) {
      setStatus('書き出すサイズを選んでください。')
      return
    }
    setExporting(true)
    setStatus('書き出し中…')
    try {
      const result = await exportOfficialImages(selected, SCALE_FILTER, sizes)
      setExportNotes([...result.notes, ...result.files.flatMap((f) => f.warnings.map((w) => `${f.fileName}: ${w}`))])
      const saved = await saveExportedImages(result.files)
      const names = saved.written.join('、')
      if (saved.mode === 'cancelled') {
        setStatus('保存をキャンセルしました。')
      } else if (saved.mode === 'native') {
        setStatus(`保存しました: ${names}`)
      } else {
        setStatus(
          `ブラウザダウンロード: ${names}（Windowsのネイティブ保存は Tauri ビルドが必要です）`,
        )
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '書き出しに失敗しました。')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex h-svh min-w-[500px] flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      {!isTauri && (installerUrl || releasesUrl) ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2 text-xs">
          <p className="text-zinc-400">ブラウザ版です。ウィンドウへのドロップと保存ダイアログは Windows アプリが必要です。未署名のため SmartScreen が出ることがあります。</p>
          <a
            href={installerUrl ?? releasesUrl ?? '#'}
            className="inline-flex h-8 shrink-0 items-center rounded-md bg-violet-600 px-3 font-medium text-white hover:bg-violet-500"
          >
            Windows版を入手
          </a>
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[280px_1fr_320px] lg:overflow-hidden">
        <Card className="flex flex-col p-3 lg:min-h-0 lg:overflow-hidden">
          <h2 className="mb-2 text-sm font-semibold">ライブラリ</h2>
          <button
            type="button"
            onClick={() => void openImageDialog().then(addFiles)}
            className={cn(
              'mb-2 w-full rounded-md border border-dashed px-3 py-4 text-center text-xs text-zinc-400 transition-colors',
              htmlDropActive
                ? 'border-violet-400 bg-violet-500/10 text-zinc-200'
                : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300',
            )}
          >
            ドロップ、またはクリックして png / gif / webp を追加
          </button>
          {assets.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center gap-2 px-1 text-sm text-zinc-400">
              <p>まだ素材がありません。</p>
              <p>
                ファイルは<strong className="text-zinc-200">セッション中のみ</strong>保持されます。リロードすると消えます。サーバーへはアップロードしません。
              </p>
            </div>
          ) : (
            <ul className="space-y-2 pr-1 lg:min-h-0 lg:flex-1 lg:overflow-auto">
              {assets.map((a) => (
                <li
                  key={a.id}
                  className={cn(
                    'flex flex-col gap-2 rounded-md border p-2',
                    selectedId === a.id ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-800',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className="flex min-w-0 items-center gap-2 text-left text-xs"
                  >
                    <span
                      className="size-10 shrink-0 rounded-sm border border-zinc-700"
                      style={checkerStyle}
                    >
                      <LibraryThumb asset={a} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.name}</span>
                      <span className="mt-1 block text-zinc-500">
                        {a.width}×{a.height}
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    <select
                      aria-label="タイプ"
                      value={a.kind}
                      className="h-8 min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-1 text-[11px]"
                      onChange={(e) => void changeKind(a.id, e.target.value as AssetKind)}
                    >
                      {(Object.keys(KIND_LABEL) as AssetKind[]).map((k) => (
                        <option key={k} value={k}>
                          {KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="ghost" onClick={() => removeAsset(a.id)} aria-label="削除">
                      ×
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-auto">
          {selected ? (
            <Card className="shrink-0 p-3">
              <h2 className="mb-2 text-sm font-semibold">トリミング</h2>
              <Button
                size="sm"
                variant={selected.crop ? 'default' : 'outline'}
                onClick={() =>
                  setAssets((prev) =>
                    prev.map((a) =>
                      a.id === selected.id
                        ? { ...a, crop: a.crop ? null : defaultSquareCrop(a.width, a.height) }
                        : a,
                    ),
                  )
                }
              >
                {selected.crop ? 'トリミング解除' : 'トリミング'}
              </Button>
              {selected.crop ? (
                <div className="mt-2">
                  <AssetCropEditor
                    asset={selected}
                    onChange={(crop) =>
                      setAssets((prev) => prev.map((a) => (a.id === selected.id ? { ...a, crop } : a)))
                    }
                  />
                </div>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">選択中の画像の切り抜き位置を指定します。</p>
              )}
            </Card>
          ) : null}

          <Card className="flex min-h-[20rem] flex-col p-3 lg:flex-1 lg:overflow-hidden">
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <h2 className="text-sm font-semibold">チャット行プレビュー</h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="flex w-fit items-center gap-2 text-xs">
                  <span>ダーク</span>
                  <Switch
                    checked={theme === 'light'}
                    onCheckedChange={(c) => setTheme(c ? 'light' : 'dark')}
                  />
                  <span>ライト</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={clearChat} disabled={posts.length === 0}>
                  チャットのクリア
                </Button>
                <ChatOptionsMenu
                  open={chatOptionsOpen}
                  onOpenChange={setChatOptionsOpen}
                  displayName={displayName}
                  onDisplayNameChange={setDisplayName}
                  nameColor={nameColor}
                  onNameColorChange={setNameColor}
                  showMod={showMod}
                  onShowModChange={setShowMod}
                  showVip={showVip}
                  onShowVipChange={setShowVip}
                  showSub={showSub}
                  onShowSubChange={setShowSub}
                  badges={assets.filter((a) => a.kind === 'badge')}
                  enabledBadgeIds={enabledBadgeIds}
                  onEnabledBadgeIdsChange={setEnabledBadgeIds}
                  pcChatWidth={pcChatWidth}
                  onPcChatWidthChange={setPcChatWidth}
                />
              </div>
            </div>
            <div
              ref={logRef}
              className="min-h-[6.5rem] max-w-full flex-1 overflow-auto rounded-md border"
              style={{
                width: pcChatWidth ? TWITCH_PC_CHAT_WIDTH : undefined,
                background: theme === 'dark' ? '#18181b' : '#ffffff',
                borderColor: theme === 'dark' ? '#3f3f46' : '#d4d4d8',
              }}
            >
              {posts.length === 0 ? (
                <p
                  className="px-3 py-4 text-sm"
                  style={{ color: theme === 'dark' ? '#a1a1aa' : '#71717a' }}
                >
                  まだメッセージがありません。下の欄から送信すると、表示オプションが効く配信者の行として並びます。
                </p>
              ) : (
                posts.map((post) => (
                  <ChatRow
                    key={post.id}
                    theme={theme}
                    displayName={post.fromSelf ? displayName : post.displayName}
                    nameColor={post.fromSelf ? nameColor : post.nameColor}
                    message={post.message}
                    showMod={post.fromSelf ? showMod : post.showMod}
                    showVip={post.fromSelf ? showVip : post.showVip}
                    showSub={post.fromSelf ? showSub : post.showSub}
                    customBadges={
                      post.fromSelf
                        ? customBadges
                        : assets.filter((a) => a.kind === 'badge' && post.badgeIds.includes(a.id))
                    }
                    assetsById={assetsById}
                    filter={SCALE_FILTER}
                    animSync={emoteAnimSync}
                  />
                ))
              )}
            </div>
            <div className="mt-3 grid shrink-0 gap-2">
              <div className="flex items-end gap-2">
                <textarea
                  id="msg"
                  ref={messageRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendChat()
                    }
                  }}
                  rows={1}
                  placeholder="メッセージを送信"
                  className="min-h-9 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-600"
                />
                <Button disabled={!draft.trim()} onClick={sendChat}>
                  チャット
                </Button>
              </div>
              <EmotePalette
                emotes={assets.filter((a) => a.kind === 'emote')}
                filter={SCALE_FILTER}
                onPick={insertEmote}
                theme={theme}
              />
            </div>
          </Card>

          {channelPoints.length ? (
            <Card className="shrink-0 p-3">
              <ChannelPointPreview assets={channelPoints} selectedId={selectedId} onSelect={setSelectedId} />
            </Card>
          ) : null}

        </div>

        <Card className="flex flex-col gap-3 p-3 lg:min-h-0 lg:overflow-auto">
          <h2 className="text-sm font-semibold">書き出し</h2>
          {selected ? (
            <>
              <div>
                <Label>プリセット</Label>
                <div className="mt-1 grid grid-cols-1 gap-1">
                  {(Object.keys(KIND_LABEL) as AssetKind[]).map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant={selected.kind === k ? 'default' : 'outline'}
                      onClick={() => {
                        setExportSizes([...EXPORT_PRESETS[k]])
                        void changeKind(selected.id, k)
                      }}
                    >
                      {KIND_LABEL[k]}
                      <span className="font-normal text-zinc-300">
                        （{EXPORT_PRESETS[k].map((s) => `${s}px`).join('・')}）
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>サイズ</Label>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  {ALL_EXPORT_SIZES.map((size) => {
                    const on = exportSizes.includes(size)
                    return (
                      <Button
                        key={size}
                        size="sm"
                        variant={on ? 'default' : 'outline'}
                        onClick={() =>
                          setExportSizes((prev) =>
                            on ? prev.filter((s) => s !== size) : [...prev, size].sort((a, b) => a - b),
                          )
                        }
                      >
                        {size}×{size}
                      </Button>
                    )
                  })}
                </div>
              </div>
              {selected.kind === 'channel_point' ? (
                <p className="rounded-md bg-zinc-800 px-2 py-2 text-xs leading-relaxed text-zinc-200">
                  通貨アイコンは3サイズ／個別リワードは112を使う
                </p>
              ) : null}
              {selected.sourceWarnings.filter((w) => !w.startsWith('元ファイル:')).length ? (
                <ul className="list-disc space-y-1 pl-4 text-xs text-amber-300">
                  {selected.sourceWarnings
                    .filter((w) => !w.startsWith('元ファイル:'))
                    .map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
              <div>
                <Label>書き出す画像</Label>
                <div className="mt-2 max-h-64 overflow-auto rounded-md border border-zinc-800 bg-zinc-950/50 p-2">
                  {exportSizes.length ? (
                    <OfficialSizeStrip
                      asset={selected}
                      sizes={exportSizes}
                      filter={SCALE_FILTER}
                      checkerStyle={checkerStyle}
                    />
                  ) : (
                    <p className="text-xs text-zinc-500">サイズを選ぶとプレビューします。</p>
                  )}
                </div>
              </div>
              <Button onClick={() => void onExport()} disabled={exporting || exportSizes.length === 0}>
                {exporting ? '書き出し中…' : '選択したサイズで書き出し'}
              </Button>
            </>
          ) : (
            <p className="text-sm text-zinc-500">ライブラリから素材を選択してください。</p>
          )}
          {status ? <p className="text-xs text-violet-300">{status}</p> : null}
          {exportNotes.length ? (
            <ul className="list-disc space-y-1 pl-4 text-xs text-amber-200">
              {exportNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>
    </div>
  )
}

const checkerStyle: CSSProperties = {
  backgroundColor: '#fff',
  backgroundImage:
    'linear-gradient(45deg, #cfcfcf 25%, transparent 25%), linear-gradient(-45deg, #cfcfcf 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cfcfcf 75%), linear-gradient(-45deg, transparent 75%, #cfcfcf 75%)',
  backgroundSize: '8px 8px',
  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
}
