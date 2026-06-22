/**
 * SharedStory `/s/[id]` （Server Component / 読み取り専用）
 *
 * `/api/share` で Vercel Blob に保存された怪談を ID から復元して表示する。
 * デザイントーンは `/story`（夜の画面・墨黒×明朝体）に合わせた読み取り専用ビュー。
 * 取得失敗・不正 ID・壊れた JSON は notFound()（404）。
 *
 * 受け手はアプリ未利用でもこの URL を開くだけで本文が読める。末尾に
 * 「自分でも怪談を作る」導線（/motif）を置く。
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getShare } from "@/lib/getShare";
import PCFrame from "@/components/PCFrame";
import StatusBar from "@/components/StatusBar";
import PrimaryCTA from "@/components/PrimaryCTA";

// @vercel/blob（Node API）のため Node runtime を強制。
export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const shared = await getShare(id);
  if (!shared) {
    return { title: "YOTOGI / ネットロア", robots: { index: false } };
  }
  const flat = shared.body.replace(/\s+/g, " ").trim();
  const description = flat.length > 90 ? `${flat.slice(0, 90)}…` : flat;
  const title = `『${shared.title}』 — YOTOGI`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      locale: "ja_JP",
      siteName: "YOTOGI",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shared = await getShare(id);
  if (!shared) notFound();

  const paragraphs = shared.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <PCFrame mode="night" frameShadow="night">
      <div className="bg-sumi-0 text-offwhite-2 mx-auto min-h-dvh w-full max-w-[402px] flex flex-col min-[440px]:min-h-full">
        <StatusBar className="text-offwhite-2" />

        {/* NavBar — ロゴをトップへの導線にする */}
        <nav className="flex h-12 items-center px-4">
          <Link
            href="/"
            aria-label="YOTOGI トップへ"
            className="flex h-11 items-center rounded-full px-2 font-mincho text-[15px] tracking-wide text-offwhite-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-accent"
          >
            YOTOGI
          </Link>
        </nav>

        {/* ContentWrapper — pb-[160px] で最終段落が sticky footer に隠れない */}
        <main className="flex-1 px-6 pt-4 pb-[160px]">
          <h1 className="font-mincho font-semibold text-[36px] leading-[1.3] text-offwhite-2">
            {shared.title}
          </h1>
          <div className="border-t border-sand-rule mt-6 mb-6" />

          <div className="font-mincho text-[16px] leading-[1.9] text-offwhite-2">
            {paragraphs.map((p, i) => (
              <p key={i} className="mb-8">
                {p}
              </p>
            ))}
          </div>
        </main>

        {/* Footer — 受け手をアプリ本体（生成フロー）へ誘導 */}
        <footer
          className="sticky bottom-0 bg-sumi-0 px-6 pt-4 backdrop-blur-sm"
          style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        >
          <p className="mb-3 text-center font-mincho text-[13px] text-sumi-3">
            この怪談は YOTOGI で生まれました
          </p>
          <PrimaryCTA href="/motif" label="あなたも怪談を作る" variant="secondary" />
        </footer>
      </div>
    </PCFrame>
  );
}
