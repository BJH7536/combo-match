# matching (매칭 판정 & 스포트라이트)

> ⚠️ **2026-07-26 마스터 정렬**: 판정이 `공유 ≥ r`(노브)로 일반화되고(C3), 게이트 5종
> (free·열쇠·구역·종이·콤보잠금) 선행 판정이 추가되며(C12), **상시 하이라이트 폐기**(C1 —
> 무표시+유료 힌트, 튜토리얼 예외). 레퍼런스: `runOneSim()`의 gateOk/valid 판정. 전문은
> `production/adr/ADR-001-master-alignment.md`. 충돌 시 마스터 우선.

> **Status**: Revised (2026-07-26 design-review 지적 24건 반영 — 재리뷰 보류)
> **Author**: 사용자 + Claude (design-system)
> **Last Updated**: 2026-07-25
> **Implements Pillar**: Pillar 2 "끊기지 않는 연쇄의 쾌감" (코어 판정), Pillar 3 (유효 수 계산 = 하이라이트·데드락 감지 원천)

## Overview

matching은 코어 룰("같은 그림 찾기")의 **판정·집행 시스템**이자 **스포트라이트 상태의
소유자**다. 플레이어의 카드 선택을 `tryMatch()`로 검증·집행하고(공유 판정 → card-model
제거 → 스포트라이트 교체), `getMatchableCards()`로 하이라이트와 **유효 수 감지**의 단일
원천을 제공하며, 판정 함수 `sharesSymbol()`을 순수 함수로 공개해 board-generator의 I1
검사가 재사용한다. (유효 수 0은 데드락이 아니다 — 최종 데드락 판정(유효 수 0 **AND** 덱 0)
은 덱 잔량이 필요하므로 scoring-winlose가 소유한다. Core Rules #5 참조.)

**포함하지 않는 것**: MOVES 차감(scoring-winlose 소유), 콤보 카운트(combo 소유), 드로우
실행(deck-draw 소유), 입력 처리(hud-ui 소유).

## Player Fantasy

플레이어가 **직접 만지는 유일한 코어 판정** — 카드를 집는 매 순간이 이 시스템을 통과한다.

Pillar 2("매 선택이 다음 연결을 남기는지 보이게 한다")의 구현체: 매치 성공 시 선택한
카드가 즉시 새 스포트라이트가 되어 다음 스캔을 촉발하는 것이 연쇄 쾌감의 리듬이다.
체감 핵심은 판정의 **즉시성과 명료성** — 왜 매치가 안 되는지가 항상 자명해야 한다
(공유 심볼 없음 vs 가려진 카드는 서로 다른 피드백을 받아야 한다).

## Detailed Design

### Core Rules

1. **`sharesSymbol` 확정** `[확정 2026-07-25 — board-generator OQ#1 해소]`:

   ```ts
   function sharesSymbol(a: CardData, b: CardData): boolean
   // a.symbols와 b.symbols의 교집합이 비어있지 않으면 true
   ```

   같은 심볼 2개 카드(예: 🍊🍊)도 교집합 판정으로 자연 처리 — **card-model Edge Cases
   #5의 재확인 완료** (튜플 보존이 판정에 영향 없음). 순수 함수로 export하며
   board-generator의 I1 검사가 임포트한다.
2. **스포트라이트 상태** `[확정 2026-07-25 — board-generator OQ#4 해소]`: **matching이
   소유**한다. `createMatching(initialSpotlight: CardData)`로 초기값을 수신하고
   `getSpotlight(): CardData`로 질의한다. 교체 경로는 정확히 2개:
   - 매치 성공 — 선택된 카드가 새 스포트라이트가 된다 (트라이픽스 준거)
   - 드로우 — deck-draw가 `setSpotlightFromDraw(card: CardData)`를 호출한다
3. **`tryMatch(cardId: string): MatchResult`** — Result 스타일 (card-model과 일관,
   예외 없음). 실행 순서와 거부 사유 우선순위 (2026-07-26 리뷰 반영 — 완전 명세):
   - ① **조회**: `getCard(cardId)` (card-model 질의 API — 이번 개정으로 추가) →
     미존재면 `'not-found'` 거부
   - ② **개방 검사**: `card.state !== 'uncovered'`면 `'not-uncovered'` 거부
   - ③ **공유 검사**: `!sharesSymbol(spotlight, card)`면 `'no-shared-symbol'` 거부
   - ④ **집행**: `removeCard(cardId)` — ①②를 통과했고 단일 스레드 동기 실행이므로
     **항상 성공해야 한다**. 실패 시 불변식 위반 버그로 간주하고 에러 로그 + 거부 반환
     (사유 전파). 우선순위: not-found > not-uncovered > no-shared-symbol — AC #3이
     이 순서를 검증한다.
   - 성공: `{ ok: true, removed: BoardCard, newlyUncovered: BoardCard[],
     previousSpotlight: CardData, newSpotlight: CardData }`
   - 거부: `{ ok: false, reason: 'no-shared-symbol' | 'not-uncovered' | 'not-found' }`
     — 거부 시 상태 무변화 보장.
4. **이벤트**: `matchSucceeded(payload: MatchSucceededPayload)` ·
   `matchRejected(reason, cardId)` · `spotlightChanged(card, source: SpotlightSource)`
   - `MatchSucceededPayload` = `tryMatch` 성공 반환값과 동일 형상 (removed,
     newlyUncovered, previousSpotlight, newSpotlight) — 구독자가 재질의 없이 처리
     가능하도록 필요 정보를 페이로드에 전부 담는다 (핸들러 간 순서 의존 최소화 원칙)
   - `SpotlightSource = 'match' | 'draw' | 'wildcard'` — `'wildcard'`는 **예약값**
     (Vertical Slice, wildcard GDD에서 활성화). 닫힌 열거형의 미래 파괴 변경 방지.
   - 발행 순서: card-model 이벤트(`cardRemoved` → `cardUncovered`*)가 **완전히 끝난 후**
     `matchSucceeded` → `spotlightChanged` (tryMatch가 동기이므로 순서 보장 가능)
   - ⚠️ **일관성 창 (구독 규칙)**: `cardRemoved`/`cardUncovered`는 `removeCard()` 내부에서
     동기 발행되므로, 그 핸들러 시점에는 **스포트라이트가 아직 교체 전**(옛 값)이다.
     card-model 이벤트는 보드 상태만 신뢰하고, 스포트라이트·매치 결과가 필요한 구독자는
     반드시 `matchSucceeded`/`spotlightChanged`를 기준으로 삼을 것.
   - **콤보 리셋 신호 = `spotlightChanged(source: 'draw')`** — combo가 이것만 구독하면
     deck-draw와 combo 간 직접 결합이 사라진다 (systems-index에 반영됨, 2026-07-26).
     scoring-winlose의 **드로우 MOVES 차감 트리거도 동일 신호**다 (매치 차감은
     `matchSucceeded`) — 잠정 계약, scoring GDD에서 확정.
5. **`getMatchableCards(): BoardCard[]`**: `getUncoveredCards()` 중 스포트라이트와
   공유하는 카드 필터, **slotId 오름차순 반환** (card-model 이벤트 순서 컨벤션과 통일) —
   hud-ui 초록 글로우 하이라이트의 **단일 원천** (2026-07-24 수정된 ui_draft.html의 시각
   언어와 정합). **빈 배열 = 유효 수 0** → 덱이 남아 있으면 hud-ui가 드로우 유도를 표시
   (탈출 경로). **덱도 0이면 데드락** — 이 최종 판정과 패배 처리는 scoring-winlose 소유
   (matching은 유효 수만 제공).

### States and Transitions

상태는 `spotlight` 하나뿐이다.

| 전이 | 트리거 | 결과 |
|------|--------|------|
| 초기화 | `createMatching(initialSpotlight)` | 스포트라이트 = 생성기 공급 초기값 |
| 매치 교체 | `tryMatch` 성공 | 스포트라이트 = 방금 매치된 카드 |
| 드로우 교체 | `setSpotlightFromDraw(card)` | 스포트라이트 = 덱에서 뽑힌 카드 |

종결 상태 없음 — 스테이지 종료 판정은 scoring-winlose 소유.

### Interactions with Other Systems

> ⚠️ deck-draw·combo·scoring·wildcard는 미설계 — 해당 행은 잠정 계약이다.

| 시스템 | 데이터 흐름 | 인터페이스 |
|--------|------------|-----------|
| card-model | matching이 소비 | `getCard(id)`·`getUncoveredCards()` 질의 · `removeCard()` 호출 · 이벤트 선행 완료 보장 (일관성 창 규칙은 Core Rules #4) |
| app-shell | matching을 생성 | 부트스트랩이 `createMatching(initialSpotlight)` 호출 (초기값 출처: board-generator의 `GeneratedStage.initialSpotlight`) |
| deck-draw | matching을 호출 | 드로우 시 `setSpotlightFromDraw(card)` 호출 (잠정 — deck-draw GDD에서 확정) |
| board-generator | matching을 소비 | `sharesSymbol` 임포트 (I1 검사) |
| combo | 이벤트 구독 | `matchSucceeded`(+1) · `spotlightChanged(source:'draw')`(리셋) |
| scoring-winlose | 이벤트 구독 | `matchSucceeded`(점수·매치 MOVES 차감) · `spotlightChanged(source:'draw')`(드로우 MOVES 차감) · 데드락 최종 판정 소유 (`getMatchableCards()` + 덱 잔량) |
| hud-ui / vfx-juice / audio | 이벤트 구독 | 전 이벤트 + `getMatchableCards()` |
| wildcard | 잠정 | 슬롯 덮기 시 판정 우회 방식·`source:'wildcard'` 활성화는 wildcard GDD에서 (Open Questions 등재) |

## Formulas

1. **판정식**: `match(c) ⟺ c ∈ getUncoveredCards() ∧ |symbols(c) ∩ symbols(spotlight)| ≥ 1`
2. **유효 수 기대값**: 상류 문서 **포인터만** — level-config Formulas #1 (P(k)),
   board-generator Formulas #1 (P_ok). 중복 정의 금지.
3. **복잡도**: `sharesSymbol` O(1) (튜플 2×2, 최대 4회 비교) ·
   `getMatchableCards` O(개방 카드 수 ≤ 슬롯 상한 32)

## Edge Cases

1. `tryMatch` 거부 시 상태 무변화 + `matchRejected` **발행함** — hud-ui의 거부 피드백용
   (조용한 실패 아님)
2. 스포트라이트와 완전 동일 조합(🍊🍇 vs 🍊🍇) → 정상 매치 (교집합 2 — 특수 처리 없음)
3. 같은 심볼 2개 카드가 스포트라이트(🍊🍊) → 판정 동일: 🍊 포함 카드만 매치
4. 마지막 보드 카드 매치 → card-model이 `boardCleared`까지 발행을 끝낸 **후**
   `matchSucceeded`·`spotlightChanged` 발행 (Core Rules #4 순서 규칙의 특수 사례)
5. 매치 직후 연타 → `'not-found'`/`'not-uncovered'` 자연 거부 (디바운스는 hud-ui 책임 —
   card-model Edge Cases #1과 일관)
6. `setSpotlightFromDraw`는 전달 카드를 **무검증 수용** — 덱 내용 정합성은
   board-generator·deck-draw 책임 (신뢰 경계 명시)
7. `getMatchableCards` 재계산: 이벤트 기반 캐시 무효화 권장 — 성능상 필수는 아님
   (구현 노트, Open Questions #3)

## Dependencies

방향 컨벤션 통일 (2026-07-26): **상류 = matching이 의존하는 대상, 하류 = matching에
의존하는(질의·호출·구독하는) 시스템** — 호출자는 하류다 (card-model GDD와 동일 컨벤션).

| 시스템 | 방향 | 강도 | 요지 |
|--------|------|------|------|
| card-model | 상류 | hard | 질의·제거·이벤트 선행 보장 |
| deck-draw | 하류 (matching에 의존) | hard (잠정) | `setSpotlightFromDraw` 호출 |
| board-generator | 하류 | hard | `sharesSymbol` 임포트, `initialSpotlight` 공급 |
| combo / scoring-winlose | 하류 | hard | 이벤트 구독 (`matchSucceeded`, `spotlightChanged`) |
| hud-ui / vfx-juice / audio | 하류 | soft~hard | 전 이벤트 + `getMatchableCards()` |
| wildcard | 하류 | soft (잠정) | 판정 우회는 wildcard GDD에서 결정 |

2026-07-26 design-review에서 systems-index 불일치 2건(deck-draw→matching 엣지 누락,
combo의 구식 deck-draw 직접 의존 표기)이 발견되어 **인덱스를 수정 반영**했다.

## Tuning Knobs

**이 시스템은 의도적으로 노브가 없다.** 판정 규칙("1개 이상 공유")은 game-concept 확정
사항이지 수치가 아니며, 난이도 노브는 전부 level-config 소유다. 규칙 변경은 노브 조정이
아니라 **컨셉 개정**이다 (카드당 심볼 수 고정 원칙과 동일 — card-model Tuning Knobs 참조).

## Visual/Audio Requirements

N/A — 이벤트만 제공. 매치 성공/거부/스포트라이트 교체의 연출·사운드는 vfx-juice·audio가
이벤트를 구독해 구현한다.

## UI Requirements

N/A — hud-ui 소유. 단, 하이라이트(초록 글로우)는 반드시 `getMatchableCards()`를 단일
원천으로 사용하고, 거부 피드백은 `matchRejected`의 reason별로 구분 표현할 것
(공유 없음 vs 가려짐).

## Acceptance Criteria

테스트 프레임워크: Vitest (technical-preferences "필수 테스트"의 매칭 판정 요구 이행)

1. `sharesSymbol` 진리표 — 시안 데이터: (🍊🍇,🍇🍑)=T · (🍊🍇,🍒🍓)=F / 합성
   엣지케이스(동일 심볼 카드 — card-model Edge Cases #5 검증용, 데모 생성 정책상 실제
   등장 불가): (🍊🍊,🍊🍋)=T · (🍊🍊,🍇🍑)=F
2. `tryMatch` 성공 경로: 제거+교체+이벤트 순서 — `cardRemoved` → `cardUncovered`* →
   `matchSucceeded` → `spotlightChanged(source:'match')`
3. `tryMatch` 거부 3사유 각각: 상태 무변화 + `matchRejected` 정확히 1회 + **우선순위
   검증** (미존재이면서 공유도 없는 입력 → 'not-found', covered이면서 공유 없는 카드 →
   'not-uncovered')
4. **시안 스냅샷 재현**: 스포트라이트 🍊🍇 · 수정된 시안 보드(2026-07-24)에서
   `getMatchableCards()` = **[🍇🍑(r4c3), 🍊🍋(r4c4)]** — slotId 오름차순 순서까지 검증
   (**문서·시안·코드 3자 정합 테스트**)
5. 콤보 리셋 신호: `setSpotlightFromDraw` → `spotlightChanged(source:'draw')` 정확히 1회
6. **마지막 카드 매치 전체 체인**: `cardRemoved` → `boardCleared` → `matchSucceeded` →
   `spotlightChanged` 순서 (Edge Cases #4의 전용 AC)
7. 성능: `getMatchableCards` 32슬롯 기준 0.1ms 미만

## Open Questions

1. **wildcard 판정 우회 방식**: `tryMatch` 내부 확장(와일드 스포트라이트는 항상 true)인지
   별도 경로인지 + **`source:'wildcard'`의 콤보 리셋 여부** (예약값은 이미 열거형에 확보) —
   Owner: 사용자 / 시점: wildcard GDD 설계 (Vertical Slice)
2. **거부 피드백 UX**: `matchRejected` reason별 표현(흔들림/툴팁 등) —
   Owner: 사용자 / 시점: hud-ui GDD 설계
3. **`getMatchableCards` 캐싱**: 이벤트 기반 무효화 도입 여부 —
   Owner: 구현자 / 시점: 구현 시 측정 후
