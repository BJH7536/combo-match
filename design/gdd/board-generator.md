# board-generator (보드 생성기)

> ⚠️ **2026-07-26 마스터 정렬**: 생성 방식이 **해답 체인 선배치(by construction)**로 대체됨
> (C4) — rejection sampling 폐기, 레퍼런스 구현은 `tools/level-designer.html`의
> `generate()`/`removalOrder()`/`assignSymbols()`. 전문은
> `production/adr/ADR-001-master-alignment.md`. 충돌 시 마스터 우선.

> **Status**: Revised (2026-07-25 design-review 지적 24건 반영 — 재리뷰 보류)
> **Author**: 사용자 + Claude (design-system)
> **Last Updated**: 2026-07-25
> **Supports Pillars**: Pillar 3 "막히지 않는 진행"의 알고리즘 측 절반 — 매치 보장·클리어 가능성의 소유자 (⚠️ 인덱스 지정 최고위험 시스템)

## Overview

board-generator는 `LevelConfig`를 입력받아 한 스테이지의 카드 전체 — **보드(슬롯 수만큼) +
덱(deckSize장) + 초기 스포트라이트 1장** — 를 생성하는 순수 함수형 시스템이다. `seed`가
있으면 완전 결정적으로 생성된다. 생성물은 card-model의 `createBoardState(layout, cards,
validSymbols)`와 deck-draw로 전달되며, **생성 이후 런타임에는 일절 개입하지 않는다**.

핵심 책임 3가지: ① 심볼 분포의 공정성(균등 배분), ② 초기 매치 보장 불변식,
③ 스테이지 클리어 가능성의 오프라인 시뮬레이션 검증 (level-config가 위임한 클리어율 AC).

**포함하지 않는 것**: 매칭 판정(matching 소유), 상태 관리(card-model 소유), 레벨 파라미터
정의(level-config 소유), 생성물 조립 호출(게임 부트스트랩 = app-shell 소관).

## Player Fantasy

비대면 인프라. 플레이어가 체감하는 것은 **"항상 뭔가 할 수 있다"**(Pillar 3)와
**"운이 나빠도 납득이 간다"**는 공정성 감각이다.

이 시스템의 실패는 두 얼굴을 갖는다 — **하드록**(첫 화면부터 할 게 없음: 디자인 리뷰가
시안에서 발견했던 바로 그 상태)과 **사기성 배치**(뻔히 못 깨는 판). 둘 다 이 시스템이 막는다.

## Detailed Design

### Core Rules

1. **생성 API** (순수 함수, TypeScript strict):

   ```ts
   interface GeneratedStage {
     boardCards: CardData[];      // 슬롯 수와 동일 (pyramid-10: 10장)
     deckCards: CardData[];       // deckSize장 — 배열 순서 = 드로우 순서
     initialSpotlight: CardData;  // 초기 스포트라이트 1장
   }
   function generateStage(config: LevelConfig, layout: BoardLayout): GeneratedStage
   ```

   총 카드 = 슬롯 수 + deckSize + 1. `id`는 순번 부여(`c001`…) — card-model의 id 중복
   검증을 구성상 통과한다. **배정 계약: `boardCards[i]`는 `layout.slots[i]`에 배정된다**
   (인덱스 일치). I1 검사와 `createBoardState` 핸드오프가 같은 순서를 공유해야 초기 매치
   보장이 전달 과정에서 무효화되지 않는다 (card-model GDD에도 동일 계약 명시 — 2026-07-25).
2. **PRNG**: mulberry32 (32비트 시드, 외부 의존성 0). `Math.random` 직접 사용 금지.
   `seed`가 없으면 임의 시드 1개를 뽑아 주입하고 **로그에 기록**한다 (버그 재현 경로).
   같은 (config, layout, seed) → 항상 같은 출력.
3. **심볼 분포 규칙**: 전체 카드 풀 기준 각 심볼 빈도 차 ≤ 1 (균등 배분 후 셔플).
   **같은 심볼 2개 카드는 생성 정책상 금지** — card-model 타입은 허용하지만 시안에 없고
   매칭 관대함을 왜곡하므로, 배정 중 발생 시 스왑 교정한다.
   분포 보장은 **전 풀(보드+덱+스포트라이트) 기준**이며 보드 서브셋의 정확한 패턴은
   보장하지 않는다 — 시안의 3-3-3-3-2-2-2-2는 이상적 예시일 뿐이다 (2026-07-25 리뷰 반영).
