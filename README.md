# Chat Icon Studio

Twitch のチャット欄に近い見た目で、エモート・バッジ・チャンネルポイント画像をプレビューし、公式サイズの画像ファイルに書き出す **Windows 向け** Tauri 2 アプリです。

セッション中のみ保持します（ディスクへライブラリを保存しません）。サーバーへはアップロードしません。

ソース: [github.com/Tomozow/chat-icon-studio](https://github.com/Tomozow/chat-icon-studio)

## 使い方（概要）

1. PNG / GIF / WebP をライブラリに追加し、各ファイルのタイプ（エモート / バッジ / チャンネルポイント）を選ぶ。
   1b. 必要なら「トリミング」で正方形に切り抜く。オフのときは余白付きで全体を収める。
2. チャットプレビューで見え方を確認する。必要なら歯車で表示名・MOD / VIP / サブスク・カスタムバッジを変えたり、ダーク / ライトを切り替える。
   2b. タイプがチャンネルポイントのときは、報酬グリッドと詳細プレビューも表示される。
3. エモートは、チャット欄のパレットからメッセージに挿入して確認する。
4. プリセットまたはサイズを選んで書き出す（エモート 112、バッジ 18・36・72、チャンネルポイント 28・56・112）。

### 公式サイズ

- エモート / チャンネルポイント: 28 / 56 / 112
- バッジ: 18 / 36 / 72

## 配布

| | URL |
| --- | --- |
| ブラウザ版（GitHub Pages） | https://tomozow.github.io/chat-icon-studio/ |
| Windows インストーラ（Releases） | https://github.com/Tomozow/chat-icon-studio/releases/latest/download/Chat.Icon.Studio_0.1.0_x64-setup.exe |
| Release 一覧 | https://github.com/Tomozow/chat-icon-studio/releases |

Windows版は未署名のため、警告が出る可能性が高いです。警告ダイアログの「詳細情報 → 実行」で起動できます。

## 必要環境（自分でビルドする場合）

- Node.js 22+
- Rust（`tauri build` 時）
- Windows（インストーラとネイティブの DnD / 保存ダイアログ）

## 開発

Vite のみで UI を確認できます。ポートは **4867**（3000 / 5173 / 8080 は使いません）。

```bash
npm install
npm run dev
```

ブラウザで `http://127.0.0.1:4867` を開きます。

Vite のみのときは:

- ファイル追加: 点線枠をクリック、またはドロップ
- 画像保存: ブラウザのダウンロード（公式サイズごとにファイル）

**ネイティブのウィンドウ DnD と保存ダイアログは Windows 上の Tauri 実行が必要です。**

## Windows 向けビルド（NSIS）

macOS / Linux バンドルは出していません。`targets` は `nsis` のみです。

```bash
npm install
npm run tauri build
```

成果物は `src-tauri/target/release/bundle/nsis/` 付近です。
