import type { Metadata, Viewport } from "next";
import "./globals.css";
import BackgroundLayer from "@/components/BackgroundLayer";
import RootBackground from "@/components/RootBackground";

const title = "YOTOGI / ネットロア";
const description =
  "選んだモチーフから怪談を紡ぎ、その奥に潜む伝承の型まで解き明かす。AI時代の怪談";

export const metadata: Metadata = {
  // NEXT_PUBLIC_SITE_URL 未設定時は undefined にし、Vercel本番URLを自動採用させる
  // （localhost固定だと本番でog:imageがlocalhostを指してOGカードが壊れる）。
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    locale: "ja_JP",
    siteName: "YOTOGI",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // safe-area(ノッチ/ホームインジケータ)まで描画領域を広げ、env(safe-area-inset-*)を有効化。
  // 地レイヤー(RootBackground)が inset まで覆うので黒は露出しない。
  viewportFit: "cover",
  // WCAG 1.4.4: 拡大を妨げない (maximumScale を 1 に固定しない)
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col text-offwhite-0 font-sans">
        {/* 実 viewport を全面で覆う「地」(ルート別の色)。body 自体は塗らず、
            この fixed 層が overscroll/safe-area まで含めて黒露出を封じる。 */}
        <RootBackground />
        {/* PC のフルブリード背景は遷移しても据え置く層に集約（チラつき防止）。 */}
        <BackgroundLayer />
        {children}
      </body>
    </html>
  );
}
