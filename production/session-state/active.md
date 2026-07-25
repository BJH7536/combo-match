# Active Session State

> Last Updated: 2026-07-25

## Current Task

- **Task**: 기획 마스터 GDD 채택 및 정렬 (ADR-001) — 완료
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
