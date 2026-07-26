# Active Session State

> Last Updated: 2026-07-26

## Current Task

- **Task**: 엔진 독립 감사(wf_49cf7fab-663) 전체 완료 및 반영 — 완료
- **감사 최종**: fidelity 재개 실행으로 3관점 감사 + verify 전부 완료(27건 중 25 확정·2 반박).
  반영: ①cgoal 가드 truthy 동치+loader 검증 ②loader 강화(deck/wild/moves/k·zone·카드 필드
  비숫자/비정수 차단, 최상위 필드 형태 가드 — raw TypeError 제거, collectGoal 달성 가능성,
  scoreGoal 검증, cards 방어 복사) ③isStuck wildLeft 극성 통일(<=0) ④언커버 계산 Set화
  ⑤차등 테스트 확장: 픽스처 9종×2정책×15시드=270회 + 종료 사유(endReason) 단언 +
  와일드 강제 픽스처(기존 210회 중 w 6회 → 매 시드 강제) ⑥유닛 갭: 폭탄 폭발 3경로,
  와일드×이동제한 핀, 구역 3단, isRevealed/addWild/getMatchableIds 직접 단언 등.
- **반영 안 함(기록)**: 집게 수량 비추적(반박 — 세션 계층 소유가 의도), useWild/useClaw 거부
  이벤트 비대칭(matching.md Open Question — UI 구현 시 결정), zone 상한 0..3 vs 마스터 0..2
  (설계 판단 필요), 언커버 역인덱스 최적화(시뮬 전용화 시).
- **엔진 현황**: src/core 5개 모듈, 테스트 70개 통과, tsc strict 통과.
- **(신규) Phaser app-shell 1차**: src/game 3모듈 + main.ts 부트스트랩 —
  play-scene(보드 렌더·카드 입력·드로우/와일드 버튼·HUD·종료 오버레이·막힘 안내),
  level-source(`#level=<base64>` 해시 디코드 — 디자이너 handoff 호환 + 내장 데모 레벨),
  board-layout(뷰포트 맞춤 순수 함수). 테스트 77개, `npm run build` 통과(gzip 340KB).
  **브라우저 실기 검증 완료(2026-07-26)**: 데모 레벨 완주 — 매치 체이닝·개방 전이·드로우
  (스톡 pop 순서)·와일드(무장 토글, 콤보 유지, 무보너스)·거부 토스트·승리 오버레이(점수 210
  검산 일치)·콘솔 에러 0. 관찰 항목: 드로우 버튼 첫 클릭 1회 무반응(재현 안 됨 — 합성 클릭
  플레이크 추정, 실기기 터치에서 재확인).
  잔여: 우드 스킨·연출·사운드(8/3~), localStorage 채널, 소프트 실패 세션 계층,
  Phaser 코드 스플릿(번들 경고), GitHub Pages 배포 개통.
  다음: 우드 스킨·장치 UI (8/3~) 또는 GitHub 원격+Pages 개통
- **(이전 작업)**: 기획 마스터 GDD 채택 및 정렬 (ADR-001) — 완료
- **Status**: combo-match-core.md를 규칙의 단일 진실로 채택 (사용자 결정 4건: 마스터 채택 /
  무표시+유료 힌트 / 목표 3종 / **장치 7종 전부 포함**). 충돌 13건 해소 기록, GDD 6종 배너,
  인덱스·일정 갱신. combo·scoring 등 미설계 시스템은 별도 GDD 없이 마스터 §4 + runOneSim을
  명세로 직접 구현.
- **다음**: 규칙 엔진 코어 TS 포팅 착수 (7/27~29) — runOneSim 동작 동치 + level@2 로더 +
  Vitest. 이후 Phaser 이식(7/30~).
- **미결**: ADR-001 O-3(시안 글로우 재정의 — hud-ui 설계 시)만 잔존.
  O-1은 해소(게이지 = cgoal 진행 + 점수 보너스, 아이템 지급 없음 — 시뮬 정합성 논리),
  O-2는 격하(누락 파일 불요 — 규칙은 마스터 §4 + runOneSim으로 완결). 기획자 요청 불필요.
- **직전 완료**: level-config 리뷰 21건 반영 (MOVES=매치+드로우 확정, sanity 공식 교정, A/B 통제 쌍, card-model 시그니처 개정)
- **직전 완료**: card-model.md Revised (리뷰 23건 반영, 재리뷰 보류 — 인덱스 상태 Designed)

## Recent Milestones

- 2026-07-24: ui_draft.html 디자인 리뷰 (MAJOR REVISION NEEDED → 규칙 확정으로 해소)
- 2026-07-24: design/gdd/game-concept.md 작성 (reverse-documented, 디즈니 솔리테어 준거)
- 2026-07-24: ui_draft.html 확정 규칙 반영 + 기술 부채 수정
- 2026-07-25: /setup-engine — Phaser 3.90.0 + TS + Vite 확정, CLAUDE.md/기술선호 작성
- 2026-07-25: /map-systems — 15개 시스템 열거·의존성·우선순위 승인, systems-index 생성

## Next

- Design individual system GDDs (design order: card-model → level-config → board-generator → …)
- `/prototype board-generator` — 최고위험 시스템 조기 검증
