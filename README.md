# Chat Icon Studio

Twitch のチャット欄に近い見た目で、エモート・バッジ・チャンネルポイント画像をプレビューし、公式サイズの画像ファイルに書き出す **Windows 向け** Tauri 2 アプリです。

ソースは [github.com/Tomozow/chat-icon-studio](https://github.com/Tomozow/chat-icon-studio) の `main` にあります。

セッション中のみ保持します（ディスクへライブラリを保存しません）。サーバーへはアップロードしません。

## 必要環境

- Node.js 22+
- Rust（`tauri build` 時）
- Windows（インストーラとネイティブの DnD / 保存ダイアログ）

## 開発

```bash
npm install
npm run dev
```

ブラウザで `http://127.0.0.1:4867` を開きます。

## Windows 向けビルド（NSIS）

```bash
npm install
npm run tauri build
```

## GitHub Pages

ブラウザ版を Pages に出し、Windows インストーラは Releases に置きます。

1. Settings → Pages → **GitHub Actions** を選ぶ
2. 下の YAML を `.github/workflows/pages.yml` として `main` に置く（Actions の workflow ファイルは、このアップロード経路では権限不足のため置けていません）
3. `main` へ push するか、Actions から手動実行する
4. 公開 URL: `https://Tomozow.github.io/chat-icon-studio/`

```yaml
name: GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          VITE_GITHUB_REPOSITORY: ${{ github.repository }}
      - name: Add .nojekyll
        run: touch dist/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

`npm ci` 用の `package-lock.json` が未コミットの場合は、手順の `npm ci` を `npm install` に変えてください。

## 使い方（概要）

1. png / gif / webp をライブラリへ追加する
2. 公式サイズ帯でプレビューする
3. チャット行でサイズ感を確認する
4. サイズを選んで書き出す
