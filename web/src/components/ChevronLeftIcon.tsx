/**
 * ChevronLeftIcon — NavBar 戻る用の山括弧。
 * stroke 2px、`currentColor` で色追従。視覚サイズ 20×20。
 */
export default function ChevronLeftIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12.5 4L6.5 10L12.5 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
