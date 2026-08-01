// combo-match/level@2 스키마 타입 — 단일 진실: design/combo-match-core.md §8
// 용어: 마스터의 "액티브 카드" = 구 GDD의 "스포트라이트" (코드는 마스터 용어를 따른다)
export type SymbolId = string;

// 입력 스키마의 카드 — F계층 필드는 optional이다. level@1(디자이너 구버전 export)에는
// 아예 없고, 레퍼런스 구현도 `||0` / `||[]` / `!!`로 정규화해 받아들인다.
export interface LevelCardData {
  id: number;
  x: number;
  y: number;
  layer: number;
  symbols: SymbolId[]; // 1~6개 (D-1: k 가변)
  lockReq?: number; // 콤보 잠금 — 현재 콤보 ≥ n일 때만 제거 가능 (0 = 없음)
  faceDown?: boolean; // 인간 전용 지각 난이도 — 엔진 규칙에 영향 없음
  unlockedBy?: number[]; // 열쇠 카드 id — 전부 제거되어야 선택 가능
  bombCounter?: number; // 0 = 폭탄 아님. 모든 행동마다 −1, 0이면 즉시 패배
  zone?: number; // 0..2 — 낮은 구역 소진 후 다음 구역 개방
  paper?: boolean; // 종이 — 조각 수집 전 선택 불가
  piece?: boolean; // 조각 — 제거 시 수집
}

// 로더가 정규화한 카드 — 엔진은 전 필드가 채워진 이 형태만 다룬다
export interface RuntimeCard {
  id: number;
  x: number;
  y: number;
  layer: number;
  symbols: SymbolId[];
  lockReq: number;
  faceDown: boolean;
  unlockedBy: number[];
  bombCounter: number;
  zone: number;
  paper: boolean;
  piece: boolean;
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
  // G계층 콤보 보상 트랙 (마스터 §4.4·§5.1-G) — 콤보가 at에 도달하면 레벨당 1회 지급.
  // 디자이너 스키마는 hint/claw도 허용하나 엔진은 즉시 사용형(wild/gold/deck)만 지급한다.
  comboRewards?: { at: number; item: string }[];
  // 🚫 노-리피트: 직전 매칭에 사용한 심볼은 다음 매칭에 사용 불가 (드로우 시 해제)
  noRepeat?: boolean;
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
  cards: RuntimeCard[];
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
  // 엔진이 지급 가능한 즉시 사용형 보상만 남긴다 (hint/claw는 로더가 걸러냄 — 엔진 갭)
  comboRewards: { at: number; item: 'wild' | 'gold' | 'deck' }[];
  noRepeat: boolean;
  seed: number;
}
