# 🧾 AIレシート解析・タスク管理アプリ (Receipt & Task Manager)

AWS Textract（OCR）と Google Gemini API（生成AI）を組み合わせて、アップロードされたレシート画像から店舗名・日付・品目・金額を可視化・構造化するポートフォリオアプリです。

---

## 💡 作成背景

日常的なレシート入力や経費精算の手間を削減するため、「画像から文字を読み取るだけでなく、生成AIを活用して人間が見やすい・扱いやすい形式に自動補正する仕組み」を検証・開発しました。

---

## 🛠️ 使用技術 (Tech Stack)

### インフラ・容器化
* **Docker / Docker Compose** (開発環境のコンテナ化)
* **AWS S3** (レシート画像のストレージ)
* **AWS Textract** (画像からのOCRテキスト抽出)

### バックエンド
* **Python 3.11**
* **FastAPI** (Webフレームワーク)
* **PostgreSQL** (データベース)
* **SQLAlchemy** (ORM)
* **google-genai SDK** (Gemini 3.8-flash API連携)

### フロントエンド
* **React / TypeScript** (またはお使いのスタック)

---

## 🏗️ システム構成 / 処理フロー

1. **画像アップロード**: ユーザーがレシート画像を送信。
2. **S3保存 & Textract解析**: 画像をAWS S3に保存後、AWS Textractで生のOCRテキストを抽出。
3. **Gemini構造化**: 抽出した生テキストを Gemini API (`gemini-3.8-flash`) へ送信し、読みやすいフォーマットに構造化・整形。
4. **DB保存・表示**: 整形されたテキストと画像URLをPostgreSQLに保存し、画面にリアルタイム反映。

---

## 🚀 ローカル起動方法

```bash
# 1. リポジトリのクローン
git clone <your-repository-url>
cd my-portfolio-app

# 2. 環境変数の設定 (.env.example を参考に .env を作成)
# ※ APIキー等は各自設定してください

# 3. Dockerコンテナの起動
docker compose up -d --build
