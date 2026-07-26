# Systems Index: 우드 콘솔 — 같은 그림 찾기 (가제)

> **Status**: Approved (2026-07-25) — **2026-07-26 구현 현황 반영**
> **Created**: 2026-07-25 · **Last Updated**: 2026-07-26
> **Source Concept**: design/gdd/game-concept.md (마스터 채택 이전 역설계 — 참고용)
> **Master Rules**: `design/combo-match-core.md` (기획 GDD v1.0 — 충돌 시 우선, ADR-001 참조).
> 규칙 장치 7종 전부 해커톤 스코프 포함.
>
> ⚠️ **문서와 코드의 관계**: 아래 표의 설계 문서들은 **설계 의도 기록**이다.
> 실제 동작의 진실은 **코드**이고, 규칙의 진실은 **마스터 GDD**다. 구현은 `runOneSim()`
> 동작 동치로 검증했으며(테스트 123개) 이후 감사·수정이 누적되어 문서 세부와 코드가
> 다를 수 있다. 코드를 고칠 때 설계 문서를 기준으로 삼지 말 것.

---

## Overview

트라이픽스 솔리테어 변형(심볼 공유 매칭) 웹 카드 퍼즐. 코어 루프는 "스포트라이트 확인 →
공유 심볼 스캔 → 선택(콤보 상승) → 막히면 드로우(콤보 희생)"이며, 게임플레이 계열
7개 시스템이 이 루프를 구동하고, UI/연출 계열이 Pillar 1(아늑한 촉감)·Pillar 2(연쇄의
쾌감)를 전달한다. 보드 생성기는 Pillar 3(막히지 않는 진행)의 "매치 보장 불변식"을
소유하는 최고위험 시스템이다. NHN 해커톤 과제로, 마감 시점 목표는 사실상 Alpha 티어.

---

## Systems Enumeration

| # | System | Priority | 상태 | 구현 위치 | 설계 문서 |
|---|--------|----------|------|-----------|-----------|
| 1 | card-model | MVP | ✅ 완료 | `src/core/types.ts` (LevelCardData·RuntimeCard), `engine.ts` (제거·개방 상태) | card-model.md |
| 2 | board-generator | MVP | ✅ 완료 (방식 변경) | `tools/generate-levels.mjs` — 자체 생성기 대신 **디자이너 툴의 생성·검증 로직을 재사용**한다 (규칙 이중화 방지) | board-generator.md |
| 3 | matching | MVP | ✅ 완료 | `engine.ts` — `tryMatch`·`rejectReasonFor`(게이트 우선순위 8종) | matching.md |
| 4 | deck-draw | MVP | ✅ 완료 | `engine.ts` — `draw()` (스톡 pop → 풀 셔플 폴백, 콤보 리셋) | deck-draw.md |
| 5 | combo | MVP | ✅ 완료 | `engine.ts` — 콤보 카운터·`cgoal` 배수 보너스 | 없음 (마스터 §4가 명세 — combo.md는 미작성) |
| 6 | scoring-winlose | MVP | ✅ 완료 | `engine.ts` — 점수·종료 판정 6종(`EndReason`), play-scene 결과 오버레이 | 없음 (마스터 §4) |
| 7 | level-config | MVP | ✅ 완료 | `src/core/level-loader.ts` — `level@2` 로더 + fail-fast 검증, `level@1` 하위 호환 | level-config.md |
| 8 | items (🌟와일드·🔍힌트·🧲집게) | MVP~VS | ✅ 완료 | `engine.ts` (`useWild`·`useClaw`·`addWild`·`getMatchableIds`), play-scene 아이템 UI·무장 상태 머신 | 없음 (마스터 §4.3) |
| 9 | coin-economy | VS | ✅ 완료 | `src/game/wallet.ts` — 정산(마스터 §7 공식)·`economy` 블록 정규화·구매 차감 | 없음 (마스터 §7) |
| 10 | persistence | Alpha | ✅ 완료 | `wallet.ts`(골드) + `src/game/progress.ts`(클리어·최고점) — localStorage, 접근 차단 시 안전 실패 | 없음 |
| 11 | app-shell | MVP | ✅ 완료 | `src/main.ts` + `src/game/layout.ts` — 반응형 스테이지(화면비·dpr), 회전 대응, 씬 라우팅 | 없음 |
| 12 | hud-ui | MVP | ✅ 완료 | play-scene — SCORE·콤보 게이지·🪙지갑·목표 진행·COMBO 뱃지·덱·MOVES | 없음 (ADR-001 O-1·O-3 해소) |
| 13 | vfx-juice | VS | 🟡 부분 | play-scene — 제거·개방 트윈, 스포트라이트 회전 광선, 폭탄 임박 흔들림, 게이트 해제 플래시. **파티클·화면 전환 연출은 미착수** | 없음 |
| 14 | audio | Alpha | ⬜ 미착수 | — | 없음 |
| 15 | onboarding | VS | ✅ 완료 | `src/game/help-overlay.ts`(규칙 5줄·범례) + 레벨 1~3 튜토리얼 초록 표시 | 없음 |
| 16 | level-select *(신규)* | MVP | ✅ 완료 | `src/game/level-select-scene.ts` — 12레벨 그리드·진행 표시·장치 아이콘, 잠금 없음(심사 편의) | 없음 |
| 17 | designer-handoff *(신규)* | VS | ✅ 완료 | `src/game/level-source.ts`(해시·playtest 채널) + `tools/sync-designer.mjs`(툴 배포) — 절차는 `docs/level-design.md` | 없음 |

