import { Emitter } from './events';
import { mulberry32, shuffled, type Rng } from './rng';
import type { RuntimeCard, RuntimeLevel, SymbolId } from './types';

// 규칙의 단일 진실: design/combo-match-core.md §4 + tools/level-designer.html runOneSim()
// (동작 동치 — 차등 테스트 tests/differential.test.ts가 검증. 규칙 변경은 ADR 필요)

export type EngineStatus = 'playing' | 'won' | 'lost';
export type EndReason =
  | 'board-cleared'
  | 'collect-goal'
  | 'score-goal'
  | 'bomb-exploded'
  | 'move-limit'
  | 'collect-unmet';
export type RejectReason =
  | 'game-over'
  | 'not-found'
  | 'covered'
  | 'zone-locked'
  | 'key-locked'
  | 'paper-locked'
  | 'combo-locked'
  | 'no-shared-symbol'
  | 'deck-empty'
  | 'no-wild';
export type ActiveSource = 'match' | 'draw' | 'wildcard';

export type ActionResult = { ok: true } | { ok: false; reason: RejectReason };
export type DrawResult =
  | { ok: true; active: SymbolId[]; remaining: number }
  | { ok: false; reason: RejectReason };

export interface EngineEvents extends Record<string, unknown> {
  cardRemoved: { id: number; via: 'match' | 'wildcard' | 'claw' };
  cardUncovered: { id: number };
  activeChanged: { active: SymbolId[]; source: ActiveSource };
  comboChanged: { combo: number };
  scoreChanged: { score: number; delta: number };
  deckChanged: { remaining: number };
  bombTicked: { id: number; counter: number };
  matchRejected: { id: number; reason: RejectReason };
  pieceCollected: { pieces: number; needed: number };
  paperFreed: { pieces: number };
  collectProgress: { collected: number; count: number };
  // 🎁 콤보 보상 트랙 도달 (레벨당 1회) — wild/deck는 엔진 상태에 즉시 반영, gold는 세션 계층(지갑)이 지급
  rewardEarned: { at: number; item: 'wild' | 'gold' | 'deck'; amount: number; wildLeft: number; deckLeft: number };
  gameEnded: { result: 'won' | 'lost'; reason: EndReason };
}

export const GOLD_REWARD_AMOUNT = 50; // 마스터 §5.1-G: 🪙 골드 +50

export interface EngineOpts {
  rng?: Rng;
  // 스톡 고갈 시 드로우 카드 생성 훅 — 기본: 풀 셔플 후 k개 (레퍼런스 drawActive 동일).
  // 트레이스 재생 테스트가 기록된 드로우를 주입하는 결정성 이음새.
  drawFallback?: (pool: readonly SymbolId[], k: number) => SymbolId[];
}

export function shareCount(a: readonly SymbolId[], b: readonly SymbolId[]): number {
  let n = 0;
  const s = new Set(a);
  for (const x of b) if (s.has(x)) n++;
  return n;
}

export class ComboMatchEngine {
  readonly events = new Emitter<EngineEvents>();

  private readonly L: RuntimeLevel;
  private readonly drawFallback: (pool: readonly SymbolId[], k: number) => SymbolId[];
  private readonly removed: boolean[];
  private removedCount = 0;
  private activeSymbols: SymbolId[];
  private readonly stock: SymbolId[][]; // 레퍼런스와 동일하게 끝(pop)부터 소진
  private deckLeft: number;
  private wildLeft: number;
  private comboV = 0;
  private movesV = 0;
  private scoreV = 0;
  private collectedV = 0;
  private piecesV = 0;
  private readonly bombs: { id: number; counter: number }[];
  private readonly rewards: { at: number; item: 'wild' | 'gold' | 'deck' }[];
  private readonly rewardGot: boolean[];
  private readonly zoneRemaining: number[] = [0, 0, 0, 0];
  private maxZone = 0;
  private statusV: EngineStatus = 'playing';
  private endReasonV: EndReason | null = null;

