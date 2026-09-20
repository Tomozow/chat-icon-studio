import { useDisplaySrc } from '@/components/use-display-src'
import type { LibraryAsset } from '@/lib/types'

export function LibraryThumb({ asset }: { asset: LibraryAsset }) {
  const src = useDisplaySrc(asset)
  return <img src={src} alt="" className="size-10 object-contain" />
}
