import { CropEditor } from '@/components/crop-editor'
import { useDisplaySrc } from '@/components/use-display-src'
import type { CropSquare, LibraryAsset } from '@/lib/types'

export function AssetCropEditor({
  asset,
  onChange,
}: {
  asset: LibraryAsset
  onChange: (crop: CropSquare) => void
}) {
  const src = useDisplaySrc(asset)
  if (!asset.crop) return null
  return (
    <CropEditor
      src={src}
      width={asset.width}
      height={asset.height}
      crop={asset.crop}
      onChange={onChange}
    />
  )
}
