// 레벨 진행 저장 — localStorage 영속. 저장소 접근이 막힌 환경(사파리 프라이빗 등)에서도
// 게임이 죽지 않도록 전부 안전 실패시킨다.

export interface LevelRecord {
  cleared: boolean;
  bestScore: number;
}
export type Progress = Record<string, LevelRecord>;

const KEY = 'combo-match:progress';

/** 기존 기록에 새 결과를 반영한 값 (클리어는 한 번이라도 하면 유지, 점수는 최고 기록) */
export function mergeRecord(prev: LevelRecord | undefined, cleared: boolean, score: number): LevelRecord {
  return {
    cleared: (prev?.cleared ?? false) || cleared,
    bestScore: Math.max(prev?.bestScore ?? 0, score),
  };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Progress;
  } catch {
    return {};
  }
}

export function saveResult(levelId: number, cleared: boolean, score: number): Progress {
  const all = loadProgress();
  all[String(levelId)] = mergeRecord(all[String(levelId)], cleared, score);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* 저장 실패는 무시 — 진행 표시만 이번 세션에 한정된다 */
  }
  return all;
}
