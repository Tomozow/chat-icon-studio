export type AssetKind = 'emote' | 'badge' | 'channel_point'

export const OFFICIAL_SIZES: Record<AssetKind, readonly number[]> = {
  emote: [28, 56, 112],
  badge: [18, 36, 72],
  channel_point: [28, 56, 112],
} as const

export const ALL_EXPORT_SIZES = [18, 28, 36, 56, 72, 112] as const

export const EXPORT_PRESETS: Record<AssetKind, readonly number[]> = {
  emote: [112],
  badge: [18, 36, 72],
  channel_point: [28, 56, 112],
}

export const KIND_LABEL: Record<AssetKind, string> = {
  emote: 'エモート',
  badge: 'バッジ',
  channel_point: 'チャンネルポイント',
}

export const SIZE_LIMITS = {
  badgeBytes: 25 * 1024,
  stillEmoteBytes: 100 * 1024,
  animatedGifBytes: 512 * 1024,
  animatedGifFrames: 60,
  channelPointBytes: 25 * 1024,
} as const

export function minOfficialSize(kind: AssetKind): number {
  return Math.min(...OFFICIAL_SIZES[kind])
}

export function chatCssSize(kind: AssetKind): number {
  return OFFICIAL_SIZES[kind][0]
}

export const TWITCH_PC_CHAT_WIDTH = 340
