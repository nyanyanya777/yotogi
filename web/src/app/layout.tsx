import type { Metadata, Viewport } from "next";
import "./globals.css";
import BackgroundLayer from "@/components/BackgroundLayer";

const title = "YOTOGI / ネットロア";
const description =
  "怪談を通じて民俗的記憶に触れるアプリ。夜に語り、昼に解く。";

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
        {/* PC のフルブリード背景は遷移しても据え置く層に集約（チラつき防止）。 */}
        <BackgroundLayer />
        {children}
      </body>
    </html>
  );
}
