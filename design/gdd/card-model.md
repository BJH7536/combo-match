# card-model (카드/보드 데이터 모델)

> ✅ **2026-07-26 구현 완료 — 이 문서는 설계 의도 기록이다.**
> 실제 동작의 진실은 코드(`src/core/types.ts`(LevelCardData·RuntimeCard) · `src/core/engine.ts`(제거·개방 상태)), 규칙의 진실은 마스터 GDD(`design/combo-match-core.md`)다.
> 구현은 `runOneSim()` 동작 동치로 검증했고(테스트 123개) 이후 독립 감사 27건과 기능 추가가
> 누적되어 **본문 세부와 코드가 다를 수 있다.** 코드를 고칠 때 이 문서를 기준으로 삼지 말 것.
> 현재 구현 현황은 `design/gdd/systems-index.md`를 볼 것.

> ⚠️ **2026-07-26 마스터 정렬**: 기획 GDD `design/combo-match-core.md` 채택으로 본 문서
> 일부 계약이 대체됨 (C3: symbols 가변 1~6, C12: 장치 필드 7종 추가) — 전문은
> `production/adr/ADR-001-master-alignment.md`. 충돌 시 마스터 우선, 본문 개정은 구현과 병행.

> **Status**: Revised (2026-07-25 design-review 지적 23건 반영 — 재리뷰 대기)
> **Author**: 사용자 + Claude (design-system)
> **Last Updated**: 2026-07-25
> **Supports Pillars**: Pillar 1·3의 전제 조건 제공 (직접 구현이 아니라 데이터 토대 — Player Fantasy 참조)

## Overview

card-model은 게임의 모든 카드 상태를 표현하는 **순수 데이터 계층**이다. 카드(과일 심볼
2개의 비순서 쌍), 피라미드 보드 레이아웃(행별 배치와 가림 관계), 카드의 3상태(covered /
uncovered / removed)와 개방 판정 규칙을 정의한다. 플레이어가 직접 상호작용하지 않는
인프라 시스템이며, board-generator(생성), matching(판정), deck-draw(공급),
scoring·hud-ui(구독) 등 6개 시스템이 이 모델을 읽고 쓴다. 이 시스템이 없으면 "지금 어떤
카드를 고를 수 있는가"라는 게임의 기본 질문에 답할 수 없다.

**포함하지 않는 것**: 렌더링/연출(hud-ui·vfx-juice 소유), 매칭 규칙 판정(matching 소유),
생성 알고리즘(board-generator 소유).

## Player Fantasy

플레이어에게 직접 체감되지 않는 "보이지 않는 인프라"다. 다만 개방 판정의 정확성과
즉시성이 두 필러의 전제 조건이 된다:

- Pillar 1 "아늑한 촉감" — 카드를 집었을 때 어긋남 없는 즉각 반응
- Pillar 3 "막히지 않는 진행" — 선택 가능한 카드가 항상 올바르게 표시됨

플레이어가 이 시스템의 존재를 인지하는 순간은 버그가 났을 때뿐이어야 한다.

## Detailed Design

### Core Rules

1. **타입 계약** (TypeScript strict 기준 — 하류 공유 계약):

   ```ts
   type SymbolId = string;                     // 예: 'orange', 'grape'

   interface CardData {                        // 덱·보드 공용 — deck-draw는 이 타입만 사용
     id: string;                               // 전역 고유 (로드 시 중복 검증)
     symbols: readonly [SymbolId, SymbolId];   // 길이 2 고정 튜플 — Set 아님 (🍊🍊 보존)
   }

   interface BoardCard extends CardData {      // 보드 소속 카드에만 존재하는 필드
     slotId: string;
     state: 'covered' | 'uncovered' | 'removed';
   }
   ```

   같은 심볼 2개인 카드는 허용하되(튜플이므로 붕괴 없음), 실제 분포 제약은
   board-generator 정책이다.