  constructor(level: RuntimeLevel, opts: EngineOpts = {}) {
    this.L = level;
    const rng = opts.rng ?? mulberry32(level.seed >>> 0);
    this.drawFallback = opts.drawFallback ?? ((pool, k) => shuffled(pool, rng).slice(0, k));
    this.removed = level.cards.map(() => false);
    this.activeSymbols = level.initialActive.slice();
    this.stock = level.deckStock.map((s) => s.slice());
    this.deckLeft = level.deck;
    this.wildLeft = level.wild;
    // 폭탄 틱 순서 = 카드 id 오름차순 (레퍼런스 bombs 배열 구축 순서와 동일 — 폭발 판정에 영향)
    this.bombs = level.cards
      .filter((c) => c.bombCounter > 0)
      .map((c) => ({ id: c.id, counter: c.bombCounter }));
    this.rewards = level.comboRewards.map((r) => ({ ...r }));
    this.rewardGot = this.rewards.map(() => false);
    for (const c of level.cards) {
      this.zoneRemaining[c.zone] = (this.zoneRemaining[c.zone] ?? 0) + 1;
      if (c.zone > this.maxZone) this.maxZone = c.zone;
    }
  }

  // ---- 질의 ----
  get status(): EngineStatus {
    return this.statusV;
  }
  get endReason(): EndReason | null {
    return this.endReasonV;
  }

  getState() {
    return {
      status: this.statusV,
      endReason: this.endReasonV,
      active: this.activeSymbols.slice(),
      combo: this.comboV,
      moves: this.movesV,
      score: this.scoreV,
      deck: this.deckLeft,
      wild: this.wildLeft,
      collected: this.collectedV,
      pieces: this.piecesV,
      removedCount: this.removedCount,
      total: this.L.cards.length,
      // 🎁 보상 트랙 상태 — HUD가 "무엇을 언제 받는지/받았는지"를 그대로 그린다
      rewards: this.rewards.map((r, i) => ({ at: r.at, item: r.item, got: this.rewardGot[i] === true })),
    };
  }

  isRemoved(id: number): boolean {
    return this.removed[id] === true;
  }

  isFree(id: number): boolean {
    const cb = this.L.coveredBy[id];
    if (!cb) return false;
    return cb.every((c) => this.removed[c]);
  }

  // 인간 지각용: faceDown 카드는 free가 되기 전까지 심볼 미공개 (규칙 영향 없음)
  isRevealed(id: number): boolean {
    const card = this.L.cards[id];
    if (!card) return false;
    return !card.faceDown || this.isFree(id);
  }

  private activeZone(): number {
    for (let z = 0; z <= this.maxZone; z++) {
      if ((this.zoneRemaining[z] ?? 0) > 0) return z;
    }
    return this.maxZone;
  }

  private unlockOk(card: RuntimeCard): boolean {
    return card.unlockedBy.every((k) => this.removed[k]);
  }

  private rejectReasonFor(id: number, viaWild: boolean): RejectReason | null {
    if (this.statusV !== 'playing') return 'game-over';
    const card = this.L.cards[id];
    if (!card || this.removed[id]) return 'not-found';
    if (!this.isFree(id)) return 'covered';
    if (card.zone > this.activeZone()) return 'zone-locked';
    if (!this.unlockOk(card)) return 'key-locked';
    if (card.paper && this.piecesV < this.L.paperNeed) return 'paper-locked';
    if (!viaWild) {
      // ⚠️ 레퍼런스 준거: 와일드는 lockReq·r 판정을 우회한다 (ADR-001 O-5① — 문서 §4.2와 상이)
      if (this.comboV < card.lockReq) return 'combo-locked';
      if (shareCount(card.symbols, this.activeSymbols) < this.L.r) return 'no-shared-symbol';
    }
    return null;
  }

  // 하이라이트 상시 표시는 폐기(D-2) — 이 API는 힌트 아이템·튜토리얼·시뮬레이션 전용
  getMatchableIds(): number[] {
    if (this.statusV !== 'playing') return [];
    const out: number[] = [];
    for (let i = 0; i < this.L.cards.length; i++) {
      if (this.rejectReasonFor(i, false) === null) out.push(i);
    }
    return out;
  }

  getWildableIds(): number[] {
    if (this.statusV !== 'playing') return [];
    const out: number[] = [];
    for (let i = 0; i < this.L.cards.length; i++) {
      if (this.rejectReasonFor(i, true) === null) out.push(i);
    }
    return out;
  }

  // 막힘 = 유효 매치 없음 ∧ 덱 소진 ∧ (와일드 없음 ∨ 와일드 대상 없음). 패배 선언은 세션 계층 소유(소프트 실패 D-5)
  isStuck(): boolean {
    if (this.statusV !== 'playing') return false;
    if (this.getMatchableIds().length > 0) return false;
    if (this.deckLeft > 0) return false;
    return this.wildLeft <= 0 || this.getWildableIds().length === 0; // useWild 가드(<=0)와 동일 극성 (감사)
  }

