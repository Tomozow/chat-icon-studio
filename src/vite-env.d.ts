/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_REPOSITORY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
