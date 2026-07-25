# level-config (레벨 정의/난이도 파라미터)

> ⚠️ **2026-07-26 마스터 정렬**: 레벨 스키마가 `combo-match/level@2`로 전면 대체됨 (C13)
> — 목표 유형 3종·16노브 config·evaluation 블록 포함. 전문은
> `production/adr/ADR-001-master-alignment.md`. 충돌 시 마스터 우선, 본문 개정은 구현과 병행.

> **Status**: Revised (2026-07-25 design-review 지적 21건 반영 — 재리뷰 보류)
> **Author**: 사용자 + Claude (design-system)
> **Last Updated**: 2026-07-25
> **Supports Pillars**: Pillar 3 "막히지 않는 진행" (난이도 파라미터가 데드락 위험과 직결) — 난이도 곡선의 소유자

## Overview

level-config는 **레벨 하나를 완전히 기술하는 데이터 스키마**와 난이도 진행 규칙을 소유하는
순수 데이터 시스템이다. 레벨 파라미터(목표 점수, 덱 크기, 이동 제한 토글·횟수, 유효 심볼
목록, 보드 레이아웃)를 정의하고, 레벨 번호에 따른 난이도 곡선의 단일 진실 원천이 된다.
플레이어가 직접 상호작용하지 않는 인프라이며, board-generator(생성 파라미터),
card-model(레이아웃·심볼 목록), scoring-winlose(목표 점수·이동 제한)가 소비한다.
이 시스템이 없으면 "이 레벨은 무엇이고 얼마나 어려운가"를 정의할 곳이 없다.

**포함하지 않는 것**: 보드 생성 알고리즘(board-generator 소유), 데이터 검증(card-model이
로드 시 fail-fast — 중복 검증 금지), 레벨 선택 UI(hud-ui/app-shell 소유).

## Player Fantasy

직접 체감되지 않는 인프라지만, **"적당한 도전"의 체감을 결정하는 난이도 곡선의 소유자**다.
플레이어는 이 시스템을 "레벨이 공정하다", "조금씩 어려워진다", "한 판만 더"로만 체감한다.