> 신규 2종(16·17)은 최초 열거(2026-07-25) 당시 없던 시스템으로, 구현 중 필요가 확인되어 추가됐다.
> 설계 문서가 "없음"인 시스템은 마스터 GDD나 ADR-001이 명세를 대신하며 별도 GDD를 만들지 않았다.

---|-------------|----------|----------|--------|------------|------------|
| 1 | card-model (inferred) | Core | MVP | Designed (리뷰 반영, 재리뷰 보류) | design/gdd/card-model.md | level-config (soft — MVP 하드코딩 대체 가능) |
| 2 | board-generator | Gameplay | MVP | Designed (리뷰 반영, 재리뷰 보류) | design/gdd/board-generator.md | card-model, level-config, matching (hard: sharesSymbol), scoring-winlose (시뮬레이션 한정) |
| 3 | matching | Gameplay | MVP | Designed (리뷰 반영, 재리뷰 보류) | design/gdd/matching.md | card-model |
| 4 | deck-draw | Gameplay | MVP | Designed (리뷰 대기) | design/gdd/deck-draw.md | card-model, level-config (간접 — deckSize는 board-generator 경유, 2026-07-26), matching (hard: setSpotlightFromDraw 호출) |
| 5 | combo | Gameplay | MVP | Not Started | — | matching (matchSucceeded=+1, spotlightChanged(draw)=리셋 — deck-draw 직접 결합 제거, 2026-07-26) |
| 6 | scoring-winlose | Gameplay | MVP | Not Started | — | matching, combo, deck-draw, level-config, card-model (soft) |
| 7 | level-config (inferred) | Gameplay | MVP | Designed (리뷰 반영, 재리뷰 보류) | design/gdd/level-config.md | 없음 |
| 8 | items (구 wildcard — 🌟와일드·🔍힌트·🧲집게) | Economy | **MVP**(와일드는 코어 자원) ~ VS(힌트·집게) | Not Started | — | matching, deck-draw, coin-economy(가격) — 마스터 §4.3 |
| 9 | coin-economy | Economy | Vertical Slice | Not Started | — | combo, scoring-winlose, items — **마스터 §7 공식 채택** (ADR-001 C10) |
| 10 | persistence (inferred) | Persistence | Alpha | Not Started | — | coin-economy, scoring-winlose |
| 11 | app-shell (inferred) | Core | MVP | Not Started | — | level-config (soft: 프리로드) |
| 12 | hud-ui (inferred) | UI | MVP | Not Started | — | card-model (hard), app-shell, matching, combo, deck-draw, scoring-winlose |
| 13 | vfx-juice (inferred) | UI | Vertical Slice | Not Started | — | app-shell, card-model (soft), matching, combo |
| 14 | audio (inferred) | Audio | Alpha | Not Started | — | app-shell, card-model (soft), matching, combo |
| 15 | onboarding (inferred) | Meta | Vertical Slice | Not Started | — | hud-ui |

