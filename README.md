# Chat Icon Studio

Twitch のチャット欄に近い見た目で、エモート・バッジ・チャンネルポイント画像をプレビューし、公式サイズの画像ファイルに書き出す **Windows 向け** Tauri 2 アプリです。

セッション中のみ保持します（ディスクへライブラリを保存しません）。サーバーへはアップロードしません。

ソース: [github.com/Tomozow/chat-icon-studio](https://github.com/Tomozow/chat-icon-studio)

## 配布

| | URL |
| --- | --- |
| ブラウザ版（GitHub Pages） | https://tomozow.github.io/chat-icon-studio/ |
| Windows インストーラ（Releases） | https://github.com/Tomozow/chat-icon-studio/releases/latest/download/Chat.Icon.Studio_0.1.0_x64-setup.exe |
| Release 一覧 | https://github.com/Tomozow/chat-icon-studio/releases |

Pages は GitHub Actions で `main` のフロントエンドをデプロイしています。インストーラ（NSIS）は Releases の `v0.1.0` にあります。GitHub がスペースを `.` に変えるため、資産名は `Chat.Icon.Studio_0.1.0_x64-setup.exe` です。ページの「Windows版を入手」もこの名前を指します。

未署名のため、SmartScreen で「詳細情報 → 実行」が出ることがあります。

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

成果物は `src-tauri/target/release/bundle/nsis/` 付近です。新しいバージョンを配るときは、その exe を GitHub Releases に添付してください。

## 使い方（概要）

1. png / gif / webp をライブラリへ追加する（ファイルごとにタイプを割り当て）
2. 公式サイズ帯で実ピクセル＋チェッカーを確認
3. チャット行の歯車からダーク / ライト、表示名、MOD / VIP / サブスク、カスタムバッジを確認（表示は 28px。Retina では 56 / 112 を srcset）
4. タイプをチャンネルポイントにすると、報酬グリッド／詳細プレビューが出る（タイトル・コスト・色はセッションのみ）
5. チャット欄のエモートパレットからメッセージへ挿入
6. 必要なら「トリミング」で正方形の切り抜きを指定する（解除すると全体を余白付きで収める）
7. プリセットまたはサイズを選んでから書き出す（エモートは112、バッジは18・36・72、CPは28・56・112）

### 公式サイズ

- エモート / チャンネルポイント: 28 / 56 / 112
- バッジ: 18 / 36 / 72

チャット行は Twitch と同じく **CSS 28px（バッジ 18px）** で、`srcset` に 1x / 2x（必要なら 3x）を載せます。112 を CSS で 28 に縮めません。

チャンネルポイント書き出し時の注記: **通貨アイコンは3サイズ／個別リワードは112を使う**

### 書き出しルール

- ファイル名: `{name}_{width}x{height}.png`（アニメーションエモートは gif）。選んだサイズだけ書き出す。ZIP にはまとめない。
- 静止画は常に PNG。WebP 入力可。アニメ WebP は先頭フレームの静止画。
- GIF のアニメ書き出しは **エモートのみ**。バッジ / CP の GIF は先頭フレーム PNG。
- サイズ警告のみ（ブロックしない）: バッジ 25KB、静止エモート 100KB、アニメ GIF 512KB、60 フレーム超、CP 25KB。

## やらないこと

ピクセルパーフェクトなフォント複製、重い GIF 最適化、自動圧縮、mac/linux バンドル、ディスク永続化、1 ソースから 3 タイプ同時書き出し。