2. **Symbol**: `SymbolId`는 문자열 id. 유효 심볼 목록은 level-config가 제공하며
   card-model은 검증만 한다. **데모용 8종**: `strawberry, orange, lemon, grape,
   watermelon, cherry, kiwi, peach` (ui_draft.html 이모지 대응 — AC의 기준선).
3. **BoardLayout**: 슬롯 목록. 각 슬롯 = `slotId`, `position`(렌더 힌트 좌표),
   **`covers: slotId[]`** — 이 슬롯의 카드가 가리는 뒷줄 슬롯들. 가림 관계는 기하 계산이
   아니라 **명시 데이터**다 (2026-07-25 결정). 역방향 인덱스 `coveredBy`는 로드 시 파생한다.
4. **개방 불변식**: 카드가 uncovered ⟺ 자신을 가리는(`coveredBy`) 모든 카드가 removed.
   covered→uncovered 전이는 `removeCard()`의 부수효과로 **모델이 자동 재계산**한다
   (2026-07-25 결정). 카드는 한번 개방되면 다시 가려지지 않는다.
5. **제거**: `removeCard(id): RemoveResult` — **예외를 던지지 않는다**.
   - 성공: `{ ok: true, removed: BoardCard, uncovered: BoardCard[] }` (이번 호출로 새로
     개방된 카드 목록을 동기 반환 — 이벤트와 동일 정보)
   - 거부: `{ ok: false, reason: 'not-found' | 'not-uncovered' }` + 경고 로그, 상태 불변.
     클릭 연타가 정상 플로우이므로 거부는 예외가 아니라 결과값이다 (Edge Cases #1 정합).
   제거는 되돌릴 수 없다 (undo는 해커톤 스코프 밖 — Open Questions 참조).
6. **생성·질의 API**:
   - `createBoardState(layout: BoardLayout, cards: CardData[], validSymbols: SymbolId[]): BoardState`
     — 유일한 생성 진입점. `validSymbols`는 level-config가 공급하는 유효 심볼 목록으로,
     "유효 목록에 없는 심볼" 검증의 입력 채널이다 (2026-07-25 level-config 리뷰로 시그니처
     개정). 검증 실패 시 `BoardLoadError` throw (로드만 fail-fast 예외).
     **배정 계약: `cards[i]`는 `layout.slots[i]`에 배정된다** (인덱스 일치 —
     board-generator와 공유하는 순서 계약, 2026-07-25 board-generator 리뷰 반영).
     **초기 state는 인자로 받지 않는다** — 개방 불변식(Formulas #1)으로 모델이 파생한다.
     초기 상태의 권위는 모델이며, board-generator는 layout+cards만 공급한다.
   - `getAllCards(): readonly BoardCard[]` — **covered 포함 전체** 반환. hud-ui의 초기
     렌더용 (시안에서 covered 카드도 심볼이 노출되므로 face-down이 아니다).
   - `getUncoveredCards()`, `getRemainingCount()`, `isEmpty()`.
   - `getCard(id: string): BoardCard | undefined` — id 단건 조회 (removed 포함 전 상태).
     matching의 `tryMatch` 조회 단계가 요구 (2026-07-26 matching 리뷰로 추가).
7. **이벤트 계약** (Phaser EventEmitter, 페이로드는 해당 `BoardCard`):
   - **발행 순서(결정적)** — `removeCard` 성공 1회당:
     ① `cardRemoved(card)` 1회 → ② `cardUncovered(card)` 새로 개방된 카드마다 1회,
     **slotId 오름차순** → ③ 보드가 비었으면 `boardCleared()` 1회.
   - 다중 동시 개방은 실재한다: 데모에서 r4c1·r4c3 제거 후 r4c2 제거 시 r3c1·r3c2가
     한 번에 개방 → `cardUncovered` 2회 (r3c1 → r3c2 순).
   - 모든 이벤트는 상태 전이가 **완전히 끝난 후** 동기 발행 — 핸들러가 재진입 질의를
     해도 항상 일관된 최종 상태를 본다.
   - 구독자: hud-ui / vfx-juice / audio / scoring-winlose.

**데모 레이아웃 (1-2-3-4 피라미드, 10슬롯, ui_draft.html 기준)** — 브릭 패턴:

| 슬롯 | covers (가리는 슬롯) | 초기 상태 |
|------|---------------------|----------|
| r1c1 | — | covered |
| r2c1 | r1c1 | covered |
| r2c2 | r1c1 | covered |
| r3c1 | r2c1 | covered |
| r3c2 | r2c1, r2c2 | covered |
| r3c3 | r2c2 | covered |
| r4c1 | r3c1 | **uncovered** |
| r4c2 | r3c1, r3c2 | **uncovered** |
| r4c3 | r3c2, r3c3 | **uncovered** |
| r4c4 | r3c3 | **uncovered** |

초기 상태에서 row 4만 개방 — 시안의 표현(뒷줄 흐림 처리)과 일치.

### States and Transitions

| 상태 | 정의 | 진입 | 이탈 |
|------|------|------|------|
| covered | 가리는 카드 중 미제거 존재 | 초기 배치 | → uncovered (자동 재계산) |
| uncovered | 가리는 카드 전부 제거(또는 없음) | covered에서 자동 / 초기(앞줄) | → removed (`removeCard`) |
| removed | 보드에서 제거됨 | `removeCard()` | 종결 (전이 없음) |

**금지 전이**: removed→*, uncovered→covered.

### Interactions with Other Systems

> ⚠️ 하류 시스템이 전부 미설계 상태이므로 아래는 **잠정 계약**이다. 각 시스템 GDD 설계
> 시 이 표를 기준으로 검증하고, 변경 시 이 문서를 갱신할 것.

| 시스템 | 방향 | 인터페이스 |
|--------|------|-----------|
| board-generator | → 모델 | `createBoardState(layout, cards, validSymbols)` 호출로 구성 (`cards[i]`↔`slots[i]` 인덱스 일치 계약) — 초기 state는 모델이 파생(권위: 모델). 검증 항목은 Edge Cases #3 |
| matching | ↔ | `getCard(id)`·`getUncoveredCards()` 질의, 매치 성공 시 `removeCard()` 호출 |
| deck-draw | 공유 | `CardData` 타입 공유 — `slotId`/`state`는 `BoardCard` 전용이라 덱 카드에는 아예 없음(옵셔널 문제 해소). 덱 컬렉션 자체는 deck-draw 소유 |
| level-config | → 모델 | BoardLayout + 유효 심볼 목록 — `createBoardState`의 `layout`·`validSymbols` 인자로 유입 |
| hud-ui / vfx-juice / audio | ← | 이벤트 구독 (`cardUncovered`, `cardRemoved`, `boardCleared`) |
| scoring-winlose | ← | `boardCleared` 이벤트, `getRemainingCount()` |

## Formulas

1. **개방 판정**: `uncovered(c) ⟺ ∀x ∈ coveredBy(c) : state(x) = removed`
2. **데모 레이아웃 좌표 공식** (렌더 힌트, ui_draft.html 좌표에서 역산):
   row K(1~4), col j(1~K)에 대해
   - `x = 25 + (4−K)·108 + (j−1)·216`
   - `y = 8 + (K−1)·38`
   - 검증: r4 → x∈{25, 241, 457, 673}, y=122 · r1 → x=349, y=8 — 시안의 **로컬 DOM
     좌표**와 일치
   - 카드 크기 108×134 (로컬), 행간 y 간격 38px. 데모 좌표에서 카드끼리 실제 픽셀 겹침은
     없다(브릭 접합 — 모서리만 접촉). **가림은 순수 논리 관계이며 시각적 오클루전이 아니다.**
   - **좌표계 주의**: 위 수치는 806×264 보드 로컬 좌표계다. 시안(ui_draft.html)은 이
     래퍼에 `scale(0.8)`을 적용하므로 화면상 카드는 86.4×107.2로 보인다. 화면 배치·스케일
     결정은 app-shell/hud-ui 소관 — **이 수치를 렌더 크기로 직접 쓰지 말 것.**
   - **주의**: 좌표는 표시용 힌트일 뿐, 가림 로직은 covers 데이터만 사용한다
3. **슬롯 수**: 데모 N=10 (1+2+3+4). 레이아웃당 슬롯 상한 32 (Tuning Knobs 참조)

## Edge Cases

1. **부적격 제거 호출**: `removeCard(covered/removed/미존재)` → `{ ok: false, reason }`
   반환, 상태 불변, 경고 로그 — **예외 아님** (Core Rules #5). 더블클릭 연타는 두 번째
   호출이 자연 거부됨 (입력 디바운스는 hud-ui 책임으로 위임).
2. **마지막 카드 제거**: 이벤트 순서 보장 — `cardRemoved` 발행 후 `boardCleared` 발행.
3. **레이아웃 로드 검증 (fail-fast, `BoardLoadError`)**: covers가 미존재 슬롯 참조 /
   covers 그래프 순환(DAG 검증) / 슬롯·카드 수 불일치 / **슬롯 id 중복 / 카드 id 중복 /
   카드의 slotId 중복 배정** / 유효 목록에 없는 심볼 / **슬롯 수 상한(32) 초과** → 로드
   즉시 실패 + 명확한 에러 메시지.
4. **빈 보드 질의**: `getUncoveredCards() = []`, `isEmpty() = true` — 정상 동작 (에러 아님).
5. **같은 심볼 2개 카드**(예: 🍊🍊): 모델은 허용하며 `symbols`는 길이 2 튜플이므로
   `['orange','orange']`로 보존된다 (Set 붕괴 없음). 공유 판정("한쪽 심볼 중 하나라도
   상대에 존재")에는 영향 없음 — ✅ matching GDD에서 재확인 완료 (2026-07-25, 교집합
   판정으로 자연 처리 — matching AC #1 진리표에 포함).
6. **아무도 가리지 않는 뒷줄 카드**(coveredBy 빈 배열): 초기부터 uncovered — 변형
   레이아웃 지원을 위한 정상 케이스.

## Dependencies

| 시스템 | 방향 | 강도 | 인터페이스 요지 |
|--------|------|------|----------------|
| level-config | 상류 | soft→hard | 레이아웃+심볼 목록 공급. MVP 초기엔 하드코딩 데모 레이아웃으로 대체 가능, level-config 완성 시 hard로 전환 |
| board-generator | 하류 | hard | 모델 없이 생성 불가 — 초기 BoardState 구성 |
| matching | 하류 | hard | `getUncoveredCards()` 질의 + `removeCard()` 호출 |
| hud-ui | 하류 | hard | 상태·이벤트가 표시의 원천 |
| deck-draw | 하류 | soft | `CardData` 타입만 공유 |
| scoring-winlose | 하류 | soft | `boardCleared`·`getRemainingCount()` 구독 |
| vfx-juice / audio | 하류 | soft | 이벤트 구독 |

2026-07-25 design-review에서 systems-index와의 불일치(hud-ui·scoring·vfx·audio 행의
card-model 누락, card-model→level-config 엣지 누락)가 발견되어 **systems-index를 수정
반영**했다. 이후 의존 관계 변경 시 두 문서를 함께 갱신할 것.

## Tuning Knobs

| 노브 | 분류 | 기본값 | 안전 범위 | 과대 시 | 과소 시 | 상호작용 |
|------|------|--------|-----------|---------|---------|----------|
| 레이아웃 슬롯 상한 | gate | 32 | 4~32 | 화면 밀도·가독성 붕괴 | 레벨 다양성 제약 | 초과 레이아웃은 로드 거부(Edge Cases #3), hud-ui 카드 크기와 연동 |
| 데모 좌표 상수 (25/108/216/38) | feel | 시안 기준 | — | — | — | **로컬 좌표계** (Formulas #2 좌표계 주의) — hud-ui 이식 시 참조 |
| 유효 심볼 목록 | — | — | — | — | — | **level-config 소유** — 여기서는 포인터만 (중복 노브 금지) |

> **노브가 아닌 것**: 카드당 심볼 수는 타입 레벨 고정(`[SymbolId, SymbolId]`)이므로 데이터
> 노브가 아니다. 변경은 타입·matching·board-generator의 전면 재설계를 의미한다.

## Visual/Audio Requirements

N/A — 순수 데이터 계층. 시각/청각 표현은 하류 시스템(hud-ui, vfx-juice, audio)이 소유하며,
이 시스템은 이벤트(`cardUncovered`, `cardRemoved`, `boardCleared`)만 제공한다.

## UI Requirements

N/A — hud-ui 소유. 단, hud-ui는 이 문서의 데모 좌표 공식(Formulas #2)과 상태 정의를
표시의 단일 진실 원천으로 사용하되, **좌표는 로컬 좌표계**이므로 화면 스케일은 app-shell의
스테이지 스케일링을 따른다 (Formulas #2 좌표계 주의). 초기 렌더는 `getAllCards()`로
covered 카드를 포함한 전체를 그린다 (시안: covered 카드도 심볼 노출, face-down 아님).

## Acceptance Criteria

테스트 프레임워크: Vitest (technical-preferences.md "필수 테스트" 요구와 연결)

1. 데모 레이아웃 로드 → r4c1~r4c4만 uncovered, 나머지 6장 covered
2. r4c1만 제거 → r3c1은 여전히 covered (r4c2가 가림) · r4c1+r4c2 제거 → r3c1 uncovered
   전이 + `cardUncovered` 발행
3. covered/removed/미존재 카드에 `removeCard()` → `{ ok: false, reason }` 반환, 상태
   불변, **예외 없음**
4. 10장 전부 제거 → `cardRemoved` 10회 + `boardCleared` 1회, 발행 순서 보장
5. 불량 레이아웃 로드 → 전부 `BoardLoadError` 실패: 순환 covers / 미존재 참조 / 무효
   심볼 / 수 불일치 / **슬롯 id 중복 / 카드 id 중복 / slotId 중복 배정 / 슬롯 상한(32) 초과**
6. **다중 동시 개방**: r4c1·r4c3 제거 후 r4c2 제거 → `cardUncovered` 정확히 2회,
   r3c1 → r3c2 순(slotId 오름차순), `cardRemoved`가 선행
7. `getAllCards()`: 초기 로드 직후 covered 포함 10장 전체 반환 (hud-ui 초기 렌더 요건)
8. `getRemainingCount()`·`isEmpty()`: 초기 10 / false → 전부 제거 후 0 / true
9. 성능: `removeCard()` + 개방 재계산은 O(이웃 수) — 32슬롯 보드 기준 1ms 미만
   (60fps 프레임 예산 16.6ms 대비 무시 가능 수준)

## Open Questions

1. **undo 기능**: 준거 게임(디즈니 솔리테어)에는 Reverse Arrow 부스터가 존재. 도입 시
   removed→uncovered 역전이와 이벤트 설계가 필요해 현재 상태 기계와 충돌한다.
   — Owner: 사용자 / 결정 시점: Vertical Slice 이후
2. **변형 레이아웃**(트라이픽스식 3봉우리 등) 지원 시점: covers 데이터 구조는 이미
   지원하나, 저작 도구/공식이 없다. → **결정(2026-07-25, level-config 설계에서)**:
   Vertical Slice 10개 스테이지는 pyramid-10 단일 레이아웃으로 확정, 변형은 VS 이후 재론.
