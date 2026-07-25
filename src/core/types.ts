// combo-match/level@2 스키마 타입 — 단일 진실: design/combo-match-core.md §8
// 용어: 마스터의 "액티브 카드" = 구 GDD의 "스포트라이트" (코드는 마스터 용어를 따른다)
export type SymbolId = string;

export interface LevelCardData {
  id: number;
  x: number;
  y: number;
  layer: number;
  symbols: SymbolId[]; // 1~6개 (D-1: k 가변)
  lockReq: number; // 콤보 잠금 — 현재 콤보 ≥ n일 때만 제거 가능 (0 = 없음)
  faceDown: boolean; // 인간 전용 지각 난이도 — 엔진 규칙에 영향 없음
  unlockedBy: number[]; // 열쇠 카드 id — 전부 제거되어야 선택 가능
  bombCounter: number; // 0 = 폭탄 아님. 모든 행동마다 −1, 0이면 즉시 패배
  zone: number; // 0..2 — 낮은 구역 소진 후 다음 구역 개방
  paper: boolean; // 종이 — 조각 수집 전 선택 불가
  piece: boolean; // 조각 — 제거 시 수집
}

export interface LevelConfigData {
  N: number;
  k: number;
  r: number; // 요구 공유 심볼 수 — |C ∩ active| ≥ r 이면 매치
  sim: number;
  tf: number;
  cards: number;
  layers: number;
  topology: string;
  deck: number; // 리드로우 횟수 (deckStock 우선, 고갈 시 풀 랜덤 k개)
  wild: number; // 시작 보유 와일드
  moves: number; // 이동(제거) 제한 — 0 = 무한
  cgoal: number; // 콤보 목표 — 배수마다 +100×콤보 보너스
  objective: 'clear' | 'score' | 'collect';
  time: number;
  obst: number;
  fd: number;
  shuffle: boolean;
  keylocks: number;
  bombs: number;
  zones: number;
  paper: number;
  seed: number;
}

export interface LevelRules {
  collectGoal?: { symbol: SymbolId; count: number; available?: number };
  paper?: { piecesNeeded: number; count: number };
  // C2 확장 (ADR-001): objective 'score'의 목표값 — 레퍼런스 스키마에는 없어 optional
  scoreGoal?: { score: number };
}

export interface LevelData {
  schema: string;
  seed: number;
  config: LevelConfigData;
  pool: SymbolId[];
  active: SymbolId[];
  deckStock: SymbolId[][];
  cards: LevelCardData[];
  coverage: { id: number; coveredBy: number[] }[];
  rules?: LevelRules | null;
  [extra: string]: unknown; // difficulty/metrics/evaluation/economy 등은 통과 허용
}

// 로더가 정규화한 런타임 표현 — cards[i].id === i 보장
export interface RuntimeLevel {
  cards: LevelCardData[];
  coveredBy: number[][];
  pool: SymbolId[];
  initialActive: SymbolId[];
  deckStock: SymbolId[][];
  k: number;
  r: number;
  cgoal: number;
  deck: number;
  wild: number;
  moveLimit: number; // 0 = 무한
  collectGoal: { symbol: SymbolId; count: number } | null;
  paperNeed: number;
  scoreGoal: number | null;
  seed: number;
}
