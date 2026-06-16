/**
 * StatusBar — モバイル想定の iOS 風ステータスバー
 * 左に時刻 (9:41)、右に signal / wifi / battery のダミーアイコン。
 * 実機ステータスバーではなく、画面キャプチャ的な装飾。
 *
 * className: 親から色 (text-*) や表示切替 (lg:hidden 等) を流し込める。
 * デフォルト文字色は text-offwhite-0。className 側で text-* を指定すれば
 * Tailwind の最後勝ち（クラス順は class 文字列上の出現順ではなく、
 * 生成 CSS の優先度で決まるが、ここでは同 specificity のため後置のほうが勝つ）
 * を考慮し、デフォルトを先に、override を後ろに連結する。
 */
type StatusBarProps = {
  className?: string;
};

export default function StatusBar({
  className = "text-offwhite-0",
}: StatusBarProps) {
  return (
    <div
      className={`flex h-11 w-full items-center justify-between px-6 ${className}`}
    >
      <span className="font-sans text-[15px] font-semibold tracking-tight">
        9:41
      </span>
      <div className="flex items-center gap-1.5">
        {/* signal bars */}
        <svg
          width="18"
          height="12"
          viewBox="0 0 18 12"
          fill="none"
          aria-hidden="true"
        >
          <rect x="0" y="8" width="3" height="4" rx="0.5" fill="currentColor" />
          <rect x="5" y="5" width="3" height="7" rx="0.5" fill="currentColor" />
          <rect x="10" y="2" width="3" height="10" rx="0.5" fill="currentColor" />
          <rect x="15" y="0" width="3" height="12" rx="0.5" fill="currentColor" />
        </svg>
        {/* wifi */}
        <svg
          width="16"
          height="12"
          viewBox="0 0 16 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M8 11.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z"
            fill="currentColor"
          />
          <path
            d="M2.5 5.5a8 8 0 0 1 11 0"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M4.5 7.5a5 5 0 0 1 7 0"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        {/* battery */}
        <svg
          width="26"
          height="12"
          viewBox="0 0 26 12"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="0.5"
            y="0.5"
            width="22"
            height="11"
            rx="2.5"
            stroke="currentColor"
            fill="none"
          />
          <rect x="2" y="2" width="19" height="8" rx="1.2" fill="currentColor" />
          <rect
            x="23.5"
            y="4"
            width="2"
            height="4"
            rx="1"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
  );
}