  // ---- 행동 ----
  tryMatch(id: number): ActionResult {
    const reason = this.rejectReasonFor(id, false);
    if (reason) {
      this.events.emit('matchRejected', { id, reason });
      return { ok: false, reason };
    }
    this.executeRemoval(this.L.cards[id]!, 'match');
    return { ok: true };
  }

  draw(): DrawResult {
    if (this.statusV !== 'playing') return { ok: false, reason: 'game-over' };
    if (this.deckLeft <= 0) return { ok: false, reason: 'deck-empty' };
    this.deckLeft--;
    this.events.emit('deckChanged', { remaining: this.deckLeft });
    if (this.comboV !== 0) {
      this.comboV = 0;
      this.events.emit('comboChanged', { combo: 0 });
    }
    const next = this.stock.length > 0 ? this.stock.pop()! : this.drawFallback(this.L.pool, this.L.k);
    this.activeSymbols = next.slice();
    this.events.emit('activeChanged', { active: this.activeSymbols.slice(), source: 'draw' });
    this.tickBombs();
    return { ok: true, active: this.activeSymbols.slice(), remaining: this.deckLeft };
  }

  useWild(id: number): ActionResult {
    if (this.statusV !== 'playing') return { ok: false, reason: 'game-over' };
    if (this.wildLeft <= 0) return { ok: false, reason: 'no-wild' };
    const reason = this.rejectReasonFor(id, true);
    if (reason) return { ok: false, reason };
    this.wildLeft--;
    this.executeRemoval(this.L.cards[id]!, 'wildcard');
    return { ok: true };
  }

  // 🧲 집게 — 모든 게이트 무시, 콤보·액티브 유지 (마스터 §4.3).
  // 미명세 가정(ADR-001 O-5②): 수집 카운트 O, moves 차감 X, 점수 없음. 폭탄은 행동이므로 틱(§4.2).
  useClaw(id: number): ActionResult {
    if (this.statusV !== 'playing') return { ok: false, reason: 'game-over' };
    const card = this.L.cards[id];
    if (!card || this.removed[id]) return { ok: false, reason: 'not-found' };
    this.removeCardState(card, 'claw');
    if (this.checkCollectAfterRemoval(card)) return { ok: true };
    if (this.tickBombs()) return { ok: true };
    this.checkClearedAfterRemoval();
    return { ok: true };
  }

  addWild(n: number): void {
    this.wildLeft += n;
  }

  // ---- 내부 ----
  // 제거 공통부: 상태·구역·조각·언커버 이벤트 (액티브·점수는 경로별)
  private removeCardState(card: RuntimeCard, via: 'match' | 'wildcard' | 'claw'): void {
    const wasFree = new Set<number>();
    for (const c of this.L.cards) {
      if (!this.removed[c.id] && c.id !== card.id && this.isFree(c.id)) wasFree.add(c.id);
    }
    this.removed[card.id] = true;
    this.removedCount++;
    this.zoneRemaining[card.zone] = (this.zoneRemaining[card.zone] ?? 1) - 1;
    this.events.emit('cardRemoved', { id: card.id, via });
    for (const c of this.L.cards) {
      if (!this.removed[c.id] && this.isFree(c.id) && !wasFree.has(c.id)) {
        this.events.emit('cardUncovered', { id: c.id }); // id 오름차순 (cards 순회 순서)
      }
    }
    if (card.piece) {
      this.piecesV++;
      this.events.emit('pieceCollected', { pieces: this.piecesV, needed: this.L.paperNeed });
      if (this.piecesV === this.L.paperNeed) this.events.emit('paperFreed', { pieces: this.piecesV });
    }
  }

  private checkCollectAfterRemoval(card: RuntimeCard): boolean {
    const goal = this.L.collectGoal;
    if (goal && card.symbols.includes(goal.symbol)) {
      this.collectedV++;
      this.events.emit('collectProgress', { collected: this.collectedV, count: goal.count });
      if (this.collectedV >= goal.count) {
        this.end('won', 'collect-goal'); // 레퍼런스: 수집 조기 승리가 폭탄 틱보다 선행
        return true;
      }
    }
    return false;
  }

