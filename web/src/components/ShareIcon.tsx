/**
 * ShareIcon — iOS 風の共有アイコン（上矢印 + ボックス）。
 * stroke 2px、`currentColor` で色追従。視覚サイズ 20×20。
 */
export default function ShareIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 13V3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 7L10 3L14 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 12V16C4 16.5523 4.44772 17 5 17H15C15.5523 17 16 16.5523 16 16V12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
