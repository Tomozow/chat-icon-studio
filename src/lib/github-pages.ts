export function githubReleasesUrl(): string | null {
  const repo = import.meta.env.VITE_GITHUB_REPOSITORY || inferRepo()
  if (!repo) return null
  return `https://github.com/${repo}/releases/latest`
}

export function githubInstallerUrl(): string | null {
  const repo = import.meta.env.VITE_GITHUB_REPOSITORY || inferRepo()
  if (!repo) return null
  const name = encodeURIComponent('Chat.Icon.Studio_0.1.0_x64-setup.exe')
  return `https://github.com/${repo}/releases/latest/download/${name}`
}

function inferRepo(): string | null {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname
  const m = /^([a-z0-9-]+)\.github\.io$/i.exec(host)
  if (!m) return null
  const owner = m[1]
  const seg = window.location.pathname.split('/').filter(Boolean)[0]
  if (!seg || seg === 'index.html') return `${owner}/${owner}.github.io`
  return `${owner}/${seg}`
}
