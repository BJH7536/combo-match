---
status: reverse-documented
source: ui_draft.html (W2 스포트라이트 시안)
date: 2026-07-24
verified-by: 사용자 (2026-07-24 문답)
reference-game: Disney Solitaire (SuperPlay, 2025)
---

# Game Concept: 우드 콘솔 — 같은 그림 찾기 (가제)

*Created: 2026-07-24*
*Status: Draft*

> **⚠️ Reverse-Documentation Notice**
>
> 이 문서는 UI 시안(`ui_draft.html`, W2 스포트라이트)이 먼저 만들어진 뒤 역방향으로
> 작성되었다. 시안에서 역추론한 내용 + 사용자 문답으로 확정한 의도 + 준거 게임
> (디즈니 솔리테어) 관례를 구분해 기록한다. `[확정]` = 사용자 확인 완료,
> `[준거]` = 디즈니 솔리테어 관례 채택, `[가정]` = 미확인 추론, `[TBD]` = 미정.

---

## Elevator Pitch

> 따뜻한 원목 보드게임 콘솔 위에서, 스포트라이트에 놓인 카드와 같은 과일을
> 보드 피라미드에서 찾아 연쇄 제거하며 콤보를 쌓아 레벨 목표 점수를 달성하는
> 캐주얼 카드 매칭 퍼즐. 트라이픽스 솔리테어의 루프에 "숫자 ±1" 대신
> "이중 심볼 공유" 매칭을 얹은 변형.

---

## Core Identity

| Aspect | Detail |
| ---- | ---- |
| **Genre** | 캐주얼 퍼즐 / 트라이픽스 솔리테어 변형 |
| **Platform** | **웹 브라우저** `[확정]` — NHN 해커톤 참가용 과제, 링크 접근성 중시 (1280×760 기준 스케일링) |
| **Target Audience** | [TBD] — 캐주얼 퍼즐 유저 추정 |
| **Player Count** | 싱글 플레이 |
| **Session Length** | 레벨당 수 분, 짧은 반복 세션 추정 |
| **Monetization** | [TBD] — UI에 소프트 커런시(코인)와 구매 요소(와일드카드 🪙500) 존재, F2P 시사 |
| **Estimated Scope** | Small 추정 (코어 루프 기준) |
| **Comparable Titles** | **Disney Solitaire (핵심 준거)**, Tiki Solitaire TriPeaks, Solitaire Grand Harvest |

---

## Core Fantasy

아늑한 원목 게임 테이블에 앉아 부담 없이 카드를 넘기는 감각. 손끝 판단만으로
착착 이어지는 연쇄 매칭과 콤보 상승의 쾌감. 하드코어 퍼즐의 긴장이 아니라,
따뜻한 질감(우드/펠트) 위에서의 가벼운 두뇌 놀이와 소소한 성취가 감정적 핵심이다.

---

## Unique Hook

**이중 심볼 매칭**: 트라이픽스 계열의 "현재 카드보다 1 높거나 낮은 카드"를
"카드당 심볼(과일) 2개 중 1개 이상 공유"로 치환했다. 카드 한 장이 두 방향의
연결 고리를 갖기 때문에 수 읽기가 숫자 사다리와 다른 결을 가진다.

- *"디즈니 솔리테어인데, AND ALSO 숫자 대신 그림 조합으로 잇는다"*
- [가정] 이 훅의 실제 재미(수 읽기 깊이 vs 단순 스캔 작업화)는 프로토타입 검증 필요 — MVP 가설.

---

## Player Experience Analysis (MDA Framework)

### Target Aesthetics

| Aesthetic | Priority | How We Deliver It |
| ---- | ---- | ---- |
| **Sensation** | 1 | 우드/펠트 질감, 입체 그림자, 스포트라이트 연출, 콤보 펄스 (시안이 강하게 뒷받침) |
| **Submission** | 2 | 저긴장 반복 루프, 짧은 레벨, 언제든 중단 가능 |
| **Challenge** | 3 | 이동/덱 자원 관리, 콤보 유지 판단 (가벼운 수준) |
| **Discovery** | [TBD] | 메타 진행(레벨/수집) 설계에 따라 결정 |
| **Fantasy / Narrative / Fellowship / Expression** | N/A 추정 | 시안에 근거 없음 |

### Key Dynamics

- 플레이어가 드로우(콤보 리셋)를 아끼려고 보드를 먼저 훑는 습관이 생긴다.
- 콤보 ×10 보상을 앞두고 "안전한 드로우 vs 콤보 유지 모험" 사이의 미니 딜레마가 반복된다.
- 2장뿐인 희소 과일을 기억해뒀다가 아껴 쓰는 자원 관리 행동이 창발하길 기대. [가정]