---

## Categories

| Category | Description | 이 게임의 시스템 |
|----------|-------------|-----------------|
| **Core** | 모든 것이 의존하는 기반 | card-model, app-shell |
| **Gameplay** | 재미를 만드는 시스템 | board-generator, matching, deck-draw, combo, scoring-winlose, level-config |
| **Economy** | 재화 생성·소비 | wildcard, coin-economy |
| **Persistence** | 저장/연속성 | persistence (localStorage) |
| **UI** | 플레이어 대면 표시 | hud-ui, vfx-juice |
| **Audio** | 사운드 | audio |
| **Meta** | 코어 루프 밖 | onboarding |

---

## Priority Tiers

| Tier | Definition | Target Milestone | Design Urgency |
|------|------------|------------------|----------------|
| **MVP** | 코어 루프 재미 가설 검증에 필수 (9개) | 첫 플레이어블 | Design FIRST |
| **Vertical Slice** | 심사 데모 품질 (4개) | 해커톤 데모 | Design SECOND |
| **Alpha** | 제출판 완성 (2개) | 해커톤 제출 | Design THIRD |
| **Full Vision** | 해커톤 이후 (🌟 수집 메타 등 — 미등록) | — | 필요시 |

---

## Dependency Map

### Foundation Layer (no dependencies)

1. card-model — 카드(심볼 2개)·피라미드 배치·커버/개방 상태. 6개 시스템이 의존하는 최대 병목.
   (level-config에 soft 상류 의존 — MVP 단계엔 하드코딩 데모 레이아웃으로 대체 가능하여
   Foundation에 유지. card-model.md Dependencies 참조)
2. level-config — 레벨 파라미터(목표 점수, 덱 크기, 이동 수, 과일 종수, 레이아웃)
3. app-shell — Phaser 씬 관리(부트→게임→결과), 1280×760 스케일링, 로드 3초 예산

### Core Layer

1. board-generator — depends on: card-model, level-config, matching(hard: `sharesSymbol` 임포트 — 2026-07-25 설계 중 발견된 엣지) ⚠️ 매치 보장 불변식 소유
2. matching — depends on: card-model (심볼 공유 판정·스포트라이트 교체·유효 수 계산)
3. deck-draw — depends on: card-model, level-config(hard: deckSize), matching(`setSpotlightFromDraw` 호출 — 2026-07-26 matching 설계로 확정)
4. combo — depends on: matching만 (`matchSucceeded`=+1, `spotlightChanged(source:'draw')`=리셋 — deck-draw 직접 결합 제거)

### Feature Layer

1. scoring-winlose — depends on: matching, combo, deck-draw, level-config, card-model(soft: `boardCleared`·잔량 질의)
2. wildcard — depends on: matching, deck-draw (구매 검증은 economy에 위임 — 아래 순환 해결 참조)
3. coin-economy — depends on: combo(파우셋), scoring-winlose, wildcard(싱크)
4. persistence — depends on: coin-economy, scoring-winlose

### Presentation Layer

1. hud-ui — depends on: **card-model(hard: `getAllCards()`·이벤트·좌표 공식)**, app-shell + 게임 상태(matching, combo, deck-draw, scoring-winlose)
2. vfx-juice — depends on: app-shell, card-model(soft: 이벤트) + 게임 이벤트(matching, combo)
3. audio — depends on: app-shell, card-model(soft: 이벤트) + 게임 이벤트(matching, combo)

### Polish Layer

1. onboarding — depends on: hud-ui

---

## Recommended Design Order

