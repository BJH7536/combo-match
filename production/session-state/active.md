# Active Session State

> Last Updated: 2026-07-25

## Current Task

- **Task**: deck-draw GDD 완료 (`/design-system deck-draw`)
- **Status**: 전 섹션 작성 완료 — 리뷰 여부 결정 대기
- **File**: design/gdd/deck-draw.md
- **확정된 계약**: draw() Result 스타일(deck-empty 거부 + hud 사전 비활성) ·
  setSpotlightFromDraw 동기 호출 후 리턴 · deckExhausted 1회 보장(scoring 정산 트리거) ·
  initialSpotlight는 덱 큐 밖(부트스트랩→createMatching 직접 전달) ·
  level-config 의존은 간접(board-generator 경유)으로 격하
- **다음**: 설계 순서 6위 combo (MVP 게임플레이 계열 마지막 이벤트 소비자 설계)
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
