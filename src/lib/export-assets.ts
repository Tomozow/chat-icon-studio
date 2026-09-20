import type { LibraryAsset, ScaleFilter } from './types'
import { rasterizeAnimatedGif, rasterizeStill, shouldExportAnimatedGif, sizeWarnings } from './image-codec'
import { sanitizeFileStem } from './utils'

export type ExportFile = {
  fileName: string
  bytes: Uint8Array
  warnings: string[]
}

export type ExportResult = {
  files: ExportFile[]
  notes: string[]
}

export async function exportOfficialImages(
  asset: LibraryAsset,
  filter: ScaleFilter,
  sizes: readonly number[],
): Promise<ExportResult> {
  const stem = sanitizeFileStem(asset.name)
  const notes: string[] = []
  const files: ExportFile[] = []
  const animated = shouldExportAnimatedGif(asset)
  const crop = asset.crop

  for (const size of sizes) {
    if (animated) {
      const gif = await rasterizeAnimatedGif(asset.bytes, size, crop, filter)
      if ('error' in gif) {
        notes.push(gif.error)
        const png = await rasterizeStill(asset.bytes, asset.mime, size, crop, filter)
        const fileName = `${stem}_${size}x${size}.png`
        files.push({
          fileName,
          bytes: png,
          warnings: sizeWarnings(asset.kind, png.byteLength, false, 1),
        })
      } else {
        const fileName = `${stem}_${size}x${size}.gif`
        files.push({
          fileName,
          bytes: gif.data,
          warnings: sizeWarnings(asset.kind, gif.data.byteLength, true, gif.frameCount),
        })
      }
    } else {
      const png = await rasterizeStill(asset.bytes, asset.mime, size, crop, filter)
      const fileName = `${stem}_${size}x${size}.png`
      files.push({
        fileName,
        bytes: png,
        warnings: sizeWarnings(asset.kind, png.byteLength, false, 1),
      })
    }
  }

  return { files, notes }
}
