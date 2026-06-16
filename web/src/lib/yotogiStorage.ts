/**
 * yotogiStorage.ts — localStorage に生成中 / 生成済みの状態を保存・復元するクライアントユーティリティ。
 *
 * SSR / hydration mismatch を避けるため、すべての関数は呼ばれた瞬間に typeof window をチェックする。
 * 呼び出し側は必ず useEffect / イベントハンドラ内（=クライアント側）で叩くこと。
 */

const KEY_TAGS = "yotogi.tags";
const KEY_STORY = "yotogi.story";
const KEY_FOLKLORE = "yotogi.folklore";

export type StoredStory = { title: string; body: string };
export type StoredFolklore = {
  denshou_no_kata: string;
  butai_no_imi: string;
  eranda_motif: string;
};

function safe<T>(fn: () => T, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function saveTags(tags: string[]): void {
  safe(() => {
    window.localStorage.setItem(KEY_TAGS, JSON.stringify(tags));
  }, undefined);
}
export function loadTags(): string[] | null {
  return safe<string[] | null>(() => {
    const raw = window.localStorage.getItem(KEY_TAGS);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    // 3 つの非空文字列のみ受け入れる（API 側 isStringTriple との一貫性）
    if (
      Array.isArray(arr) &&
      arr.length === 3 &&
      arr.every((v) => typeof v === "string" && v.trim().length > 0)
    ) {
      return arr;
    }
    return null;
  }, null);
}

export function saveStory(story: StoredStory): void {
  safe(() => {
    window.localStorage.setItem(KEY_STORY, JSON.stringify(story));
  }, undefined);
}
export function loadStory(): StoredStory | null {
  return safe<StoredStory | null>(() => {
    const raw = window.localStorage.getItem(KEY_STORY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o && typeof o.title === "string" && typeof o.body === "string") {
      // 異常な長文タイトルが viewport を埋め尽くすのを防ぐため上限を設ける
      const title = o.title.length > 60 ? o.title.slice(0, 60) + "…" : o.title;
      return { title, body: o.body };
    }
    return null;
  }, null);
}

export function saveFolklore(f: StoredFolklore): void {
  safe(() => {
    window.localStorage.setItem(KEY_FOLKLORE, JSON.stringify(f));
  }, undefined);
}
export function loadFolklore(): StoredFolklore | null {
  return safe<StoredFolklore | null>(() => {
    const raw = window.localStorage.getItem(KEY_FOLKLORE);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (
      o &&
      typeof o.denshou_no_kata === "string" &&
      typeof o.butai_no_imi === "string" &&
      typeof o.eranda_motif === "string"
    ) {
      return o as StoredFolklore;
    }
    return null;
  }, null);
}

export function clearStory(): void {
  safe(() => {
    window.localStorage.removeItem(KEY_STORY);
  }, undefined);
}
export function clearFolklore(): void {
  safe(() => {
    window.localStorage.removeItem(KEY_FOLKLORE);
  }, undefined);
}
