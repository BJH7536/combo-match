# deck-draw (덱/드로우)

> ✅ **2026-07-26 구현 완료 — 이 문서는 설계 의도 기록이다.**
> 실제 동작의 진실은 코드(`src/core/engine.ts`(draw — 스톡 pop → 풀 셔플 폴백, 콤보 리셋)), 규칙의 진실은 마스터 GDD(`design/combo-match-core.md`)다.
> 구현은 `runOneSim()` 동작 동치로 검증했고(테스트 123개) 이후 독립 감사 27건과 기능 추가가
> 누적되어 **본문 세부와 코드가 다를 수 있다.** 코드를 고칠 때 이 문서를 기준으로 삼지 말 것.
> 현재 구현 현황은 `design/gdd/systems-index.md`를 볼 것.

> ⚠️ **2026-07-26 마스터 정렬**: 덱 모델이 **리드로우 카운터 + deckStock 우선, 스톡 고갈
> 시 풀 랜덤 k개**로 대체됨 (C8) — "고정 큐 소진=종결" 폐기. 전문은
> `production/adr/ADR-001-master-alignment.md`. 충돌 시 마스터 우선.

> **Status**: In Design
> **Author**: 사용자 + Claude (design-system)
> **Last Updated**: 2026-07-26
> **Implements Pillar**: Pillar 2 "끊기지 않는 연쇄의 쾌감"의 물리 장치 (드로우 = 콤보 희생 딜레마), Pillar 3 탈출 경로

## Overview

deck-draw는 **드로우 파일(뽑을 카드 더미)의 소유자**다. board-generator가 생성한
`deckCards`(순서 고정, 재셔플 없음)를 큐로 보관하고, 플레이어의 드로우 요청(`draw()`)에
다음 카드를 꺼내 matching의 `setSpotlightFromDraw()`로 전달하며, 잔량 질의와 소진 이벤트
(`deckExhausted`)를 제공한다. 시안 좌하단 덱 박스(↺ 22)의 데이터 원천이다.

**포함하지 않는 것**: 스포트라이트 보관(matching 소유), 콤보 리셋(matching의
`spotlightChanged(source:'draw')`가 전담 — deck-draw는 combo와 무결합), MOVES 차감·패배
판정(scoring-winlose 소유), 드로우 버튼 UI(hud-ui 소유).

## Player Fantasy