### Core Mechanics

1. 스포트라이트 심볼-공유 매칭 (아래 Core Loop 참조)
2. 피라미드 개방 (앞줄 제거 → 뒷줄 활성화)
3. 콤보/스트릭 시스템 (드로우 시 리셋, 보상 배가)
4. 레벨 자원 제약 (이동 횟수 + 덱 잔량)
5. 구제 부스터 (와일드카드, 코인 구매)

---

## Core Rules (확정 사항)

> 코어 규칙의 준거 게임은 **디즈니 솔리테어**다. 아래에서 준거와 다르게 결정한
> 항목은 ⚠️ **준거 이탈**로 표시한다.

### 매칭 판정 `[확정]`
- 보드의 **개방된(앞줄) 카드** 중, 스포트라이트 카드와 **과일이 1개 이상 겹치는**
  카드를 선택하면 매치된다.
- 매치된 카드는 보드에서 제거되고 **새 스포트라이트가 된다** `[준거]` (트라이픽스 관례).
- 현 시안 보드(10장) 기준 스포트라이트 🍊🍇와 겹치는 카드는 6장 — 판정 자체는
  관대하고, 난이도는 자원 제약(이동/덱)과 목표 점수로 조인다.

### 드로우 `[준거]`
- 유효 수가 없거나 원하지 않을 때 덱(↺)에서 새 스포트라이트를 뽑는다.
- 드로우는 덱을 1장 소모하고 **콤보를 리셋**한다.

### 콤보 `[준거]`
- 드로우 없이 연속 매칭한 횟수가 콤보(×N)로 표시된다.
- 콤보는 점수/코인 보상을 배가하며, **×10 도달 시 🌟 보상**을 지급한다 (🌟의 정체는 Open Question).

### 승리 / 패배 `[확정]` ⚠️ 준거 이탈
- **승리**: 레벨 목표 점수 도달.
- **패배**: 덱 소진 시점에 목표 점수 미달.
- 디즈니 솔리테어는 "보드 클리어"가 승리 조건이지만 본작은 **목표 점수제**를
  채택한다. 보드 클리어는 보너스 점수 이벤트로 활용 가능. [가정]

### 자원 카운터 `[확정]` ⚠️ 준거 이탈
- **14 MOVES** = 남은 이동(선택) 횟수, **↺22** = 덱 잔량. (시안 라벨을 LEFT→MOVES로 명확화, 2026-07-24)
- 디즈니 솔리테어에는 이동 제한이 없고 덱이 유일한 제약이다. 이동+덱 이중 제약은
  준거 이탈이며, 실제로 필요한지 프로토타입에서 재검토 (Open Question).

### 와일드카드 `[준거]`
- 스포트라이트 슬롯에 덮어서 **다음 선택을 무조건 허용**하는 구제 부스터.
- 코인(🪙500)으로 구매. 무료 획득 경로(콤보 보상과의 관계)는 미정.

---

## Player Motivation Profile

| Need | How This Game Satisfies It | Strength |
| ---- | ---- | ---- |
| **Autonomy** | 어떤 카드로 이을지, 드로우 타이밍 선택 | Supporting |
| **Competence** | 콤보 유지, 자원 아끼기, 목표 점수 달성 | Core |
| **Relatedness** | [TBD] — 시안에 근거 없음 | Minimal 추정 |

### Player Type Appeal (Bartle)
- [x] **Achievers** — 레벨 클리어, 점수, 콤보 마일스톤
- [ ] Explorers / Socializers / Killers — [TBD]

### Flow State Design
- **Onboarding curve**: [TBD]
- **Difficulty scaling**: 목표 점수·이동/덱 배분·과일 종류 수로 조절 추정 [가정]
- **Feedback clarity**: 콤보 펄스, 매칭 가능 카드 하이라이트 (시안 존재, 규칙 재정의 필요)
- **Recovery from failure**: [TBD] — 준거 게임은 코인으로 추가 카드 구매 후 계속하기 제공

---

## Core Loop

### Moment-to-Moment (30초)
스포트라이트 확인 → 앞줄에서 공유 심볼 스캔 → 선택(매치·콤보 상승·새 스포트라이트)
→ 다시 스캔. 막히면 드로우(콤보 희생) 또는 와일드카드(코인 희생).

### Short-Term (레벨 단위, 수 분)
이동 14회·덱 22장 안에서 목표 점수 달성. 콤보 ×10 보상 게이지가 레벨 내 서브 목표.

### Session-Level (30분 내외)
레벨 여러 개 클리어, 코인 축적, LEVEL(계정 레벨) 상승. [가정]

