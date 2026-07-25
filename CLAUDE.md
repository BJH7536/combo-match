# NHN_Task — 우드 콘솔: 같은 그림 찾기 (가제)

NHN 해커톤 참가용 웹 게임. 트라이픽스 솔리테어 변형(심볼 공유 매칭) 카드 퍼즐.
코어 규칙 준거: 디즈니 솔리테어 (SuperPlay). 상세는 `design/gdd/game-concept.md`.

## Technology Stack

- **Engine**: Phaser 3.90.0 "Tsugumi" (v3 최종 안정판, 2025-05-23)
- **Language**: TypeScript (strict)
- **Build System**: Vite
- **Asset Pipeline**: 정적 에셋(`public/`) + Vite 번들링
- **Platform**: 웹 브라우저 (1280×760 기준 스테이지, 뷰포트 스케일링)
- **Testing**: Vitest (게임 로직 유닛 테스트)
- **Deploy**: GitHub Pages (해커톤 제출 요건 확정, 2026-07-26 — 커밋 기록 유지 필수)

## Engine Version Reference

@docs/engine-reference/phaser/VERSION.md

## Key Documents

- `design/gdd/game-concept.md` — 게임 컨셉 (reverse-documented, 코어 규칙 확정본)
- `.claude/docs/technical-preferences.md` — 코딩 표준·네이밍·성능 기준
- `ui_draft.html` — UI 시안 (W2 스포트라이트, 확정 규칙 반영됨)

## 해커톤 우선순위

1. 심사위원이 링크 클릭 후 **3초 내 플레이 시작** (초기 로드 최우선)
2. 코어 루프 완성도 > 기능 개수
3. UI 시안의 우드 질감·연출 재현
