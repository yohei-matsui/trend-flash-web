import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "業界トレンド速報メーカー | EAVAL",
  description: "ジャンルを選ぶだけで、直近の新規・伸びているYouTube動画を洗い出し、クライアントに送るトレンド速報を自動生成",
  icons: {
    icon: "/eaval-logo.png",
    apple: "/eaval-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
