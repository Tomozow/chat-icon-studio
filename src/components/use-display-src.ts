import { useEffect, useState } from 'react'
import { getDisplaySrc } from '@/lib/preview-cache'
import type { LibraryAsset } from '@/lib/types'

export function useDisplaySrc(asset: LibraryAsset) {
  const [src, setSrc] = useState(asset.objectUrl)
  useEffect(() => {
    let cancelled = false
    void getDisplaySrc(asset).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [asset.id, asset.kind, asset.isAnimatedGif, asset.objectUrl])
  return src
}
