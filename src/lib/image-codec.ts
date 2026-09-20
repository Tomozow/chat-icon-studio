import { parseGIF, decompressFrames } from 'gifuct-js'
import { GIFEncoder, quantize } from 'gifenc'
import { indexRgbaWithPalette, uniqueRgbPalette, withTransparentSlot } from './gif-palette'
import { blitImageData, clearRect, cloneImageData, isIdentityFit, placeOnSquare, snapBinaryAlpha } from './resample'
import type { AssetKind, CropSquare, LibraryAsset, ScaleFilter } from './types'
import { minOfficialSize, SIZE_LIMITS } from './twitch-sizes'

function toAb(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function sniff(bytes: Uint8Array): { isGif: boolean; isWebp: boolean; isPng: boolean } {
  const isGif = bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  return { isGif, isWebp, isPng }
}

function isAnimatedWebp(bytes: Uint8Array): boolean {
  const { isWebp } = sniff(bytes)
  if (!isWebp) return false
  const text = new TextDecoder('latin1').decode(bytes)
  return text.includes('ANIM')
}

export async function inspectImageBytes(
  bytes: Uint8Array,
  _fileName: string,
  kind: AssetKind,
): Promise<Omit<LibraryAsset, 'id' | 'kind' | 'objectUrl' | 'name'>> {
  const { isGif, isWebp } = sniff(bytes)
  let frameCount = 1
  let isAnimatedGif = false
  const isAnimWebp = isAnimatedWebp(bytes)
  const sourceWarnings: string[] = []

  if (isGif) {
    try {
      const gif = parseGIF(toAb(bytes))
      const frames = decompressFrames(gif, true)
      frameCount = frames.length
      isAnimatedGif = frames.length > 1
    } catch {
      sourceWarnings.push('GIFの解析に失敗したため、静止画として扱います。')
    }
  }

  const blob = new Blob([toAb(bytes)], {
    type: isGif ? 'image/gif' : isWebp ? 'image/webp' : 'image/png',
  })
  const bitmap = await createImageBitmap(blob)
  const width = bitmap.width
  const height = bitmap.height
  bitmap.close()

  if (Math.min(width, height) < minOfficialSize(kind)) {
    sourceWarnings.push(
      `元画像（${width}×${height}）が最小公式サイズ（${minOfficialSize(kind)}px）より小さいため、拡大されます。`,
    )
  }
  if (isAnimWebp) {
    sourceWarnings.push('アニメーションWebPは先頭フレームの静止画として扱います。')
  }
  if (isGif && isAnimatedGif && kind !== 'emote') {
    sourceWarnings.push(
      kind === 'badge'
        ? 'バッジのGIFは先頭フレームのPNGに変換されます。'
        : 'チャンネルポイントのGIFは先頭フレームのPNGに変換されます。',
    )
  }
  if (isGif && isAnimatedGif && kind === 'emote' && frameCount > SIZE_LIMITS.animatedGifFrames) {
    sourceWarnings.push(`フレーム数が${frameCount}です（目安は${SIZE_LIMITS.animatedGifFrames}以下）。`)
  }

  const mime = isGif ? 'image/gif' : isWebp ? 'image/webp' : 'image/png'
  return {
    bytes,
    mime,
    width,
    height,
    isGif,
    isAnimatedGif,
    isWebp,
    isAnimatedWebp: isAnimWebp,
    frameCount,
    sourceWarnings,
    crop: null,
  }
}

export function shouldExportAnimatedGif(asset: LibraryAsset): boolean {
  return asset.kind === 'emote' && asset.isGif && asset.isAnimatedGif
}

async function imageDataFromBytes(bytes: Uint8Array, mime: string): Promise<ImageData> {
  const blob = new Blob([toAb(bytes)], { type: mime })
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('キャンバスを初期化できませんでした。')
  }
  ctx.drawImage(bitmap, 0, 0)
  const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  bitmap.close()
  return data
}

function pngFromImageData(data: ImageData): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = data.width
  canvas.height = data.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('キャンバスを初期化できませんでした。')
  ctx.putImageData(data, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) {
        reject(new Error('PNG書き出しに失敗しました。'))
        return
      }
      void b.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)))
    }, 'image/png')
  })
}

export async function rasterizeStill(
  bytes: Uint8Array,
  mime: string,
  size: number,
  crop: CropSquare | null,
  filter: ScaleFilter,
): Promise<Uint8Array> {
  const src = await imageDataFromBytes(bytes, mime)
  const square = placeOnSquare(src, size, filter, crop)
  return pngFromImageData(square)
}

export async function firstFramePng(bytes: Uint8Array, mime: string): Promise<Uint8Array> {
  const src = await imageDataFromBytes(bytes, mime)
  return pngFromImageData(src)
}

