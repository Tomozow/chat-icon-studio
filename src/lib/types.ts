export type AssetKind = 'emote' | 'badge' | 'channel_point'

export type LibraryAsset = {
  id: string
  name: string
  kind: AssetKind
  bytes: Uint8Array
  mime: string
  objectUrl: string
  width: number
  height: number
  isGif: boolean
  isAnimatedGif: boolean
  isWebp: boolean
  isAnimatedWebp: boolean
  frameCount: number
  sourceWarnings: string[]
  crop: CropSquare | null
}

export type FitMode = 'contain' | 'cover'

export type CropSquare = { x: number; y: number; size: number }

export type ScaleFilter = 'nearest' | 'area' | 'lanczos'

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'emote'; assetId: string }
