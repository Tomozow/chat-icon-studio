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
