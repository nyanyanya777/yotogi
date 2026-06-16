import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YOTOGI / ネットロア",
  description:
    "怪談を通じて民俗的記憶に触れるアプリ。夜に語り、昼に解く。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // WCAG 1.4.4: 拡大を妨げない (maximumScale を 1 に固定しない)
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-sumi-0 text-offwhite-0 font-sans">
        {children}
      </body>
    </html>
  );
}
