/**
 * StatusBar — iOS 風の偽ステータスバー（9:41＋signal/wifi/battery）は
 * Web アプリには不要なためユーザー要望で撤去。互換のため props は残すが何も描画しない。
 */
type StatusBarProps = {
  className?: string;
};

export default function StatusBar(_props: StatusBarProps) {
  return null;
}
