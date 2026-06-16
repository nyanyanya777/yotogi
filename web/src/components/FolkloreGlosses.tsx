/**
 * FolkloreGlosses — PC FolkloreAnalysis の左右傍注（昼）
 *
 * 1024px 以上のみ表示（lg:block / hidden）。position:fixed で左 72px / 右 72px、
 * 上 80px に固定。幅 240px、padding 16px。bg は offwhite/1-surface @ 0.92、border は
 * sand-rule 1px。typography は 14px Medium ラベル + 14px Regular 値（§3.8）。
 *
 * 仕様: /root/YOTOGI_IMPLEMENTATION_SPEC.md §3.8
 */

type GlossItem = { label: string; value: string };

const LEFT_ITEMS: GlossItem[] = [
  { label: "採集地", value: "東日本〜西日本（広域）" },
  { label: "採集年", value: "1910–1935" },
  { label: "採集者", value: "柳田國男 ／ 池田弥三郎" },
  {
    label: "参考文献",
    value: "『遠野物語』『日本民俗事典』『水神信仰の研究』",
  },
];

const RIGHT_ITEMS: GlossItem[] = [
  { label: "ATU話型", value: "AT 480 / 水辺の禁忌" },
  { label: "分類", value: "怪異譚 ／ 禁忌譚" },
  { label: "関連話", value: "井戸女、覗き穴、水鏡" },
];

function GlossList({ items }: { items: GlossItem[] }) {
  return (
    <ul className="flex flex-col gap-5">
      {items.map((item) => (
        <li key={item.label} className="flex flex-col gap-1">
          <span
            className="font-sans text-[14px] font-medium text-benigara"
            style={{ letterSpacing: "0.1em" }}
          >
            {item.label}
          </span>
          <span className="font-sans text-[14px] font-normal leading-[1.7] text-sumi-1">
            {item.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function FolkloreGlosses() {
  return (
    <>
      {/* LeftGloss — fixed, lg のみ */}
      <aside
        aria-label="採集情報"
        className="fixed left-[72px] top-20 z-20 hidden w-[240px] border border-sand-rule bg-offwhite-1/90 p-4 lg:block"
      >
        <GlossList items={LEFT_ITEMS} />
      </aside>

      {/* RightGloss — fixed, lg のみ */}
      <aside
        aria-label="話型情報"
        className="fixed right-[72px] top-20 z-20 hidden w-[240px] border border-sand-rule bg-offwhite-1/90 p-4 lg:block"
      >
        <GlossList items={RIGHT_ITEMS} />

        {/* 「夜に戻る →」 */}
        <a
          href="/story"
          className="mt-6 inline-block font-sans text-[14px] font-medium text-benigara underline-offset-4 hover:underline focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-accent"
        >
          夜に戻る →
        </a>
      </aside>
    </>
  );
}
