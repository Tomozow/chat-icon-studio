import { firstFramePng, rasterizeOfficialPreview } from '@/lib/image-codec'
import { cropCacheKey } from '@/lib/crop'
import type { AssetKind, LibraryAsset, ScaleFilter } from '@/lib/types'
import { OFFICIAL_SIZES } from '@/lib/twitch-sizes'

const rasterJobs = new Map<string, Promise<{ bytes: Uint8Array; mime: string }>>()
const urlRecords = new Map<string, { urls: string[]; animSync: string }>()
const stillSourceUrls = new Map<string, string>()
const stillSourceJobs = new Map<string, Promise<string>>()

function rasterKey(asset: LibraryAsset, size: number, filter: ScaleFilter) {
  return `${asset.id}:${asset.kind}:${size}:${cropCacheKey(asset.crop)}:${filter}`
}

function urlKey(asset: LibraryAsset, kind: AssetKind, filter: ScaleFilter, sizes: readonly number[]) {
  return `${asset.id}:${kind}:${cropCacheKey(asset.crop)}:${filter}:${sizes.join(',')}`
}

export function getCachedRaster(
  asset: LibraryAsset,
  size: number,
  filter: ScaleFilter,
): Promise<{ bytes: Uint8Array; mime: string }> {
  const key = rasterKey(asset, size, filter)
  let job = rasterJobs.get(key)
  if (!job) {
    job = rasterizeOfficialPreview(asset, size, asset.crop, filter)
    rasterJobs.set(key, job)
  }
  return job
}

/** Chat line only needs 1x/2x; export / size strip still use all three. */
export function chatPreviewSizes(kind: AssetKind): readonly number[] {
  return OFFICIAL_SIZES[kind].slice(0, 2)
}

export async function getChatPreviewUrls(
  asset: LibraryAsset,
  kind: AssetKind,
  filter: ScaleFilter,
  animSync: string,
): Promise<string[]> {
  const sizes = chatPreviewSizes(kind)
  const rasters = await Promise.all(sizes.map((size) => getCachedRaster(asset, size, filter)))
  const key = urlKey(asset, kind, filter, sizes)
  const animated = kind === 'emote' && asset.isAnimatedGif
  const existing = urlRecords.get(key)
  if (existing && (!animated || existing.animSync === animSync)) {
    return existing.urls
  }
  if (existing) {
    for (const u of existing.urls) URL.revokeObjectURL(u)
  }
  const urls = rasters.map((item) => {
    const copy = new Uint8Array(item.bytes.byteLength)
    copy.set(item.bytes)
    return URL.createObjectURL(new Blob([copy.buffer], { type: item.mime }))
  })
  urlRecords.set(key, { urls, animSync })
  return urls
}

/** First-frame PNG for badges / channel points so GIF sources do not play. */
export function getDisplaySrc(asset: LibraryAsset): Promise<string> {
  if (asset.kind === 'emote' || !asset.isAnimatedGif) return Promise.resolve(asset.objectUrl)
  const existing = stillSourceUrls.get(asset.id)
  if (existing) return Promise.resolve(existing)
  let job = stillSourceJobs.get(asset.id)
  if (!job) {
    job = firstFramePng(asset.bytes, asset.mime).then((png) => {
      const copy = new Uint8Array(png.byteLength)
      copy.set(png)
      const url = URL.createObjectURL(new Blob([copy.buffer], { type: 'image/png' }))
      stillSourceUrls.set(asset.id, url)
      stillSourceJobs.delete(asset.id)
      return url
    })
    stillSourceJobs.set(asset.id, job)
  }
  return job
}

export function invalidateAssetCache(assetId: string) {
  const prefix = `${assetId}:`
  for (const key of [...rasterJobs.keys()]) {
    if (key.startsWith(prefix)) rasterJobs.delete(key)
  }
  for (const [key, rec] of urlRecords) {
    if (!key.startsWith(prefix)) continue
    for (const u of rec.urls) URL.revokeObjectURL(u)
    urlRecords.delete(key)
  }
  const still = stillSourceUrls.get(assetId)
  if (still) {
    URL.revokeObjectURL(still)
    stillSourceUrls.delete(assetId)
  }
  stillSourceJobs.delete(assetId)
}
