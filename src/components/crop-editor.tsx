import { useEffect, useRef, useState } from 'react'
import { clampCrop } from '@/lib/crop'
import type { CropSquare } from '@/lib/types'

type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

type Props = {
  src: string
  width: number
  height: number
  crop: CropSquare
  onChange: (crop: CropSquare) => void
}

export function CropEditor({ src, width, height, crop, onChange }: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const layout = useRef({ left: 0, top: 0, w: 1, h: 1 })
  const drag = useRef<{
    handle: Handle
    startX: number
    startY: number
    crop: CropSquare
  } | null>(null)
  const localRef = useRef(crop)
  const [localCrop, setLocalCrop] = useState(crop)
  const [frozenSrc, setFrozenSrc] = useState<string | null>(null)

  useEffect(() => {
    if (drag.current) return
    localRef.current = crop
    setLocalCrop(crop)
  }, [crop])

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      const scale = Math.min(r.width / width, r.height / height)
      const w = width * scale
      const h = height * scale
      layout.current = {
        left: (r.width - w) / 2,
        top: (r.height - h) / 2,
        w,
        h,
      }
      el.style.setProperty('--img-left', `${layout.current.left}px`)
      el.style.setProperty('--img-top', `${layout.current.top}px`)
      el.style.setProperty('--img-w', `${w}px`)
      el.style.setProperty('--img-h', `${h}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width, height, src])

  function clientToImage(clientX: number, clientY: number) {
    const el = frameRef.current
    if (!el) return { x: 0, y: 0 }
    const r = el.getBoundingClientRect()
    const { left, top, w, h } = layout.current
    return {
      x: ((clientX - r.left - left) / w) * width,
      y: ((clientY - r.top - top) / h) * height,
    }
  }

  function setLiveCrop(next: CropSquare) {
    localRef.current = next
    setLocalCrop(next)
  }

  function applyDrag(clientX: number, clientY: number) {
    const d = drag.current
    if (!d) return
    const p = clientToImage(clientX, clientY)
    const start = clientToImage(d.startX, d.startY)
    const dx = p.x - start.x
    const dy = p.y - start.y
    const c = d.crop
    if (d.handle === 'move') {
      setLiveCrop(clampCrop({ ...c, x: c.x + dx, y: c.y + dy }, width, height))
      return
    }
    const minSize = Math.max(8, Math.min(width, height) * 0.08)
    let x = c.x
    let y = c.y
    let size = c.size
    const right = c.x + c.size
    const bottom = c.y + c.size
    if (d.handle === 'se') {
      size = Math.max(minSize, p.x - c.x, p.y - c.y)
    } else if (d.handle === 'nw') {
      size = Math.max(minSize, right - p.x, bottom - p.y)
      x = right - size
      y = bottom - size
    } else if (d.handle === 'ne') {
      size = Math.max(minSize, p.x - c.x, bottom - p.y)
      y = bottom - size
    } else if (d.handle === 'sw') {
      size = Math.max(minSize, right - p.x, p.y - c.y)
      x = right - size
    }
    setLiveCrop(clampCrop({ x, y, size }, width, height))
  }

  function freezeFrame() {
    const img = imgRef.current
    if (!img || !img.naturalWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    setFrozenSrc(canvas.toDataURL('image/png'))
  }

  function begin(handle: Handle, e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    freezeFrame()
    drag.current = { handle, startX: e.clientX, startY: e.clientY, crop: localRef.current }
    const onMove = (ev: PointerEvent) => applyDrag(ev.clientX, ev.clientY)
    const onUp = () => {
      drag.current = null
      onChange(localRef.current)
      setFrozenSrc(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const cropLeft = `calc(var(--img-left) + ${localCrop.x / width} * var(--img-w))`
  const cropTop = `calc(var(--img-top) + ${localCrop.y / height} * var(--img-h))`
  const cropSize = `calc(${localCrop.size / width} * var(--img-w))`
  const handle =
    'absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-white bg-zinc-950'

  return (
    <div
      ref={frameRef}
      className="relative h-52 w-full overflow-hidden rounded-md bg-zinc-800 select-none"
      style={{
        ['--img-left' as string]: '0px',
        ['--img-top' as string]: '0px',
        ['--img-w' as string]: '100%',
        ['--img-h' as string]: '100%',
      }}
    >
      <img
        ref={imgRef}
        src={frozenSrc ?? src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      <div className="pointer-events-none absolute bg-black/55" style={{ left: 0, top: 0, width: '100%', height: cropTop }} />
      <div
        className="pointer-events-none absolute bg-black/55"
        style={{ left: 0, top: `calc(${cropTop} + ${cropSize})`, right: 0, bottom: 0 }}
      />
      <div
        className="pointer-events-none absolute bg-black/55"
        style={{ left: 0, top: cropTop, width: cropLeft, height: cropSize }}
      />
      <div
        className="pointer-events-none absolute bg-black/55"
        style={{ left: `calc(${cropLeft} + ${cropSize})`, top: cropTop, right: 0, height: cropSize }}
      />
      <div
        className="absolute cursor-move touch-none border border-white"
        style={{ left: cropLeft, top: cropTop, width: cropSize, height: cropSize }}
        onPointerDown={(e) => begin('move', e)}
      >
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-white/40" />
          ))}
        </div>
        <button type="button" aria-label="左上" className={`${handle} left-0 top-0 cursor-nwse-resize`} onPointerDown={(e) => begin('nw', e)} />
        <button type="button" aria-label="右上" className={`${handle} left-full top-0 cursor-nesw-resize`} onPointerDown={(e) => begin('ne', e)} />
        <button type="button" aria-label="左下" className={`${handle} left-0 top-full cursor-nesw-resize`} onPointerDown={(e) => begin('sw', e)} />
        <button type="button" aria-label="右下" className={`${handle} left-full top-full cursor-nwse-resize`} onPointerDown={(e) => begin('se', e)} />
      </div>
    </div>
  )
}
