import type { LevelData } from '../core/types';

// 레벨 입력 채널 — 디자이너 툴과 같은 규약을 쓴다:
//   1) URL 해시 `#level=<base64>`  2) localStorage `combo-match:playtest`  3) 내장 데모
// 어느 경로든 디코드 실패는 예외 없이 null (호출자가 다음 순위로 폴백).

export const PLAYTEST_KEY = 'combo-match:playtest';

function b64ToUtf8(b64: string): string {
  // 디자이너 strToB64 = btoa(unescape(encodeURIComponent(s))) 의 역변환 (UTF-8 안전)
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeLevelHash(hash: string): LevelData | null {
  const m = /^#level=(.+)$/.exec(hash);
  if (!m || !m[1]) return null;
  try {
    const json = b64ToUtf8(decodeURIComponent(m[1]));
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as LevelData; // 구조 검증은 loadLevel이 fail-fast로 소유
  } catch {
    return null;
  }
}

/** 디자이너 툴이 「▶ 플레이 테스트」로 남긴 레벨 (같은 브라우저에서 나란히 작업할 때 쓴다) */
export function loadPlaytestLevel(): LevelData | null {
  try {
    const raw = localStorage.getItem(PLAYTEST_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as LevelData;
  } catch {
    return null;
  }
}

// 내장 데모 — 2층 피라미드 10장, k=2 r=1. 상단 체인(6→7→8→9→5)으로 시작해
// 드로우·와일드까지 자연히 체험하도록 자원(deck 4, wild 2)을 넉넉히 준다.
export function demoLevel(): LevelData {
  const P = ['🍓', '🍒', '🍅', '🌶️', '🍎', '🍊'];
  const sym: string[][] = [
    [P[1]!, P[2]!], // 0 🍒🍅
    [P[0]!, P[4]!], // 1 🍓🍎
    [P[2]!, P[5]!], // 2 🍅🍊
    [P[1]!, P[3]!], // 3 🍒🌶️
    [P[4]!, P[0]!], // 4 🍎🍓
    [P[3]!, P[1]!], // 5 🌶️🍒
    [P[0]!, P[2]!], // 6 🍓🍅
    [P[2]!, P[4]!], // 7 🍅🍎
    [P[4]!, P[5]!], // 8 🍎🍊
    [P[5]!, P[3]!], // 9 🍊🌶️
  ];
  const bottom = [0, 1, 2, 3, 4, 5].map((i) => ({ id: i, x: i * 76, y: 100, layer: 0 }));
  const top = [6, 7, 8, 9].map((i) => ({ id: i, x: 38 + (i - 6) * 76, y: 52, layer: 1 }));
  const cards = [...bottom, ...top].map((c) => ({
    ...c,
    symbols: sym[c.id]!,
    lockReq: 0,
    faceDown: false,
    unlockedBy: [],
    bombCounter: 0,
    zone: 0,
    paper: false,
    piece: false,
  }));
  const coveredBy: Record<number, number[]> = { 0: [6], 1: [6, 7], 2: [7, 8], 3: [8, 9], 4: [9] };
  return {
    schema: 'combo-match/level@2',
    seed: 20260726,
    config: {
      N: P.length,
      k: 2,
      r: 1,
      sim: 0,
      tf: 0,
      cards: cards.length,
      layers: 2,
      topology: 'pyramid',
      deck: 4,
      wild: 2,
      moves: 0,
      cgoal: 5,
      objective: 'clear',
      time: 0,
      obst: 0,
      fd: 0,
      shuffle: false,
      keylocks: 0,
      bombs: 0,
      zones: 1,
      paper: 0,
      seed: 20260726,
    },
    pool: P,
    active: [P[0]!, P[1]!],
    deckStock: [
      [P[4]!, P[1]!],
      [P[0]!, P[5]!],
    ],
    cards,
    coverage: cards.map((c) => ({ id: c.id, coveredBy: coveredBy[c.id]?.slice() ?? [] })),
    rules: null,
  };
}