### Long-Term Progression
[TBD] — 시안의 LEVEL 6 외 근거 없음. 준거 게임은 별(스타)로 컬렉션/스토리 해금
(Memory Lane). 유사한 수집 메타 도입 여부 미정.

### Retention Hooks
- **Mastery**: 콤보 기록, 점수 — 시안 근거 있음
- **Investment**: 코인/수집 — [TBD]
- **Curiosity / Social**: [TBD]

---

## Game Pillars (잠정 — 검증 필요)

### Pillar 1: 아늑한 촉감
따뜻한 우드/펠트 물성과 부드러운 피드백이 모든 화면에 우선한다.
*Design test*: 효율적이지만 차가운 UI vs 느리지만 촉감 있는 연출 → 후자.

### Pillar 2: 끊기지 않는 연쇄의 쾌감
콤보 유지가 순간 판단의 중심이 되도록, 매 선택이 다음 연결을 남기는지 보이게 한다.
*Design test*: 새 기능이 콤보 흐름을 끊는다면 → 재설계.

### Pillar 3: 막히지 않는 진행
정상 플레이에서 데드락으로 방치되지 않는다 — 생성 시 매치 보장 또는 구제 수단 상시 제공.
*Design test*: 희소 과일 소진으로 유효 수 0 상황 → 생성 알고리즘/구제 수단이 반드시 커버.

### Anti-Pillars
- **NOT 하드코어 퍼즐**: 깊은 수 읽기 강요는 Submission 미학과 충돌.
- **NOT 대전/실시간 경쟁**: 싱글 저긴장 루프 유지.

---

## Inspiration and References

| Reference | What We Take From It | What We Do Differently | Why It Matters |
| ---- | ---- | ---- | ---- |
| **Disney Solitaire** (SuperPlay, 2025) | 트라이픽스 루프, 드로우=콤보 리셋, 콤보→코인, 와일드카드(슬롯 덮기), 레벨제+수집 메타 구조 | 매칭을 rank ±1 → 심볼 공유로, 승리를 보드 클리어 → 목표 점수제로 | 코어 규칙의 공식 준거 (사용자 지정) |
| Tiki Solitaire TriPeaks | 장르 관례 전반 (개방/커버, 스트릭) | — | 장르 표준 확인용 |
| Solitaire Grand Harvest | 레벨형 트라이픽스의 자원/이코노미 구조 | — | F2P 이코노미 참고 |

**Non-game inspirations**: 원목 보드게임 테이블, 아날로그 카드의 물성 (시안의 아트 방향).

---

## Target Player Profile

| Attribute | Detail |
| ---- | ---- |
| **Age range** | [TBD] |
| **Gaming experience** | 캐주얼 추정 |
| **Time availability** | 짧은 세션 반복 추정 |
| **Platform preference** | [TBD] |
| **Current games they play** | 디즈니 솔리테어, 로얄 매치류 캐주얼 퍼즐 추정 |
| **What they're looking for** | [TBD] |
| **What would turn them away** | [TBD] — 과도한 과금 압박, 난이도 급상승 추정 |

---

## Technical Considerations

| Consideration | Assessment |
| ---- | ---- |
| **Recommended Engine** | **Phaser 3.90.0 + TypeScript + Vite** `[확정]` (2026-07-25 /setup-engine — 해커톤 속도·웹 네이티브·LLM 지식 리스크 LOW) |
| **Key Technical Challenges** | 보드/덱 생성 알고리즘 (매치 보장·데드락 방지), 매칭 가능 카드 하이라이트 로직 |
| **Art Style** | 2D 스타일라이즈드 (우드/펠트 질감). 시안의 이모지는 플레이스홀더 — 실제 에셋 교체 필요 |
| **Art Pipeline Complexity** | Low~Medium |
| **Audio Needs** | [TBD] — 촉감 피드백 중심의 SFX 필요 추정 |
| **Networking** | 없음 추정 (싱글) |
| **Content Volume** | [TBD] — 준거 게임은 1,500+ 레벨 규모 |
| **Procedural Systems** | 보드 생성 (과일 분포·매치 보장) — 핵심 |

### 시안(ui_draft.html) 기술 부채
- ~~헤더 COMBO 알약 `scale(1.16)` 애니메이션 덮어쓰기 버그~~ → 래퍼 분리 패턴으로 수정 완료 (2026-07-24)
- ~~Fredoka 한글 글리프 부재~~ → Jua 폴백 추가 완료
- ~~하이라이트가 확정 규칙과 불일치~~ → 재지정 완료 (초록 글로우 = 스포트라이트와 심볼 공유하는 앞줄 카드)
- ~~preconnect 누락 / 미사용 600 웨이트 / 알파 0 죽은 테두리~~ → 정리 완료
- 인라인 스타일 전면 (카드 스타일 10회 중복) → **프로덕션 전환 시 클래스화 필요 (잔여)**