| Order | System | Priority | Layer | Agent(s) | Est. Effort |
|-------|--------|----------|-------|----------|-------------|
| 1 | card-model | MVP | Foundation | game-designer | S |
| 2 | level-config | MVP | Foundation | level-designer | S |
| 3 | board-generator | MVP | Core | systems-designer | M ⚠️최우선 프로토타입 |
| 4 | matching | MVP | Core | game-designer | S |
| 5 | deck-draw | MVP | Core | game-designer | S |
| 6 | combo | MVP | Core | systems-designer | S |
| 7 | scoring-winlose | MVP | Feature | systems-designer | M (공식 미정 해소 필요) |
| 8 | app-shell | MVP | Foundation | game-designer | S |
| 9 | hud-ui | MVP | Presentation | game-designer | M (시안 이식) |
| 10 | wildcard | VS | Feature | game-designer | S |
| 11 | coin-economy | VS | Feature | economy-designer | M (🌟 결정 포함) |
| 12 | vfx-juice | VS | Presentation | game-designer | M |
| 13 | onboarding | VS | Polish | game-designer | S |
| 14 | audio | Alpha | Presentation | game-designer | S |
| 15 | persistence | Alpha | Feature | systems-designer | S |

---

## Circular Dependencies

- **wildcard ↔ coin-economy**: 와일드카드는 구매 시 잔액 확인이 필요하고, 이코노미는
  와일드카드를 싱크로 참조한다. **해결(승인됨)**: wildcard는 `purchaseRequested` 이벤트만
  발행하고 잔액 검증·차감·승인은 coin-economy가 전담하는 인터페이스 계약으로 절단.
  wildcard GDD는 이벤트 스펙만 정의하면 coin-economy 설계 전에도 완결 가능.

---

## High-Risk Systems

| System | Risk Type | Risk Description | Mitigation |
|--------|-----------|-----------------|------------|
| board-generator | Technical/Design | 매치 보장 + 난이도 통제 알고리즘 미검증. 실패 시 Pillar 3 붕괴(데드락) | `/prototype board-generator` 최우선 실행 |
| scoring-winlose | Design | 점수 공식·이동 제한(14) 필요성이 Open Question | 프로토타입에서 이동 제한 온/오프 A/B |
| matching | Design | "1개 공유" 규칙의 재미 가설 미검증 (MVP 핵심 가설) | MVP 플레이테스트로 검증 |
| vfx-juice | Scope | 연출 욕심으로 해커톤 일정 침식 | 타임박스 + 콤보/매칭 연출만 우선 |
| card-model | Structural | 6개 시스템이 의존하는 병목 — 설계 오류 시 파급 큼 | 1순위 설계 + 리뷰 필수 |

---

## Progress Tracker

> 설계 문서 진척이 아니라 **구현 진척**을 센다 (2026-07-26 갱신). 설계 단계에서 GDD 5종을
> 쓴 뒤 마스터 GDD를 단일 진실로 채택했기 때문에, 이후 시스템들은 별도 GDD 없이 구현했다.

| 지표 | 수 |
|---|---|
| 열거된 시스템 | 17 (최초 15 + 구현 중 추가 2) |
| ✅ 구현 완료 | 15 |
| 🟡 부분 구현 | 1 (vfx-juice — 파티클·화면 전환 미착수) |
| ⬜ 미착수 | 1 (audio) |
| 설계 GDD 보유 | 5 (card-model · level-config · board-generator · matching · deck-draw) |
| 테스트 | 123개 (엔진 차등 270회 재생 · 레벨 팩 품질 게이트 · 반응형 레이아웃 7기기) |

---

## Next Steps

**개발은 사실상 마무리 단계다.** 남은 것은 폴리시와 제출물이다.

- [x] 시스템 열거 승인 (2026-07-25)
- [x] MVP 시스템 구현 (엔진 → Phaser 이식 → 레벨 팩 → 아이템·경제 → 온보딩)
- [x] 독립 감사 3관점 27건 검증·반영 (2026-07-26)
- [x] 배포 개통 — https://bjh7536.github.io/combo-match/
- [x] 반응형·모바일 대응 및 선명도 수정
- [ ] audio (미착수 — 여유 시)
- [ ] vfx-juice 잔여 (파티클·화면 전환 연출)
- [ ] 제출물 4종: 플레이 영상 · 게임 소개 PDF · AI 활용 문서 PDF · 팀원 롤 PDF
      (체크리스트: `production/hackathon-submission.md`)
