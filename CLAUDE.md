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

**처음 읽는다면 이 순서로** — 세 문서(합 400줄 미만)로 전체가 잡힌다.

1. `production/adr/ADR-001-master-alignment.md` — **모든 규칙 결정의 뿌리.** 마스터 GDD 채택,
   충돌 13건 해소, 미결 항목(O-5만 잔존: 와일드의 콤보 잠금 우회·집게 세부 미명세)
2. `production/session-state/active.md` — 진행 로그. 무엇을 왜 어떻게 고쳤는지 (제출물 ④의 뼈대)
3. `design/combo-match-core.md` — **기획 마스터 GDD v1.0. 규칙·밸런스의 단일 진실** (충돌 시 우선)

**작업별 참조**

- `docs/level-design.md` — 레벨 만들기 (기획자용: 툴 사용 → 플레이테스트 → 레벨 팩 편입)
- `design/gdd/systems-index.md` — 시스템 17종의 **구현 현황과 코드 위치**
- `production/hackathon-submission.md` — 제출물 체크리스트와 남은 일
- `.claude/docs/technical-preferences.md` — 코딩 표준·네이밍·성능 기준
- `tools/level-designer.html` — 레벨 디자인 툴. `runOneSim()`이 **규칙의 실행 가능한 명세**

**읽을 때 주의** (낡거나 대체된 문서)

- `design/gdd/*.md` 5종 — 설계 의도 기록이다. **실제 동작의 진실은 코드**이고 세부가 다를 수 있다
- `design/gdd/game-concept.md` — 마스터 채택 *이전* 역설계 문서. 컨셉·필러 참고용
- `design/gdd/combo.md` — 의도적으로 미작성 (마스터 §4가 명세)
- `design/reference/planner-README.md` — 기획자 원본, **2026-07-28 최신판** (`level@2`·장치 7종·패턴 8종·보상 트랙). 경로 설명만 저장소와 다름. 인수인계·백로그는 `planner-HANDOFF.md`
- `ui_draft.html` — UI 시안. 초록 하이라이트 의미는 튜토리얼 전용으로 재정의됨 (ADR-001 O-3)

## 해커톤 우선순위

1. 심사위원이 링크 클릭 후 **3초 내 플레이 시작** (초기 로드 최우선)
2. 코어 루프 완성도 > 기능 개수
3. UI 시안의 우드 질감·연출 재현
