import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smail - AI メールクライアント",
  description: "Claudeが返信パターンを学習するAIメールクライアント",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="h-full flex flex-col">{children}</body>
    </html>
  );
}