  private checkClearedAfterRemoval(): void {
    if (this.removedCount === this.L.cards.length) {
      const goal = this.L.collectGoal;
      if (goal && this.collectedV < goal.count) this.end('lost', 'collect-unmet');
      else this.end('won', 'board-cleared');
    }
  }

  private executeRemoval(card: RuntimeCard, via: 'match' | 'wildcard'): void {
    this.removeCardState(card, via);
    this.activeSymbols = card.symbols.slice();
    this.events.emit('activeChanged', { active: this.activeSymbols.slice(), source: via });

    let delta: number;
    if (via === 'match') {
      this.comboV++;
      this.events.emit('comboChanged', { combo: this.comboV });
      this.checkComboRewards(); // 레퍼런스 준거: 콤보 증가 직후 지급 (match 경로)
      delta = 10 * this.comboV;
      // cgoal 보너스 = 점수만 (ADR-001 O-1 — 아이템 지급은 별도 보상 트랙 §5.1-G가 담당하도록 개정)
      if (this.L.cgoal && this.comboV % this.L.cgoal === 0) delta += 100 * this.comboV;
    } else {
      const prev = this.comboV;
      this.comboV = Math.max(1, this.comboV); // 와일드는 콤보 유지 (최소 1)
      if (this.comboV !== prev) this.events.emit('comboChanged', { combo: this.comboV });
      this.checkComboRewards(); // 레퍼런스 준거: 와일드 경로도 지급 검사
      delta = 10 * this.comboV; // 레퍼런스: 와일드 경로는 cgoal 보너스 없음
    }
    this.scoreV += delta;
    this.events.emit('scoreChanged', { score: this.scoreV, delta });
    this.movesV++;

    if (this.checkCollectAfterRemoval(card)) return;
    if (this.L.scoreGoal !== null && this.scoreV >= this.L.scoreGoal) {
      this.end('won', 'score-goal'); // C2 확장 — 레퍼런스 시뮬에는 없는 목표 유형 (ADR-001)
      return;
    }
    if (this.tickBombs()) return;
    // 레퍼런스 준거: 이동 제한 검사는 match 경로에만 존재 (wild 경로는 검사 없음)
    if (
      via === 'match' &&
      this.L.moveLimit > 0 &&
      this.movesV >= this.L.moveLimit &&
      this.removedCount < this.L.cards.length
    ) {
      this.end('lost', 'move-limit');
      return;
    }
    this.checkClearedAfterRemoval();
  }

  // 🎁 콤보 보상 트랙 — 레퍼런스 checkRewards와 동일: combo ≥ at인 미지급 항목을 순서대로 지급(레벨당 1회).
  // wild/deck는 엔진 재고에 즉시 반영(봇·플레이 모두 바로 사용 가능), gold는 이벤트만 — 지갑은 세션 계층 소유.
  private checkComboRewards(): void {
    for (let i = 0; i < this.rewards.length; i++) {
      if (this.rewardGot[i] || this.comboV < this.rewards[i]!.at) continue;
      this.rewardGot[i] = true;
      const r = this.rewards[i]!;
      let amount = GOLD_REWARD_AMOUNT;
      if (r.item === 'wild') {
        this.wildLeft++;
        amount = 1;
      } else if (r.item === 'deck') {
        this.deckLeft++;
        amount = 1;
        this.events.emit('deckChanged', { remaining: this.deckLeft });
      }
      this.events.emit('rewardEarned', {
        at: r.at,
        item: r.item,
        amount,
        wildLeft: this.wildLeft,
        deckLeft: this.deckLeft,
      });
    }
  }

  // 레퍼런스 동일: id 오름차순 틱, 첫 폭발에서 즉시 중단 (잔여 폭탄은 이번 행동에 틱되지 않음)
  private tickBombs(): boolean {
    for (const b of this.bombs) {
      if (this.removed[b.id]) continue;
      b.counter--;
      this.events.emit('bombTicked', { id: b.id, counter: b.counter });
      if (b.counter <= 0) {
        this.end('lost', 'bomb-exploded');
        return true;
      }
    }
    return false;
  }

  private end(result: 'won' | 'lost', reason: EndReason): void {
    if (this.statusV !== 'playing') return;
    this.statusV = result;
    this.endReasonV = reason;
    this.events.emit('gameEnded', { result, reason });
  }
}
