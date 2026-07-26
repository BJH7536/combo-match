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
- **(신규) 배포 개통 완료(2026-07-26)**: GitHub public 저장소 `BJH7536/combo-match`,
  Pages 라이브 **https://bjh7536.github.io/combo-match/** (실기 검증 — 렌더 정상·콘솔 에러 0).
  `.github/workflows/deploy.yml`이 main 푸시마다 테스트→빌드→배포. 첫 실행은 Pages 사이트
  미생성으로 실패 → `gh api -X POST .../pages -f build_type=workflow`로 활성화 후 재실행 성공.
- **(신규) 우드 콘솔 스킨 적용(2026-07-26)**: `src/game/skin.ts` — ui_draft.html의 CSS 그라디언트·
  나무 결·입체 그림자를 런타임 CanvasTexture로 재현(외부 에셋 0, 번들 증가 없음).
  씬 재구성: 펠트 배경·나무 헤더바(SCORE·콤보 게이지)·스포트라이트 액티브 카드(회전 광선+
  원형 비네트+"▼ 같은 그림 찾기 ▼" bob 배너)·오렌지 COMBO 뱃지(pulse, 🔥 단계)·
  보라 덱 박스·와일드 슬롯(무장 시 오렌지 전환)·MOVES 다이얼·우드 결과 패널.
  **실기 검증**: 데모 레벨 완주 SCORE 890(수기 검산 일치), 콤보 8 도달, cgoal 보너스 +550 토스트,
  드로우·와일드 무장·승리 오버레이 정상, 콘솔 에러 0.
  **디버깅 기록 2건**: ①CanvasTexture 규격을 소수로 비교해 매 프레임 remove/재생성 →
  참조 중인 Image의 frame.source가 null이 되어 렌더 루프 사망(`glTexture` 예외).
  해결: 규격 정수화 + 소스 캔버스 실측 비교. ②자동화 중 카드가 안 사라지는 현상은
  버그가 아니라 백그라운드 탭(document.hidden)에서 Phaser 루프가 멈춘 것 —
  검증 시 `game.step()` 수동 진행으로 확인.
  잔여: 사운드, Phaser 코드 스플릿(번들 경고),
  장치 UI 연출(자물쇠·폭탄·구역·종이는 배지로만 표시 중).
- **(신규) 기획자 자료 4종 수신·대조 완료(2026-07-26, ADR-001 O-2 해소)**:
  `design/difficulty-elements.md`, `design/level-mechanics-brainstorm.md`,
  `design/reference/{play-reference.html, sample-level-1234.json, planner-README.md}` 수록.
  마스터 GDD·디자이너 툴은 바이트 동일(정렬 유효). **level@1 하위 호환 수정** — 실물 레벨이
  F계층 필드 없이 오므로 로더를 "부재 허용·정규화 / 값 있으면 엄격 검증"으로 바꾸고
  `LevelCardData`(입력) ↔ `RuntimeCard`(런타임) 타입 분리. 테스트 80개 통과.
  **엔진 대비 미구현으로 확인된 것은 세션/경제 계층뿐**: 골드(`combo-match:gold`),
  아이템 구매(힌트 120·집게 350·와일드 500 — 엔진 API는 이미 존재),
  localStorage playtest 채널·storage 라이브 갱신, 파일 열기, `?level=` 쿼리.
  다음 후보: ①레벨 팩 제작(현재 데모 1개뿐 — 심사 콘텐츠 부족) ②아이템·경제 세션 계층
  ③장치 UI 연출 ④사운드
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