export async function rasterizeAnimatedGif(
  bytes: Uint8Array,
  size: number,
  crop: CropSquare | null,
  filter: ScaleFilter,
): Promise<{ data: Uint8Array; frameCount: number } | { error: string }> {
  try {
    const gif = parseGIF(toAb(bytes))
    const frames = decompressFrames(gif, true)
    if (!frames.length) {
      return { error: 'GIFにフレームがありません。先頭フレームのPNGにフォールバックします。' }
    }
    const srcW = gif.lsd.width
    const srcH = gif.lsd.height
    if (isIdentityFit(srcW, srcH, size, crop)) {
      return { data: new Uint8Array(bytes), frameCount: frames.length }
    }

    const encoder = GIFEncoder()
    const full = new ImageData(srcW, srcH)
    const sourcePalette = uniqueRgbPalette([gif.gct ?? [], ...frames.map((f) => f.colorTable ?? [])])
    let previous: ImageData | null = null
    const composed: ImageData[] = []
    const delays: number[] = []

    for (const frame of frames) {
      const disposal = frame.disposalType ?? 0
      if (disposal === 3) {
        previous = cloneImageData(full)
      }
      const patch = new ImageData(
        new Uint8ClampedArray(frame.patch),
        frame.dims.width,
        frame.dims.height,
      )
      blitImageData(full, patch, frame.dims.left, frame.dims.top, true)
      const square = placeOnSquare(full, size, filter, crop)
      snapBinaryAlpha(square)
      composed.push(square)
      delays.push(Math.max(2, frame.delay || 10))
      if (disposal === 2) {
        clearRect(full, frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height)
      } else if (disposal === 3 && previous) {
        full.data.set(previous.data)
      }
    }

    const { palette, transparentIndex } = buildGifPalette(sourcePalette, composed, filter)

    for (let i = 0; i < composed.length; i++) {
      const index = indexRgbaWithPalette(composed[i].data, palette, transparentIndex)
      encoder.writeFrame(index, size, size, {
        palette,
        delay: delays[i],
        repeat: i === 0 ? 0 : undefined,
        dispose: 2,
        transparent: true,
        transparentIndex,
      })
    }
    encoder.finish()
    return { data: encoder.bytes(), frameCount: frames.length }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return { error: `GIF再エンコードに失敗しました（${reason}）。先頭フレームのPNGにフォールバックします。` }
  }
}

function buildGifPalette(
  sourceColors: number[][],
  frames: ImageData[],
  filter: ScaleFilter,
): { palette: number[][]; transparentIndex: number } {
  if (filter === 'nearest' && sourceColors.length > 0 && sourceColors.length <= 255) {
    return withTransparentSlot(sourceColors)
  }
  const merged = new Uint8ClampedArray(frames.reduce((n, f) => n + f.data.length, 0))
  let o = 0
  for (const f of frames) {
    merged.set(f.data, o)
    o += f.data.length
  }
  const quantized = quantize(merged, 255)
  return withTransparentSlot(quantized)
}

export async function rasterizeOfficialPreview(
  asset: LibraryAsset,
  size: number,
  crop: CropSquare | null,
  filter: ScaleFilter,
): Promise<{ bytes: Uint8Array; mime: string }> {
  if (shouldExportAnimatedGif(asset)) {
    const gif = await rasterizeAnimatedGif(asset.bytes, size, crop, filter)
    if (!('error' in gif)) {
      return { bytes: gif.data, mime: 'image/gif' }
    }
  }
  const png = await rasterizeStill(asset.bytes, asset.mime, size, crop, filter)
  return { bytes: png, mime: 'image/png' }
}

export function sizeWarnings(
  kind: AssetKind,
  fileBytes: number,
  animated: boolean,
  frames: number,
): string[] {
  const w: string[] = []
  if (kind === 'badge' && fileBytes > SIZE_LIMITS.badgeBytes) {
    w.push(`バッジ目安 ${SIZE_LIMITS.badgeBytes / 1024}KB を超えています（${formatKb(fileBytes)}）。`)
  }
  if (kind === 'channel_point' && fileBytes > SIZE_LIMITS.channelPointBytes) {
    w.push(
      `チャンネルポイント目安 ${SIZE_LIMITS.channelPointBytes / 1024}KB を超えています（${formatKb(fileBytes)}）。`,
    )
  }
  if (kind === 'emote' && !animated && fileBytes > SIZE_LIMITS.stillEmoteBytes) {
    w.push(`静止エモート目安 ${SIZE_LIMITS.stillEmoteBytes / 1024}KB を超えています（${formatKb(fileBytes)}）。`)
  }
  if (kind === 'emote' && animated && fileBytes > SIZE_LIMITS.animatedGifBytes) {
    w.push(`アニメGIF目安 ${SIZE_LIMITS.animatedGifBytes / 1024}KB を超えています（${formatKb(fileBytes)}）。`)
  }
  if (kind === 'emote' && animated && frames > SIZE_LIMITS.animatedGifFrames) {
    w.push(`フレーム数が${frames}です（目安は${SIZE_LIMITS.animatedGifFrames}以下）。`)
  }
  return w
}

function formatKb(n: number): string {
  return `${(n / 1024).toFixed(1)}KB`
}
