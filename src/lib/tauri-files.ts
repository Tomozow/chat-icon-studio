export async function isTauriRuntime(): Promise<boolean> {
  try {
    const { isTauri } = await import('@tauri-apps/api/core')
    return isTauri()
  } catch {
    return false
  }
}

export async function listenNativeDrop(onPaths: (paths: string[]) => void): Promise<() => void> {
  const { getCurrentWebview } = await import('@tauri-apps/api/webview')
  const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === 'drop') {
      onPaths(event.payload.paths)
    }
  })
  return unlisten
}

export async function readDroppedFile(path: string): Promise<{ name: string; bytes: Uint8Array }> {
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const bytes = await readFile(path)
  const name = path.split(/[/\\]/).pop() ?? 'asset'
  return { name, bytes }
}

export async function openImageDialog(): Promise<{ name: string; bytes: Uint8Array }[]> {
  const tauri = await isTauriRuntime()
  if (!tauri) {
    return openHtmlFilePicker()
  }
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const selected = await open({
    multiple: true,
    filters: [{ name: 'Images', extensions: ['png', 'gif', 'webp'] }],
  })
  if (!selected) return []
  const paths = Array.isArray(selected) ? selected : [selected]
  const out: { name: string; bytes: Uint8Array }[] = []
  for (const path of paths) {
    const bytes = await readFile(path)
    out.push({ name: path.split(/[/\\]/).pop() ?? 'asset', bytes })
  }
  return out
}

function openHtmlFilePicker(): Promise<{ name: string; bytes: Uint8Array }[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/png,image/gif,image/webp,.png,.gif,.webp'
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    document.body.appendChild(input)

    let settled = false
    const finish = (value: { name: string; bytes: Uint8Array }[]) => {
      if (settled) return
      settled = true
      window.removeEventListener('focus', onWindowFocus)
      input.remove()
      resolve(value)
    }

    const onWindowFocus = () => {
      window.setTimeout(() => {
        if (settled) return
        if (input.files && input.files.length > 0) return
        finish([])
      }, 400)
    }

    input.addEventListener('cancel', () => finish([]))
    input.addEventListener('change', async () => {
      const files = [...(input.files ?? [])]
      const out: { name: string; bytes: Uint8Array }[] = []
      for (const f of files) {
        out.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })
      }
      finish(out)
    })
    window.addEventListener('focus', onWindowFocus)
    input.click()
  })
}

export async function saveExportedImages(
  files: { fileName: string; bytes: Uint8Array }[],
): Promise<{ mode: 'native' | 'browser' | 'cancelled'; written: string[] }> {
  if (!files.length) return { mode: 'cancelled', written: [] }
  const tauri = await isTauriRuntime()
  if (tauri) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const first = files[0]
    const path = await save({
      defaultPath: first.fileName,
      filters: [{ name: 'Images', extensions: ['png', 'gif'] }],
    })
    if (!path) return { mode: 'cancelled', written: [] }
    const written: string[] = []
    const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
    const dir = slash >= 0 ? path.slice(0, slash) : ''
    const chosenName = slash >= 0 ? path.slice(slash + 1) : path
    const sep = path.includes('\\') ? '\\' : '/'
    const dot = chosenName.lastIndexOf('.')
    const stem = (dot > 0 ? chosenName.slice(0, dot) : chosenName).trim() || 'asset'
    for (const file of files) {
      const destName =
        files.length === 1
          ? namedSingle(chosenName, file.fileName)
          : namedSized(stem, file.fileName)
      const dest = dir ? `${dir}${sep}${destName}` : destName
      await writeFile(dest, file.bytes)
      written.push(destName)
    }
    return { mode: 'native', written }
  }
  const written: string[] = []
  for (const file of files) {
    const copy = new Uint8Array(file.bytes.byteLength)
    copy.set(file.bytes)
    const mime = file.fileName.endsWith('.gif') ? 'image/gif' : 'image/png'
    const blob = new Blob([copy.buffer], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.fileName
    a.click()
    URL.revokeObjectURL(url)
    written.push(file.fileName)
    await new Promise((r) => window.setTimeout(r, 120))
  }
  return { mode: 'browser', written }
}

function namedSingle(chosenName: string, originalName: string): string {
  const origExt = originalName.includes('.') ? originalName.slice(originalName.lastIndexOf('.') + 1) : 'png'
  if (!chosenName.trim()) return originalName
  if (chosenName.includes('.')) return chosenName
  return `${chosenName}.${origExt}`
}

function namedSized(stem: string, originalName: string): string {
  const m = /_(\d+x\d+)\.(png|gif)$/i.exec(originalName)
  if (m) return `${stem}_${m[1]}.${m[2]}`
  const ext = originalName.includes('.') ? originalName.slice(originalName.lastIndexOf('.') + 1) : 'png'
  return `${stem}.${ext}`
}

export async function filesFromHtmlDrop(dt: DataTransfer): Promise<{ name: string; bytes: Uint8Array }[]> {
  const out: { name: string; bytes: Uint8Array }[] = []
  for (const f of [...dt.files]) {
    out.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })
  }
  return out
}
