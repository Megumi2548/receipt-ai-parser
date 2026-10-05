import './globals.css'

export const metadata = {
  title: 'タスク・メモ管理 Dashboard',
  description: 'ポートフォリオアプリ',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}