Pillar 3 "막히지 않는 진행"의 데이터 측 절반 — 파라미터가 잘못되면(심볼 종수 과다, 덱
과소) 정상 플레이에서 데드락 확률이 올라가므로, **난이도는 항상 "빡빡함"으로 표현하고
"불가능"으로 표현하지 않는다**는 원칙을 갖는다. game-concept의 Flow 설계("목표 점수·이동/덱
배분·과일 종류 수로 조절")를 데이터로 구현한다.

## Detailed Design

### Core Rules

1. **타입 계약** (TypeScript strict — 하류 공유):

   ```ts
   interface LevelConfig {
     levelId: number;          // 1부터 순차
     layoutId: string;         // 명명된 BoardLayout 참조 — 데모: 'pyramid-10'
     symbols: SymbolId[];      // 이 레벨의 유효 심볼 목록 (card-model 검증 기준)
     targetScore: number;      // 승리 조건 → scoring-winlose
     deckSize: number;         // 드로우 파일 크기 → deck-draw
     movesEnabled: boolean;    // 이동 제한 A/B 토글 (game-concept Open Question #2)
     moves: number;            // 행동 예산 — movesEnabled=false면 반드시 0으로 기재
     seed?: number;            // 지정 시 board-generator 결정적 생성 (데모 레벨 전용)
   }
   ```

2. **레벨 목록**: `levels.json` 정적 배열 — 레벨별 명시 값 (곡선 공식 없음, 2026-07-25 결정).
3. **레이아웃 저장소**: `layouts/*.json` — `BoardLayout`(slotId/position/covers)을
   layoutId로 참조. 데모 `pyramid-10`은 **card-model GDD의 covers 표와 동일**해야 한다
   (단일 진실 원천은 card-model GDD, 이 파일은 그 직렬화본).
4. **검증 소유권 분리**: level-config 로더는 **자체 스키마 검증만** 소유 — levelId
   중복/누락, targetScore·deckSize ≤ 0, movesEnabled=true인데 moves ≤ 0, symbols 빈
   배열/중복 항목, 미존재 layoutId 참조, 음수·비정수 seed → `LevelLoadError` fail-fast.
   **레이아웃 구조 검증(covers DAG 등)은 card-model 소유** — 중복 검증 금지.
5. **시드 정책**: 레벨 1은 `seed` 고정(심사 일관성), 이후 레벨은 필드 생략(매판 랜덤).
6. **스코프**: MVP 레벨 1개, Vertical Slice 10개 (systems-index·game-concept과 일치).
7. **MOVES 소비 규칙** `[확정 2026-07-25]`: 1 move = 플레이어 행동 1회 — **보드 카드
   매치 선택과 덱 드로우 모두 소비한다** (와일드카드 사용도 1 move — 잠정, wildcard GDD
   에서 확정). moves는 "총 행동 예산"으로, 덱(드로우 상한)과 서로 다른 축을 제약한다.
   차감·소진 판정의 집행은 scoring-winlose 소유 — level-config는 예산 값만 공급한다.
8. **로더 API**:
   - `loadLevels(levelsJson: unknown, layouts: ReadonlyMap<string, BoardLayout>): LevelConfig[]`
     — 유일한 파싱·검증 진입점, 실패 시 `LevelLoadError` throw. 파일 fetch는 app-shell 소유.
   - `getLevel(levelId: number): LevelConfig` · `getLayout(layoutId: string): BoardLayout`
9. **심볼 선택 규칙**: 심볼 우선순위 고정 목록은 card-model 데모 8종 순서
   (`strawberry, orange, lemon, grape, watermelon, cherry, kiwi, peach`)이며, 레벨의
   `symbols`는 이 목록의 **앞에서 k개**다. 종수 증가 시 기존 심볼은 유지된다(교체 없음)
   — 표의 "종수 k"만으로 symbols 배열이 유일하게 결정된다.

### States and Transitions

상태 기계 없음 — 정적 데이터 시스템. 로드 성공 / `LevelLoadError` 실패의 이분법만 존재한다.

### Interactions with Other Systems

> ⚠️ 하류 시스템 미설계 상태이므로 아래는 **잠정 계약**이다.

| 시스템 | 방향 | 소비 필드 |
|--------|------|----------|
| board-generator | → | `symbols`, `seed`, `deckSize`, `layoutId`→BoardLayout — 카드 분포 생성 입력 |
| card-model | → | BoardLayout + `symbols` — `createBoardState(layout, cards, validSymbols)`의 1·3번째 인자 (시그니처는 card-model GDD 2026-07-25 개정판) |
| scoring-winlose | → | `targetScore`, `movesEnabled`/`moves` — MOVES 차감 집행 소유. **패배 원인(덱 소진 vs 이동 소진) 구분 계측 요구를 이관** (A/B 분석용) |
| deck-draw | → | `deckSize` |
| hud-ui | → | `levelId`(스테이지 표기)·`targetScore`·`moves` 표시 원천 (soft) |
| app-shell | ↔ | `levels.json`·`layouts/*` 프리로드 시점 소유 (초기 로드 3초 예산 내) |

## Formulas

1. **심볼 공유 확률 근사식** — 종수 `k`에서 무작위 두 카드(각 2심볼, 상이 가정)가 심볼을
   공유할 확률:

   `P(k) = 1 − C(k−2,2) / C(k,2)`

   | k | 4 | 5 | 6 | 7 | 8 |
   |---|---|---|---|---|---|
   | P(k) | 0.833 | 0.700 | 0.600 | 0.524 | 0.464 |

   종수가 난이도의 주 축이다 (4종→8종이면 유효 수 확률이 거의 절반). 근사 가정: 균등
   분포, 중복 심볼 카드 무시. 정확한 데드락 위험 산정은 board-generator 소유.

2. **권장 초기값 표** (Vertical Slice 10레벨) — ⚠️ targetScore는 scoring-winlose 공식
   미확정 상태의 잠정값 (base 100 · 평균 콤보 ×2 가정, 확정 후 재조정 필수):

   | 스테이지 | layoutId | 종수 k | P(k) | deckSize | movesEnabled / moves | targetScore | M_min | seed |
   |---|---|---|---|---|---|---|---|---|
   | 1 | pyramid-10 | 4 | .83 | 26 | off / 0 | 600 | 3 | **42 (고정)** |
   | 2 | pyramid-10 | 5 | .70 | 24 | off / 0 | 800 | 4 | — |
   | 3 | pyramid-10 | 6 | .60 | 22 | off / 0 | 1000 | 5 | — |
   | 4 | pyramid-10 | 6 | .60 | 22 | on / 18 | 1000 | 5 | — |
   | 5 | pyramid-10 | 7 | .52 | 22 | on / 16 | 1200 | 6 | — |
   | 6 | pyramid-10 | 8 | .46 | 22 | on / 14 | 1300 | 7 | — |
   | 7 | pyramid-10 | 8 | .46 | 20 | on / 14 | 1400 | 7 | — |
   | 8 | pyramid-10 | 8 | .46 | 20 | on / 13 | 1500 | 8 | — |
   | 9 | pyramid-10 | 8 | .46 | 18 | on / 13 | 1550 | 8 | — |
   | 10 | pyramid-10 | 8 | .46 | 18 | on / 12 | 1600 | 8 | — |

   - **스테이지 3 ↔ 4는 moves 토글 외 전 파라미터 동일한 통제 쌍** — 이동 제한 A/B의
     핵심 비교 구간 (패배 원인 계측은 scoring-winlose로 이관, Interactions 참조).
   - **스테이지 6 = ui_draft.html 시안 파라미터 앵커** (8종 · 덱 22 · MOVES 14, SCORE
     1,240은 목표 1,300 진행 중 장면으로 해석). ⚠️ **용어 구분**: 시안 헤더의 "LEVEL 6"은
     game-concept상 **계정 레벨**(장기 메타 지표)이고, 본 문서의 levelId는 **스테이지
     번호**다 — 별개 지표이며 숫자 일치는 우연으로 취급한다.
   - 스테이지 6+ 종수 k=8 고정은 데모 에셋 상한 때문 — 후반 난이도는 deck·moves·target
     축으로 이동한다 ("종수가 주 축"은 전반부에 한정).
   - 스테이지 9→10의 얇은 증분(moves −1, target +50)은 잠정 — targetScore 재조정
     (Open Question #1) 시 시뮬레이션 기반으로 재설계.

3. **자원 sanity 규칙** (2026-07-25 리뷰 반영 — 게임 모델 교정): 매치는 보드 카드만
   제거·득점하며 보드는 리필되지 않으므로 **한 스테이지의 매치 상한은 보드 슬롯 수**
   (pyramid-10 기준 10)다. 덱은 매치 자원이 아니라 스포트라이트 교체 자원이다.
   - **하드 규칙**: `M_min = ceil(targetScore / (100 × 2)) ≤ 슬롯 수 − 2` (여유 ≥ 2).
     pyramid-10에서 **M_min ≤ 8** — 위 표는 전 스테이지 만족 (최대 M_min 8, AC #9).
   - 행동 예산(moves)·드로우 확률까지 반영한 실제 클리어 가능성은 닫힌 식으로 보장하지
     않는다 — **board-generator의 몬테카를로 시뮬레이션 AC로 위임** (잠정 목표 클리어율:
     스테이지 1 ≥ 95%, 스테이지 10 ≥ 60%).
   - base 100 · 평균 콤보 ×2 가정은 잠정 — scoring GDD 확정 시 M_min 전면 재계산.

## Edge Cases

1. `levels.json` 빈 배열 / levelId 중복·비연속(1..N 강제) → `LevelLoadError`
2. `movesEnabled=false`인데 `moves` ≠ 0 → 경고 로그 1회 + 0으로 정규화 (스키마상 허용)
3. `seed`는 비음수 정수만 — 그 외 `LevelLoadError`
4. `symbols` 중복 항목 → `LevelLoadError` (Core Rules #4와 일치)
5. 심볼 id의 **에셋 존재 여부**는 이 시스템의 검증 범위 밖 — app-shell 프리로드에서
   검증한다 (경계 명시)
6. 극단 파라미터(deckSize 1 등)는 스키마상 유효 — 플레이 가능성 판단은 Formulas #3
   가이드 + 플레이테스트 소관
7. `layoutId` 미존재 → `LevelLoadError` (Core Rules #4)
8. `targetScore ≤ 0` / `deckSize ≤ 0` → `LevelLoadError` (Core Rules #4와 목록 동기화 —
   2026-07-25 리뷰 반영)

## Dependencies

| 시스템 | 방향 | 강도 | 인터페이스 요지 |
|--------|------|------|----------------|
| (상류) | — | — | 없음 (Foundation) |
| board-generator | 하류 | hard | `symbols`·`seed`·`deckSize`·`layoutId` 소비 |
| card-model | 하류(공급) | soft→hard | BoardLayout+`symbols` 공급 — MVP 초기 하드코딩 대체 가능 (card-model GDD Dependencies와 대칭 확인 ✓) |
| scoring-winlose | 하류 | hard | `targetScore`·`movesEnabled`/`moves` |
| deck-draw | 하류 | hard | `deckSize` |
| app-shell | 하류 | soft | `levels.json`·`layouts/*` 프리로드 |
| hud-ui | 하류 | soft | `levelId`(스테이지)·`targetScore`·`moves` 표시 |

2026-07-25 교차 검증에서 systems-index의 단방향 누락 2건(deck-draw·app-shell 행에
level-config 부재)을 발견해 **인덱스를 수정 반영**했다.

## Tuning Knobs

이 시스템은 사실상 "노브의 집"이다 — 레벨 파라미터 전체가 디자이너 조정값이다.

| 노브 | 분류 | 기본값 | 안전 범위 | 과대 시 | 과소 시 | 상호작용 |
|------|------|--------|-----------|---------|---------|----------|
| targetScore | curve | Formulas #2 표 | 잠정 | 클리어 불가 체감 | 무긴장 | ⚠️ scoring 공식과 연동 — 확정 후 재조정 |
| deckSize | curve | 26→18 | 10~40 | 제약 무의미 | 데드락·패배 남발 | P(k)와 곱효과 |
| movesEnabled/moves | gate+curve | off→18→12 | 8~30 | 제약 무의미 | 불공정 체감 | 덱과 이중 제약 — A/B 대상 |
| symbols 종수 | curve | 4→8 | 4~8 | 에셋 없음·과난이도 | 무난이도 | P(k) 표가 직관 제공 |
| seed | gate | 레벨 1만 | 비음수 정수 | — | — | 데모 재현성 |

레이아웃 슬롯 상한 32는 **card-model 소유** — 여기서는 포인터만 (중복 노브 금지).

## Visual/Audio Requirements

N/A — 순수 데이터 계층. 심볼 id ↔ 에셋 매핑의 존재 검증은 app-shell 프리로드 소관.

## UI Requirements

N/A — 레벨 번호·목표 점수·잔여 이동의 표시는 hud-ui 소유. hud-ui는 이 문서의
LevelConfig 필드를 표시 원천으로 사용한다.

## Acceptance Criteria

테스트 프레임워크: Vitest

1. Formulas #2 표 + 심볼 선택 규칙(Core Rules #9)으로 **유일하게 결정되는** `levels.json`
   로드 성공 + `LevelConfig` 타입 일치
2. 스키마 위반 각각 → `LevelLoadError`: 중복 levelId / 비연속 levelId / movesEnabled=true·moves≤0 /
   targetScore≤0 / deckSize≤0 / symbols 중복·빈 배열 / 미존재 layoutId / 음수·비정수 seed
   (파라미터라이즈 테스트)
3. `pyramid-10.json` ↔ card-model GDD covers 표 딥이퀄 (**문서-데이터 동기화 테스트**)
4. 레벨 1의 고정 seed(42)가 board-generator 입력으로 전달됨 (통합 — board-generator 설계 후)
5. `movesEnabled=false`·`moves`≠0 레벨 로드 시 경고 로그 정확히 1회 + moves=0 정규화
6. 공유 확률 유틸: `P(4)=5/6`, `P(8)=13/28` 정확 일치
7. 성능: levels+layouts 전체 파싱 50ms 미만 (프리로드 3초 예산 대비 무시 가능)
8. 심볼 선택 규칙: 각 스테이지 `symbols`가 우선순위 목록의 앞 k개와 정확히 일치
9. 표 상수 검증: 전 스테이지 `M_min = ceil(targetScore/200) ≤ 8` (Formulas #3 하드 규칙)

## Open Questions

1. **targetScore 잠정값**: scoring-winlose의 점수 공식(base·콤보 반영 방식) 확정 후
   Formulas #2 표 전면 재조정 필요. — Owner: 사용자 / 시점: scoring-winlose GDD 설계 시
2. **이동 제한 채택/폐기**: 소비 규칙은 확정됨(매치+드로우 모두 1 move — Core Rules #7,
   2026-07-25). 남은 질문은 제한 자체의 채택 여부 — **통제 쌍 스테이지 3(off) ↔ 4(on,
   그 외 동일)** 비교와 패배 원인 계측(scoring-winlose 이관)으로 결정. 폐기 시
   movesEnabled 필드는 유지하되 전 스테이지 off. — Owner: 사용자 / 시점: MVP 플레이테스트
3. ~~비 pyramid-10 레이아웃 도입 시점~~ → **결정(2026-07-25)**: Vertical Slice 10개
   스테이지는 pyramid-10 단일 레이아웃으로 확정. 변형 레이아웃은 VS 이후 재론
   (card-model Open Question #2에도 결정 반영됨).
