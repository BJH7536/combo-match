# ADR-001: 기획 마스터 GDD 채택 및 세션 GDD 재정렬

> **Status**: Accepted (2026-07-26, 사용자 확정)
> **Context**: 기획자 팀원의 구현 기준 GDD `design/combo-match-core.md`(v1.0)와 동작
> 프로토타입 `tools/level-designer.html`이 2026-07-26 합류. 세션에서 작성한 GDD 6종과
> 대조 결과 일치 11건 / 충돌 13건 / 신규 5건.

## 결정 (사용자, 2026-07-26)

1. **마스터 채택**: `combo-match-core.md` = 규칙·밸런스의 단일 진실. 세션 GDD 6종은
   **구현 계약 계층**(TS 타입, Result 패턴, 이벤트 계약, 테스트 AC)으로 재정렬.
   충돌은 기획자 우선으로 해소.
2. **C1 하이라이트**: 매칭 가능 카드 **무표시** (D-2 채택) + 유료 🔍힌트(120골드).
   튜토리얼(레벨 1~3)만 표시 허용. `getMatchableCards()` API는 존치 — 용도가
   상시 하이라이트에서 힌트 아이템·튜토리얼·시뮬레이션 분기 계산으로 변경.
3. **C2 승리 조건**: 목표 유형 3종(`clear`/`score`/`collect`) 채택 — 기존 목표
   점수제는 `score` 유형으로 포섭.
4. **장치 스코프**: F계층 규칙 장치 **7종 전부 해커톤 포함** (열쇠·폭탄·수집·구역·
   종이+조각·콤보잠금·뒤집힘). 권장안(제외)을 기각한 사용자 결정.
   일정 압박 시 컷 순서(사전 합의): 종이 → 구역 → 열쇠 (수집·폭탄·콤보잠금·뒤집힘은
   구현 비용이 낮아 유지).

## 충돌 해소 전문 (마스터 우선 원칙 적용)

| # | 항목 | 해소 | 영향 문서 |
|---|------|------|----------|
| C1 | 하이라이트 | 무표시 + 유료 힌트 (튜토리얼 예외) | matching, hud-ui(미설계), ui_draft |
| C2 | 승리 조건 | objective 3종 | scoring-winlose(미설계), level-config, game-concept |
| C3 | k·r | `symbols: SymbolId[]` (1~6) 가변 + `r` 노브로 일반화. "k=2 고정 튜플" 폐기 | card-model, matching, board-generator |
| C4 | 보드 생성 | **해답 체인 선배치**(by construction) 채택, rejection sampling 폐기. I1은 생성 결과 검증 assert로 강등 | board-generator |
| C5 | MOVES | 마스터 준거: 카드 제거(매치·와일드)만 차감, 기본 무제한(노브) — 세션 확정(매치+드로우 차감) 대체 | level-config, scoring-winlose |
| C6 | 점수 | `10 × 콤보` + cgoal 배수마다 `+100 × 콤보` | scoring-winlose, level-config(targetScore 재산정) |
| C7 | 콤보 게이지 | `cgoal` 노브(3~15) — ×10 고정은 cgoal=10 특수 케이스 | combo(미설계) |
| C8 | 덱 | 리드로우 카운터 + `deckStock` 우선 소진, 스톡 고갈 시 풀 랜덤 k개 | deck-draw |
| C9 | 실패 모델 | 소프트 실패 — 패배 시 25% 골드 위로 | scoring-winlose, coin-economy(미설계) |
| C10 | 경제/🌟 | 골드 경제 전면 채택 (기본골드 15+3×레벨, 환율 0.01×(1+난이도/40), 아이템 힌트120·집게350·와일드500). **🌟 = 와일드 아이템으로 확정** | coin-economy, wildcard→items로 확장 |
| C11 | 아이템 | 힌트·집게 신규 — wildcard 시스템을 **items**로 확장 | systems-index, wildcard |
| C12 | 규칙 장치 | 7종 전부 포함 (결정 4) — 카드 필드: lockReq/faceDown/unlockedBy/bombCounter/zone/paper/piece | card-model, matching, board-generator |
| C13 | 레벨 스키마 | **`combo-match/level@2` 전면 채택** — 세션 LevelConfig/BoardLayout 스키마 대체. 디자이너 툴 export와 직접 호환 | level-config |

## 규칙의 레퍼런스 구현

`tools/level-designer.html`의 `runOneSim()`(줄 537~612)이 **게임 규칙의 실행 가능한
명세**다 — 게이트 판정(free ∧ zone ∧ unlockedBy ∧ paper ∧ lockReq), 매칭(공유 ≥ r),
점수식, 폭탄 틱, 수집 조기 승리, 와일드(게이트 우회 불가, 콤보 유지 max(1, combo))가
전부 들어 있다. Phaser 포팅 시 이 함수와 **동작 동치**를 유지할 것 (동일 레벨 JSON +
동일 시드 → 동일 결과가 이상적 목표).

## 후속 항목

- **O-1** ~~게이지 의미 — 기획자 논의~~ → **해소 (2026-07-26)**: 시뮬레이션 정합성이 답을
  강제한다 — `runOneSim`은 cgoal 도달 시 점수 보너스만 주고 아이템을 지급하지 않으므로,
  게임이 별을 지급하면 D-4(시뮬 = 난이도의 진실)가 깨진다. **확정: 게이지 = cgoal 진행
  표시 + 도달 시 점수 보너스 연출, 아이템 지급 없음.** 시안의 "🌟 획득" 라벨은 마스터 이전
  표기로 폐기. 게이지 표현은 hud-ui 소관.
- **O-2** (격하 — 필수 아님, **2026-07-26 기획자에게 요청함**): `game/play.html` 등 누락
  파일 4종은 진행에 불요 — 규칙은 마스터 §4 + `runOneSim`으로 완결. **수신 시 대조 검증용**
  (포팅 결과 vs 원본 게임 비교). 우리 게임이 동일 해시 포맷(`#level=<base64>`)을 수용하면
  디자이너 툴과 직접 연동된다.
- **O-5** (구현 중 발견한 doc↔code 미세 불일치 — 기획자 확인 대기, 코드는 runOneSim 준거):
  ① 와일드가 콤보 잠금(lockReq)을 우회함 (코드) vs §4.2 표는 콤보 잠금 우회 = 집게만 (문서).
  ② 집게의 세부(수집 카운트 여부, moves 차감 여부)는 양쪽 다 미명세 — 엔진은 "수집 카운트
  O, moves 차감 X"로 가정하고 코드 주석에 표기.
- **O-3**: ui_draft 초록 글로우 — D-2 채택으로 상시 표시 폐기. 시안의 글로우는
  free(선택 가능) 표시로 의미 변경 또는 제거 → hud-ui 설계 시 확정
- **O-4**: 세션 GDD 6종 본문 개정은 해당 모듈 **구현과 병행** 진행 (배너로 우선순위 고지
  완료). 마감 우선 — 문서 전면 재작성으로 일정 소모 금지

## Consequences

- (+) 팀 설계 이원화 해소, 동작 검증된 규칙·생성기·시뮬레이터 확보, 🌟/점수 공식/경제 등
  미결 7건 일괄 해소, 디자이너 툴과 레벨 JSON 직접 교환 가능
- (−) 장치 7종 포함으로 구현량 증가 (로직 +1~2일, UI +1~2일 추정) — 컷 순서 사전 합의로 방어
- (−) card-model·board-generator의 승인된 계약 일부 폐기 — 매몰 비용은 낮음 (코드 미착수)