**"아껴 쓰는 비상구"** — 드로우는 언제나 열려 있는 탈출구지만, 쓸 때마다 콤보가 깨지고
덱이 줄어드는 대가를 치른다. 이 시스템의 감정적 역할은 Pillar 2의 딜레마("안전한 드로우
vs 콤보 유지 모험")를 물리적 자원으로 만들어주는 것이다.

줄어드는 덱 카운터는 스테이지의 시계이기도 하다 — 잔량이 얕아질수록 긴장이 오르고,
소진되는 순간 정산(scoring-winlose)이 온다. 체감 목표: 드로우가 "패배"가 아니라
"**의도적인 한 수**"로 느껴져야 한다.

## Detailed Design

### Core Rules

1. **생성**: `createDeck(deckCards: CardData[])` — board-generator의
   `GeneratedStage.deckCards`를 그대로 수신한다 (앱 부트스트랩이 호출). 배열 순서 =
   드로우 순서, 재셔플 없음 (board-generator Core Rules #5 준수). 수신 배열은 방어적
   복사 후 불변 취급.
2. **`draw(): DrawResult`** — Result 스타일 (프로젝트 일관 패턴, 예외 없음):
   - 성공: 큐 선두 카드를 꺼내 `{ ok: true, card: CardData, remaining: number }` 반환.
     반환 **전에** matching의 `setSpotlightFromDraw(card)`를 동기 호출한다 — 즉 draw()가
     리턴한 시점에는 스포트라이트 교체와 `spotlightChanged(source:'draw')` 발행이 이미
     끝나 있다.
   - 거부: 덱이 비어 있으면 `{ ok: false, reason: 'deck-empty' }` + 경고 로그, 상태
     불변 (2026-07-26 확정 — hud-ui가 잔량 0에서 버튼을 비활성화해 정상 플레이에서는
     도달하지 않는 방어 경로).
3. **질의**: `getDeckCount(): number` — hud-ui 덱 카운터(↺)의 표시 원천.
4. **이벤트**:
   - `deckChanged(remaining: number)` — 드로우 성공마다 1회 (hud-ui 카운터 갱신용)
   - `deckExhausted()` — 잔량이 0이 **되는 순간** 정확히 1회 (마지막 카드를 뽑은 draw()
     안에서, `deckChanged(0)` 직후). scoring-winlose의 정산(승패 판정) 트리거다.
   - 발행 순서 (draw 1회): `spotlightChanged(source:'draw')` (matching 경유) →
     `deckChanged(n)` → (n=0이면) `deckExhausted()`
5. **초기 스포트라이트는 이 시스템 소관이 아니다** — `GeneratedStage.initialSpotlight`는
   앱 부트스트랩이 `createMatching()`에 직접 전달한다 (matching Core Rules #2). 덱 큐에
   포함되지 않는다.

### States and Transitions

상태는 큐 잔량 하나다.

| 상태 | 정의 | 전이 |
|------|------|------|
| 잔량 n > 0 | 드로우 가능 | `draw()` 성공 → n−1 (n−1=0이면 `deckExhausted` 발행) |
| 잔량 0 | 소진 — 종결 상태 | `draw()` 항상 거부. 리필·재셔플 경로 없음 (MVP 확정) |

### Interactions with Other Systems

| 시스템 | 데이터 흐름 | 인터페이스 |
|--------|------------|-----------|
| board-generator | 수신 | `GeneratedStage.deckCards` → `createDeck` (부트스트랩 경유) |
| level-config | 간접 | `deckSize`는 board-generator가 이미 반영 — deck-draw는 배열 길이만 신뢰 (직접 참조 없음) |
| matching | 호출 | `draw()` 성공 시 `setSpotlightFromDraw(card)` 동기 호출 (matching GDD 계약 이행) |
| card-model | 타입 공유 | `CardData`만 사용 (slotId/state 없음 — card-model Interactions와 일치) |
| scoring-winlose | 이벤트 구독 | `deckExhausted`(정산 트리거) — 드로우 MOVES 차감은 `spotlightChanged(source:'draw')` 경유 (matching GDD 계약, 여기서 중복 발행하지 않음) |
| hud-ui | 이벤트 구독·질의 | `getDeckCount()`·`deckChanged` — 잔량 0이면 드로우 버튼 비활성화 (Core Rules #2 방어 계층) |
| audio / vfx-juice | 이벤트 구독 | `deckChanged`(드로우 연출) — soft |

## Formulas

1. **잔량**: `remaining = deckSize − 드로우 성공 횟수` — 단조 감소, 음수 불가.
2. 시안 정합 (참고): 스테이지 6 기준 `deckSize=22` (level-config Formulas #2). 시안의
   ↺22는 드로우 0회 시점의 표시다.
3. 그 외 수식 없음 — 순수 큐. 드로우 확률·기대 매치 수는 level-config P(k)·board-generator
   시뮬레이션 소유 (**포인터만, 중복 정의 금지**).

## Edge Cases

1. **빈 덱 `draw()`**: `{ ok: false, reason: 'deck-empty' }` + 경고 로그, 이벤트 발행
   없음, 상태 불변. 정상 플레이에서는 hud-ui 비활성화로 도달 불가 (방어 경로).
2. **마지막 카드 드로우**: 성공 처리 + `spotlightChanged` → `deckChanged(0)` →
   `deckExhausted()` 순서 보장. `deckExhausted`는 생애 정확히 1회.
3. **`createDeck([])`** (빈 배열): 허용 — 즉시 소진 상태로 시작하되 `deckExhausted`는
   **발행하지 않는다** (이벤트는 "0이 되는 순간" 전용 — 초기 0은 scoring이 부트스트랩
   시점에 `getDeckCount()`로 인지). level-config가 deckSize ≤ 0을 차단하므로 정상
   파이프라인에서는 도달 불가 (board-generator Edge Cases #3과 동일한 방어 관례).
4. **드로우 연타**: 각 호출이 독립 처리 — 동기·단일 스레드라 경쟁 없음. 잔량이 바닥나면
   자연 거부. (디바운스는 hud-ui 책임 — 프로젝트 관례)
5. **드로우와 매치의 상호 배제**: `draw()`와 `tryMatch()`는 둘 다 동기 완결이므로 교차
   실행 불가 — 별도 잠금 불필요 (명시).

## Dependencies

방향 컨벤션: 상류 = deck-draw가 의존하는 대상, 하류 = deck-draw에 의존하는 시스템
(matching GDD 2026-07-26 통일 컨벤션).

| 시스템 | 방향 | 강도 | 요지 |
|--------|------|------|------|
| card-model | 상류 | hard | `CardData` 타입 |
| board-generator | 상류 | hard | `deckCards` 공급 (부트스트랩 경유) |
| matching | 상류 | hard | `setSpotlightFromDraw` 호출 대상 |
| level-config | 상류 | 간접 | `deckSize`는 board-generator가 반영 — 직접 참조 없음 |
| scoring-winlose | 하류 | hard | `deckExhausted` 구독 (정산 트리거) |
| hud-ui | 하류 | hard | `getDeckCount()`·`deckChanged` |
| audio / vfx-juice | 하류 | soft | `deckChanged` |

2026-07-26 systems-index 대조: deck-draw 행(card-model, level-config, matching) 일치 ✓.
**level-config가 "간접"으로 격하된 것은 이번 설계의 신규 결정** — 인덱스는 hard로
표기되어 있으나 실 데이터 경로가 board-generator 경유임이 확인됨. 인덱스 주석으로 반영.

## Tuning Knobs

**노브 없음.** 유일한 수치(deckSize)는 level-config 소유 — 포인터만 (중복 노브 금지).
재셔플·리필 같은 잠재 노브는 MVP 스코프 밖이며 도입 시 이 문서의 상태 기계 개정이 필요하다
(Open Questions #1).

## Visual/Audio Requirements

N/A — `deckChanged` 이벤트만 제공. 드로우 연출(카드 넘김·사운드)은 vfx-juice/audio 소유.

## UI Requirements

N/A — hud-ui 소유. 단: 덱 카운터는 `getDeckCount()`/`deckChanged`를 단일 원천으로 하고,
**잔량 0이면 드로우 버튼을 비활성화**할 것 (Core Rules #2의 방어 계층 — 필수 요구).

## Acceptance Criteria

테스트 프레임워크: Vitest

1. `createDeck(n장)` → `getDeckCount()=n` · `draw()` k회 성공 후 잔량 n−k, 꺼낸 카드
   순서가 입력 배열 순서와 동일 (재셔플 없음)
2. `draw()` 성공 시 `setSpotlightFromDraw`가 해당 카드로 정확히 1회 호출됨 (matching
   모킹 통합 테스트) · 반환값 `{ok:true, card, remaining}` 정합
3. 이벤트 순서 (마지막 카드): `deckChanged(0)` → `deckExhausted()` — 그리고
   `deckExhausted`는 전 생애 1회
4. 빈 덱 `draw()` → `{ok:false, reason:'deck-empty'}`, 이벤트 0건, 상태 불변
5. `createDeck([])` → `deckExhausted` 미발행 + `getDeckCount()=0`
6. 성능: `draw()` O(1) (큐 선두 제거) — 0.1ms 미만

## Open Questions

1. **덱 리필/재셔플 구매**: 준거 게임은 코인으로 추가 카드 구매(계속하기)를 제공 —
   도입 시 "잔량 0 = 종결" 상태 기계와 `deckExhausted` 1회 보장의 개정 필요.
   — Owner: 사용자 / 시점: coin-economy GDD 설계 (Vertical Slice, game-concept OQ#6 연동)
2. **드로우 버튼의 시안 위치 확정**: 시안의 덱 박스(↺) 자체가 버튼인지 별도 버튼인지 —
   Owner: 사용자 / 시점: hud-ui GDD 설계
