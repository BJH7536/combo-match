# Technical Preferences

<!-- Populated by /setup-engine (2026-07-25). Updated as the user makes decisions throughout development. -->
<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Engine**: Phaser 3.90.0 "Tsugumi" (웹 게임 프레임워크, v3 최종 안정판)
- **Language**: TypeScript (strict 모드)
- **Platform**: 웹 브라우저 (데스크톱 우선, 모바일 브라우저 호환 고려)
- **Rendering**: WebGL (Canvas 자동 폴백) — Phaser AUTO
- **Physics**: 미사용 (카드 퍼즐 — 트윈 기반 연출만)
- **Networking**: 없음 (싱글 플레이, 정적 호스팅)
- **Services**: 없음 (해커톤 스코프)

## Naming Conventions

- **Classes**: PascalCase (예: `GameScene`, `CardSprite`)
- **Variables**: camelCase (예: `moveCount`, `comboMultiplier`)
- **Constants**: UPPER_SNAKE_CASE (예: `MAX_COMBO`, `WILDCARD_PRICE`)
- **Enums**: PascalCase 타입 + PascalCase 멤버 (예: `CardState.Uncovered`)
- **Signals/Events**: camelCase 과거형 문자열 (예: `'cardMatched'`, `'comboReset'`)
- **Files**: kebab-case.ts (예: `game-scene.ts`, `board-generator.ts`)
- **Scenes/Prefabs**: 씬 키는 PascalCase 문자열 (예: `'Game'`, `'Result'`)

## Performance Budgets

- **Target Framerate**: 60fps
- **Frame Budget**: 16.6ms
- **초기 로드**: 3초 이내 (해커톤 심사 기준 — 번들 크기 상시 주시)
- **Memory Ceiling**: [TO BE CONFIGURED] — 모바일 브라우저 테스트 후 설정

## Testing

- **Framework**: Vitest
- **Minimum Coverage**: 코어 게임 로직(매칭 판정, 보드 생성, 콤보/점수 계산) 유닛 테스트 필수 — 수치 커버리지 목표는 미설정
- **Required Tests**: 보드 생성기의 "매치 보장" 불변식, 매칭 판정 규칙, 콤보 리셋/점수 공식

## Forbidden Patterns

<!-- Populated as architecture decisions are made. -->
- Phaser 물리 엔진(Arcade/Matter) 사용 금지 — 이 게임에 불필요, 번들만 커짐

## Allowed Libraries / Addons

<!-- Populated as dependencies are approved. -->
- phaser@3.90.0, vite, vitest, typescript

## Architecture Decisions Log

<!-- One-line summaries. Full ADRs live in production/adr/ via /architecture-decision. -->
- 2026-07-25: 엔진으로 Phaser 3.90.0 채택 (해커톤 속도·LLM 지식 리스크 LOW·웹 네이티브) — Godot/Unity/Phaser 4 대비 검토