4. **불변식** (2026-07-25 리뷰 반영 — 보장 방식을 구분):
   - **I1 초기 매치 보장** (확률적 — 유일한 재시도 조건): 초기 개방 앞줄 카드 중
     `initialSpotlight`와 심볼 공유 ≥ 1장. 실패 시 재생성 — PRNG 스트림을 이어서
     사용(결정성 유지), **상한 100회** 초과 시 `GenerationError` throw.
   - **I2 카드 내 심볼 중복 없음 · I3 심볼 빈도 차 ≤ 1** (구성적 — 재시도 불필요):
     균등 배분 + 스왑 교정으로 항상 달성된다 — k≥2이면 최대 심볼 빈도 ⌈S/k⌉ ≤ 카드 수
     N이라 실현 가능 (알고리즘·종결성은 Formulas #4). 생성 직후 assert로만 검사하며,
     위반은 재시도 사유가 아니라 **구현 버그**다.
5. **드로우 순서**: `deckCards` 배열 순서가 곧 드로우 순서 — deck-draw는 소비만 한다.
   재셔플 없음.
6. **매칭 판정 재사용**: I1 검사는 matching 소유의 `sharesSymbol(a, b)`를 임포트한다 —
   **규칙 중복 구현 금지** (matching 미설계 상태의 잠정 계약, 시그니처만 고정).
7. **시뮬레이션 검증** (오프라인 도구 — 프로덕션 번들 제외, 2026-07-25 리뷰 반영):
   - **"클리어" 정의 = scoring-winlose의 승패 규칙 그대로** — 봇은 targetScore 도달
     여부를 점수 공식(콤보 배수)·MOVES 차감(매치+드로우)·덱 소진까지 전부 모델링한다.
     ⚠️ 따라서 시뮬레이션은 scoring-winlose에 **hard 의존**(시뮬레이션 한정) — 확정
     전에는 잠정 파라미터(base 100·콤보 ×2 근사)로 예비 실행만 하고, AC #6의 확정
     판정은 scoring GDD 완료 후 활성화한다.
   - 봇 정책: 그리디 — 개방 카드 중 공유 카드 선택(복수면 **slotId 오름차순
     타이브레이크**), 없으면 드로우. 클리어율은 참고용 추정이며 **절대 하한이 아니다**
     — 온보딩 중 신규 유저는 봇보다 못할 수 있다 (스테이지 1의 95%는 봇 기준임을 명시).
   - **시드 체제**: `simSeed_i = baseSeed + i` (i = 0..N−1, baseSeed는 CI 고정 상수) —
     생성·봇 모두 이 결정적 스트림을 사용해 CI에서 완전 재현된다.
   - 스테이지당 기본 1,000회. **판정은 원시 비율이 아니라 95% CI 하한 ≥ 목표** (경계
     스테이지의 통계 잡음 방어 — 필요 시 해당 스테이지만 10,000회로 상향).

### States and Transitions

상태 없음 — 순수 함수. 재시도 루프는 함수 내부의 지역 상태일 뿐이다.

### Interactions with Other Systems

> ⚠️ deck-draw·matching은 미설계 — 해당 행은 잠정 계약이다.

| 시스템 | 방향 | 인터페이스 |
|--------|------|-----------|
| level-config | → | `LevelConfig`(symbols·seed·deckSize·layoutId) + BoardLayout 입력 |
| card-model | ← | `boardCards`가 `createBoardState(layout, cards, validSymbols)`의 `cards`로 전달 — 최종 검증은 card-model 소유 |
| deck-draw | ← | `deckCards` 전달 (잠정 — deck-draw GDD에서 확정) |
| matching | ↔ | `sharesSymbol(a, b)` 임포트 (**확정**: 교집합 비공집합) · `initialSpotlight`는 matching의 `createMatching`으로 전달 (2026-07-25 확정) |
| scoring-winlose | → | **시뮬레이션 한정 hard**: 봇이 승패·점수·MOVES 규칙을 그대로 사용 (미설계 — 잠정 파라미터로 예비 실행, Core Rules #7) |
| app-shell | ← | 부트스트랩이 `generateStage` 호출 후 각 시스템에 생성물 배포 |

## Formulas

1. **I1 성공 확률과 기대 재시도 횟수** — 초기 개방 앞줄 u장(pyramid-10: u=4)이
   스포트라이트와 하나라도 심볼을 공유할 확률 (P(k)는 level-config Formulas #1 참조 —
   중복 정의 금지):

   `P_ok(k, u) = 1 − (1 − P(k))^u`

   | k | 4 | 6 | 8 |
   |---|---|---|---|
   | P_ok(k, 4) | ≈0.999 | ≈0.974 | ≈0.918 |
   | 기대 **시도** 횟수 (1/P_ok) | 1.001 | 1.027 | 1.090 |

   ⚠️ **근사 모델**: 앞줄 4장의 공유 사건을 독립으로 가정한 값이다 — 실제로는 균등
   분포·중복 금지 제약으로 약한 상관이 존재해 참값과 수 %p 이내로 어긋날 수 있으며,
   정밀 값은 시뮬레이션이 실측한다. 최악(k=8)에서도 기대 시도 ≈ 1.09회이고, I1이 100회
   연속 실패할 확률은 근사 기준 (1−0.918)^100 ≈ 10⁻¹⁰⁸ 수준 — 정상 입력에서 사실상
   불가능하므로 **100회 초과 = 입력 오류의 신호**다. (이 주장의 스코프는 **I1 한정** —
   I2·I3는 구성적 보장이라 재시도에 기여하지 않는다.)
2. **심볼 빈도**: 총 심볼 슬롯 `S = 2 × (슬롯 수 + deckSize + 1)`. 각 심볼 빈도
   `f ∈ {⌊S/k⌋, ⌈S/k⌉}` (차 ≤ 1). 데모 스테이지 6: S = 66, 8종 → 빈도 8×6종 + 9×2종.
3. **생성 비용**: 시도당 O(총 카드 수) — 33장 × 기대 1.09회, 1ms 미만
   (로드 시 1회 실행 — 프레임 예산과 무관).
4. **스왑 교정 알고리즘** (I2의 구성적 보장): 심볼 멀티셋(빈도 차 ≤ 1로 구성)을 셔플해
   2개씩 배정한 뒤, 카드 c가 `[s, s]`이면 s를 포함하지 않는 카드 c′를 찾아 c의 s 하나와
   c′의 심볼 하나를 교환한다. k≥2·빈도 차 ≤ 1이면 그런 c′가 항상 존재하고(최대 빈도
   ⌈S/k⌉ ≤ N), 교환마다 중복 카드 수가 단조 감소하므로 **유한 횟수 내 종결**한다.
   교환은 심볼 빈도를 바꾸지 않으므로 **I3를 보존**한다.

## Edge Cases

1. **k < 2**: I2(카드 내 중복 금지)를 만족하는 카드 생성 불가 → 재시도 낭비 없이
   **사전 검출 즉시 `GenerationError`**
2. **k = 2 극단**: 모든 카드가 동일 조합 `[s1,s2]` — I2는 *카드 내* 중복만 금지하며
   **카드 간 동일 조합은 허용**한다 (명시)
3. **deckSize = 0**: level-config가 `LevelLoadError`로 차단하므로 **정상 파이프라인에서는
   도달 불가** — `generateStage` 직접 호출(단위 테스트 등)에 대한 방어적 케이스일 뿐이다.
   생성은 허용하며 시뮬레이션 클리어율이 걸러낸다
4. **재시도 100회 초과**: `GenerationError`에 입력 파라미터 전체 포함 (진단 가능성)
5. **seed 재현성**: 같은 (config, layout, seed) 두 번 호출 → 딥이퀄 (AC #2로 승격)
6. **슬롯 0개 레이아웃**: 즉시 `GenerationError` (구조 검증은 card-model 소유지만
   이 퇴화 입력만 방어)
7. **시뮬레이션 봇의 재현성**: 봇도 시드 스트림 사용 — 클리어율 수치가 CI에서 재현 가능

## Dependencies

| 시스템 | 방향 | 강도 | 인터페이스 요지 |
|--------|------|------|----------------|
| level-config | 상류 | hard | `LevelConfig` + BoardLayout 입력 |
| card-model | 상류(타입)·하류(소비) | hard | `CardData` 타입 사용, `boardCards` → `createBoardState` |
| matching | 상류 | hard (확정 2026-07-25) | `sharesSymbol(a,b)` 임포트 — I1 검사의 판정 원천 (규칙 중복 구현 금지) |
| deck-draw | 하류 | hard (잠정) | `deckCards` 공급 (`initialSpotlight`는 matching 수신으로 확정) |
| scoring-winlose | 상류 (시뮬레이션 한정) | hard (잠정) | 봇의 승패·점수·MOVES 규칙 원천 |
| app-shell | 하류 | soft | 부트스트랩이 `generateStage` 호출 |

2026-07-25 교차 검증: **board-generator→matching 엣지가 systems-index에 없던 신규
발견**(설계 중 필연적으로 도출)으로, 인덱스에 수정 반영했다. 순환 아님 (matching은
board-generator에 의존하지 않음).

## Tuning Knobs

| 노브 | 분류 | 기본값 | 안전 범위 | 과대 시 | 과소 시 | 상호작용 |
|------|------|--------|-----------|---------|---------|----------|
| 재시도 상한 | gate | 100 | 10~1,000 | 퇴화 입력 진단 지연 | 정상 입력 오탐 | P_ok 표(Formulas #1) |
| 카드 내 중복 금지 | gate | on | on/off | — | off 시 매칭 관대함 왜곡 | matching 난이도와 연동 |
| 시뮬레이션 횟수 | gate | 1,000 | 100~10,000 | CI 시간 증가 | 신뢰구간 확대 | CI 예산 |
| 클리어율 목표 | — | 스테이지1 95% / 10 60% | — | — | — | **level-config 소유 위임분** — 포인터만 (중복 노브 금지) |
| 봇 정책 | gate | 그리디 | — | — | — | 하한 추정 — 정교화는 VS 이후 (Open Questions #2) |

## Visual/Audio Requirements

N/A — 순수 데이터 생성 시스템. 시각 표현은 하류(hud-ui/vfx-juice) 소유.

## UI Requirements

N/A — 다만 생성 실패(`GenerationError`)는 정상 플레이에서 발생하면 안 되는 개발자 오류이므로,
사용자 노출 없이 로그·에러 리포트로만 처리한다 (app-shell 소관).

## Acceptance Criteria

테스트 프레임워크: Vitest (technical-preferences "필수 테스트"의 매치 보장 불변식 요구 이행)

1. **결정성**: 같은 (config, layout, seed) 2회 호출 → 딥이퀄
2. **I1 전수**: 스테이지 1~10 각 1,000회 생성(`simSeed_i = baseSeed + i` 시드 체제)에서
   초기 앞줄 매치 보장 위반 0건
3. **I2/I3 전수**: 같은 10,000개 표본에서 카드 내 심볼 중복 0건, 심볼 빈도 차 ≤ 1
4. **통합**: 생성물의 id 전역 고유 + `createBoardState(layout, cards, validSymbols)` 검증 통과
5. **에러 경로**: k<2 / 슬롯 0 → `GenerationError` · 재시도 초과 에러에 입력 파라미터 포함
6. **클리어율** (시드 고정 CI — ⚠️ scoring-winlose GDD 완료 후 활성화): **95% CI 하한
   기준** 스테이지 1 ≥ 95%, 스테이지 10 ≥ 60% · 경계 스테이지는 10,000회로 상향 가능
7. **분포 검증**: 데모 스테이지 6의 **전 풀(66 심볼 슬롯)** 빈도 = 8×6종 + 9×2종
   (Formulas #2 — 보드 서브셋 패턴은 검증 대상 아님)
8. **성능**: `generateStage` 10ms 미만 (데스크톱 기준, 로드 시 1회 — 초기 로드 3초 예산의 0.3%)

## Open Questions

1. ~~`sharesSymbol(a, b)` 시그니처 확정~~ → **해소(2026-07-25)**: matching GDD가
   `sharesSymbol(a: CardData, b: CardData): boolean`(교집합 비공집합)으로 확정·export.
2. **봇 정교화**: 그리디 → 1수 앞보기 봇으로 클리어율 추정 정밀화 여부 —
   Owner: 사용자 / 시점: VS 이후
3. **스포트라이트/덱 심볼 편중**: 후반 스테이지 난이도 축으로 덱 심볼 분포 왜곡을 쓸지 —
   Owner: 사용자 / 시점: 난이도 튜닝 단계 (현재는 전 풀 균등)
4. ~~initialSpotlight 소유권~~ → **해소(2026-07-25)**: matching이 스포트라이트 상태를
   소유하며 `createMatching(initialSpotlight)`로 수신한다. deck-draw는 드로우 시
   `setSpotlightFromDraw`로 전달만 한다 (matching GDD Core Rules #2).