---

## Risks and Open Questions

### Design Risks
- "1개 공유" 판정은 관대함(현 시안 기준 10장 중 6장 정답) → 재미가 "수 읽기"가 아니라
  "스캔 작업"으로 붕괴할 위험. 난이도 축이 자원 제약으로 쏠리는 것이 의도대로 작동하는지 MVP에서 검증.
- 희소 과일(2장) 소진 시 데드락 가능 → Pillar 3 위반. 생성 알고리즘 요구사항으로 상속.
- 이동(14)+덱(22) 이중 제약이 체감상 중복 규제가 될 위험 (준거 이탈 항목).

### Technical Risks
- 매치 보장 보드 생성의 난이도 곡선 통제 (목표 점수제와의 상호작용) 미검증.

### Market Risks
- 트라이픽스 캐주얼 장르는 대형 준거작(디즈니 솔리테어 등)이 장악한 포화 시장.

### Scope Risks
- 낮음 (코어 루프 기준). 수집 메타 도입 시 콘텐츠 규모 급증 주의.

### Open Questions
1. **🌟의 정체**: 콤보 ×10 보상(획득)과 와일드카드(🪙500 구매)가 같은 자원인지 별개인지 — `[확정: 미정]` (사용자 보류)
2. **이동 제한(14) 유지 여부**: 준거 이탈. 덱만으로 충분한지 프로토타입 검증
3. **이동 소진 시 처리**: 패배인지, 즉시 정산인지 (승패 조건과의 접점)
4. **점수 공식**: 기본 점수, 콤보 배수 반영 방식(곱/가산), 레벨업 임계값
5. **콤보 ×10 이후**: 게이지 리셋 반복인지, 상위 마일스톤(×20…)이 있는지
6. **패배 직전 구제**: 준거 게임식 "코인으로 추가 카드 구매 후 계속하기" 도입 여부
7. **과일 종류 수**: 시안은 8종 — 레벨 난이도 변수로 쓸지 고정인지

---

## MVP Definition

**Core hypothesis**: "심볼 공유 매칭 + 콤보 유지 딜레마" 루프가 목표 점수제 아래에서
레벨 단위 재미를 만든다.

**Required for MVP**:
1. 보드 생성(피라미드 10장, 매치 보장) + 심볼 공유 매칭 + 스포트라이트 교체
2. 덱 드로우(콤보 리셋) + 콤보 배수 점수
3. 목표 점수 승리 / 덱 소진 패배, 레벨 1개

**Explicitly NOT in MVP**:
- 와일드카드/코인 이코노미, 🌟 보상, 계정 레벨/수집 메타, 이동 제한(검증 대상이므로 온/오프 토글로만)

### Scope Tiers

| Tier | Content | Features | Timeline |
| ---- | ---- | ---- | ---- |
| **MVP** | 레벨 1개 | 코어 루프만 | [TBD] |
| **Vertical Slice** | 레벨 10개 + 난이도 곡선 | 코어 + 와일드카드/코인 | [TBD] |
| **Alpha** | [TBD] | 메타 진행 포함 | [TBD] |
| **Full Vision** | [TBD] | [TBD] | [TBD] |

---

## Next Steps

- [ ] 컨셉 승인 (사용자)
- [x] `/setup-engine` — Phaser 3.90.0 + TS + Vite, 웹 플랫폼 확정 (2026-07-25)
- [ ] `/map-systems` — 시스템 분해 (매칭/보드 생성/콤보/이코노미/진행), systems-index 생성
- [ ] `/prototype matching-core` — MVP 가설 검증 (매칭 규칙 + 이동 제한 A/B)
- [x] `ui_draft.html` 하이라이트를 확정 규칙에 맞게 수정 + 기술 부채 정리 (2026-07-24 완료, 클래스화만 잔여)
- [ ] Open Questions 1~7 순차 해소 (이코노미 설계 시 🌟 결정)

---

## Version History

| Date | Author | Changes |
|------|--------|---------|
| 2026-07-24 | Claude (reverse-doc) | ui_draft.html 분석 + 사용자 문답 4건 + 디즈니 솔리테어 준거 반영 초판 |

---

**Final Recommendation**: GO (조건부)

**Rationale**: 아트 방향과 코어 루프 준거가 명확하고 스코프가 작다. 단, "심볼 공유"
매칭의 재미 가설과 이동 제한의 필요성은 MVP 프로토타입으로 검증한 뒤 확장할 것.

---

*This concept document was generated by `/reverse-document` from `ui_draft.html`*
