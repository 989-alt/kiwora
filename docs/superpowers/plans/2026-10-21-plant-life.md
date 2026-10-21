# 식물 한살이 키우기 웹앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초등 3학년이 태블릿에서 식물 9종 중 하나를 골라, 현실 하루 한 번씩 물·자리·영양·벌레를 관리하며 씨→씨(여러해살이는 겨울→새순)까지 한살이를 체험하는 서버 없는 웹앱.

**Architecture:** 시뮬레이션은 UI와 분리된 순수 함수 모듈(`src/sim/`)로 만든다. 하루 마감 `endDay(state, actions, rng)`가 모든 규칙을 담고, Vitest로 검증한다. UI(`src/ui/`)는 React로 화면을 그리고 `src/store.ts`의 reducer가 sim을 호출하며, 저장은 localStorage + 복원 코드(lz-string)로 한다. 그림은 빌드 전에 kie.ai로 생성한 정적 webp이고, 종별 교사 검수(approved.json)를 통과한 종만 출시본에 들어간다.

**Tech Stack:** Vite 6 + React 18 + TypeScript 5, Vitest + @testing-library/react, Playwright(터치 에뮬레이션), lz-string, qrcode, vite-plugin-pwa, Python(이미지 생성 스크립트 재사용), Google Fonts(Jua, Gowun Dodum).

**Spec:** `docs/superpowers/specs/2026-10-21-plant-life-design.md` (실행자는 계획과 함께 반드시 읽는다)

## Global Constraints

- 앱 하루 = 현실 날짜(기기 로컬 날짜 `YYYY-MM-DD`) 하루 한 번. 접속하지 않은 날은 식물 시간이 멈춘다.
- 사망은 누적 피해로만 일어난다. **건강 ≥ 50일 때 조건 하나가 '매우 위험'인 하루로는 죽지 않는다.**
- 잘 키우면 한해살이 약 10일, 여러해살이 약 14일에 완성된다.
- 씨 단계: 물·온도만 작동한다. 햇빛·영양은 상태판에서 회색 "지금은 필요 없어요"로 표시하고, 피해·성장 계산에서 제외한다. 병충해도 생기지 않는다.
- 상태 5단계: `매우 위험`(빨강) / `위험`(주황) / `주의`(노랑) / `적정`(초록) / `매우 좋음`(파랑). 막대 칸 수 + 색 + 글자로 표시한다(색만으로 구분 금지). 방향 글자: 물·햇빛·영양은 `← 부족` / `← 너무 많음`, 온도는 `← 추워요` / `← 더워요`.
- 식물 9종: 한해살이 봉숭아·강낭콩·나팔꽃·벼·옥수수 / 여러해살이 사과나무·민들레·개나리·감나무. 강아지풀은 넣지 않는다.
- 사과나무·감나무·개나리는 어린나무 다음 단계에서 땅에 옮겨 심는다. 민들레는 화분에 둔다.
- 개인정보 입력 칸 없음. 서버·로그인·랭킹·공유 없음. 광고·결제 없음.
- 기기: 갤럭시탭(크롬), 아이패드(사파리), 크롬북. 모든 조작은 Pointer Events로 만들고, 길게 누르기 메뉴·텍스트 선택·더블탭 확대를 막는다(`touch-action: none` on 조작 요소, `-webkit-touch-callout: none`, `user-select: none`).
- 터치 영역 ≥ 48px, 본문 글자 ≥ 18px, 3학년 수준의 짧은 문장. 진행을 막는 팝업 퀴즈·설명창 금지.
- 그림 안에 글자 금지. 식물은 도감풍 실제 그림, 화분·배경·표정은 귀여운 클레이풍(`docs/style-samples/`).
- 디자인 토큰(ui-ux-pro-max 결과): primary `#15803D`, secondary `#059669`, accent `#D97706`, background `#F0FDF4`, foreground `#0F172A`, border `#E2EFE7`. 상태색 `#DC2626` / `#EA580C` / `#CA8A04`(배경용, 글자는 `#713F12`) / `#16A34A` / `#2563EB`. 모서리 16~24px, 클레이 이중 그림자. 제목 Jua, 본문 Gowun Dodum.
- 한글 경로 + vite build 네이티브 크래시 이력이 있다. `npm run build`·배포는 `C:\Users\Public\plant-life` 미러에서 한다(dev·test는 원본 경로에서 가능).

## Review Focus

1. **기기 날짜가 뒤로 가거나 같은 날 재접속:** `today <= lastDayDate`면 새 날이 아니다. 하루가 두 번 진행되거나 오류가 나면 안 된다. → Task 6 테스트 `clock rejects past date`.
2. **[하루 마치기]를 안 누르고 앱을 닫음:** 그날 한 행동(물·자리·비료·벌레)은 저장되어 있어야 한다. 다음 날 열면 먼저 그 하루를 자동 마감한 뒤 새 날을 시작한다. → Task 7 테스트 `unfinished day auto-finalizes on next date`.
3. **저장소가 깨졌거나 쓸 수 없음(사파리 비공개 탭, 용량 초과, JSON 손상):** 흰 화면이 되면 안 된다. 새로 시작 화면 + 복원 코드 입력이 보여야 한다. → Task 6 테스트 `corrupt save falls back to fresh state`.
4. **물뿌리개를 아주 오래 누르거나 비료를 연타:** 값은 0~150으로 제한한다(100 초과 구간은 "너무 많음"으로 판정). NaN·무한대가 생기면 안 된다. → Task 4 테스트 `water and nutrient clamp`.
5. **잘못된 복원 코드(오타, 다른 버전, 빈 문자열):** 친절한 오류 문구를 보여 주고, 현재 저장을 덮어쓰지 않는다. → Task 6 테스트 `bad restore code keeps current save`.

---

## File Structure

```
plant-life/
  index.html
  package.json, tsconfig.json, vite.config.ts, playwright.config.ts
  src/
    main.tsx                 앱 진입, 폰트·토큰 css 로드
    styles/tokens.css        디자인 토큰, 클레이 그림자, 터치 방지 규칙
    sim/
      types.ts               모든 sim 타입
      levels.ts              levelFor(), 단계 이름·색
      species.ts             9종 데이터(단계·밴드·소개)
      day.ts                 endDay(), 증발·건강·성장
      pests.ts               rollPests(), 벌레→병충해 단계
      death.ts               deathCause()
      rng.ts                 seeded RNG (mulberry32)
      clock.ts               todayKey(), isNewDay()
      save.ts                load/save/exportCode/importCode
    store.ts                 useReducer 상태·액션, sim 호출, 저장
    ui/
      StatusBoard.tsx        상태판(5조건 + 종합 건강)
      PlantView.tsx          식물·화분·배경 합성, 건강 효과
      tools/WateringCan.tsx  꾹 누르기 물주기
      tools/Fertilizer.tsx   끌어 넣기
      tools/PlaceSlots.tsx   화분 끌어 자리 옮기기 / 옮겨 심을 자리 고르기
      tools/Bugs.tsx         벌레 표시·터치 제거
      screens/PickScreen.tsx
      screens/GrowScreen.tsx
      screens/MorningCard.tsx
      screens/DeathScreen.tsx
      screens/TransplantScreen.tsx
      screens/JournalScreen.tsx
      screens/DexScreen.tsx
      screens/BackupPanel.tsx
      Tutorial.tsx           첫날 말풍선 3개
      sound.ts               효과음 + 끄기
  public/
    plants/<speciesId>/<stageId>.webp
    pots/{happy,normal,worried,sick}.webp
    bg/{window,desk,shade,yard-sunny,yard-partial,yard-shade}.webp
    bugs/{aphid,caterpillar}.webp
  assets/
    manifest.json            생성할 모든 그림의 프롬프트
    approved.json            교사 검수 통과 종 목록 {"balsam": true, ...}
    review/<speciesId>.png   검수용 모음판
  scripts/
    gen_assets.py            manifest → kie.ai 생성 → webp 변환
    contact_sheet.py         종별 모음판 생성
    mirror-build.sh          Public 미러 동기화 후 build
  tests/
    sim/*.test.ts
    ui/*.test.tsx
    e2e/*.spec.ts
```

---

### Task 1: 프로젝트 골격과 디자인 토큰

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `index.html`, `src/main.tsx`, `src/styles/tokens.css`, `scripts/mirror-build.sh`, `.gitignore`
- Test: `tests/ui/smoke.test.tsx`, `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Produces: `npm test`(vitest), `npm run e2e`(playwright, 프로젝트 `galaxy-tab` = Chromium 1280×800 hasTouch, `ipad` = WebKit 1180×820 hasTouch), `npm run build:mirror`. 그리고 CSS 변수 `--c-primary`, `--c-bg`, `--c-fg`, `--lv-0`…`--lv-4`, `--lv-2-text`, `--radius-lg`, `--clay-shadow`.

- [ ] **Step 1: 실패하는 스모크 테스트 작성** — `smoke.test.tsx`: `<App/>`를 렌더하면 `getByRole('main')`이 존재한다. `smoke.spec.ts`: `/` 접속 시 `main`이 보이고, `body`의 computed `user-select`가 `none`이다.
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/ui/smoke.test.tsx` → FAIL(App 없음).
- [ ] **Step 3: 골격 구현** — Vite React-TS. `index.html`에 viewport `width=device-width, initial-scale=1`(확대 금지 속성 넣지 않음), Google Fonts `Jua`, `Gowun Dodum` 링크(`display=swap`). `tokens.css`에 Global Constraints의 색·모서리·클레이 그림자(`--clay-shadow: 0 6px 0 rgba(21,128,61,.18), inset 0 -4px 0 rgba(0,0,0,.06)`)·`body{user-select:none;-webkit-touch-callout:none}`·`prefers-reduced-motion` 시 애니메이션 끄기를 정의한다. `src/App.tsx`는 `<main>`만 렌더한다. `mirror-build.sh`는 `rsync --exclude node_modules --exclude .git` 로 `/c/Users/Public/plant-life`에 복사한 뒤 그곳에서 `npm ci && npm run build`를 실행한다.
- [ ] **Step 4: 통과 확인** — `npm test` PASS, `npm run e2e` 두 프로젝트 PASS.
- [ ] **Step 5: Commit** — `git commit -m "chore: scaffold vite react app with design tokens"`

---

### Task 2: 상태 단계 판정 `levelFor`

**Files:**
- Create: `src/sim/types.ts`, `src/sim/levels.ts`
- Test: `tests/sim/levels.test.ts`

**Interfaces:**
- Produces:
  - `type Level = 0|1|2|3|4` (0 매우 위험 … 4 매우 좋음)
  - `type Dir = 'low'|'high'|null`
  - `type Band = { lo: number; idealLo: number; idealHi: number; hi: number; span: number }`
  - `type ConditionKey = 'water'|'light'|'temp'|'nutrient'|'pest'`
  - `type Status = { level: Level; dir: Dir } | { level: null; notNeeded: true }`
  - `levelFor(value: number, band: Band): { level: Level; dir: Dir }`
  - `LEVEL_LABEL: Record<Level,string>` = `['매우 위험','위험','주의','적정','매우 좋음']`
  - `dirLabel(key: ConditionKey, dir: Dir): string` → water/light/nutrient: `'← 부족'|'← 너무 많음'`, temp: `'← 추워요'|'← 더워요'`, null → `''`

규칙: `idealLo ≤ v ≤ idealHi` → 4. `lo ≤ v ≤ hi` → 3. 그 밖이면 거리 `d = v<lo ? lo-v : v-hi`, `d ≤ span` → 2, `d ≤ 2·span` → 1, 아니면 0. `level ≤ 2`일 때만 dir을 붙인다(`v<lo` → `'low'`).

- [ ] **Step 1: 실패하는 테스트 작성** — band `{lo:30, idealLo:45, idealHi:70, hi:85, span:15}`로 확인한다.
  - 50 → `{level:4, dir:null}`
  - 35 → `{3, null}`
  - 20 → `{2, 'low'}`
  - 1 → `{0, 'low'}`
  - 101 → `{1, 'high'}`
  - 116 → `{0, 'high'}`
  - `dirLabel('temp','high') === '← 더워요'`
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/sim/levels.test.ts` → FAIL.
- [ ] **Step 3: 구현** — 위 시그니처대로.
- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: Commit** — `feat(sim): condition level evaluation`

---

### Task 3: 식물 9종 데이터

**Files:**
- Create: `src/sim/species.ts`
- Test: `tests/sim/species.test.ts`

**Interfaces:**
- Consumes: `Band` (Task 2)
- Produces:
  - `type SpeciesId = 'balsam'|'bean'|'morningGlory'|'rice'|'corn'|'apple'|'dandelion'|'forsythia'|'persimmon'`
  - `type StageId = 'seed'|'sprout'|'leafStem'|'grownTree'|'flower'|'fruit'|'winter'|'newShoot'|'seedDone'`
  - `type Phase = 'seed'|'grow'|'winter'`
  - `type Species = { id; name: string; life: 'annual'|'perennial'; blurb: string; stages: StageId[]; transplant: boolean; bands: Record<Phase, { water: Band; light: Band; temp: Band; nutrient: Band }> }`
  - `SPECIES: Record<SpeciesId, Species>`
  - `phaseOf(stage: StageId): Phase` (seed→'seed', winter→'winter', 나머지→'grow')
  - `STAGE_LABEL: Record<StageId,string>`: 씨 / 싹이 텄어요 / 잎과 줄기가 자라요 / 적당한 크기로 자라요 / 꽃이 피어요 / 열매를 맺어요 / 겨울을 지내요 / 새순이 나와요 / 씨를 얻었어요
  - `STAGE_POINTS = 4` (단계 하나를 넘는 데 필요한 성장 점수)

단계 순서:
- 한해살이: `['seed','sprout','leafStem','flower','fruit','seedDone']`
- 여러해살이: `['seed','sprout','leafStem','grownTree','flower','fruit','winter','newShoot']`
- `transplant`는 apple·persimmon·forsythia만 `true`다. 옮겨 심기는 `leafStem → grownTree` 전환 시점에 일어난다.

값의 기준(물·영양은 흙 속 양 0~150, 햇빛은 자리 밝기 0~100, 온도 ℃). 아래는 grow 단계 기본값이고, 종별 차이만 덮어쓴다.
- 기본 grow: water `{lo:35,idealLo:50,idealHi:75,hi:90,span:15}`, light `{lo:45,idealLo:60,idealHi:85,hi:95,span:15}`, temp `{lo:16,idealLo:20,idealHi:26,hi:30,span:4}`, nutrient `{lo:20,idealLo:35,idealHi:65,hi:85,span:15}`
- seed 단계: water는 기본과 같고, temp `{lo:15,idealLo:20,idealHi:27,hi:31,span:4}`. light·nutrient band는 계산에 쓰지 않으므로 grow 값을 복사해 둔다.
- winter 단계: water `{lo:15,idealLo:20,idealHi:40,hi:55,span:15}`, nutrient `{lo:0,idealLo:0,idealHi:20,hi:35,span:15}`, temp `{lo:-5,idealLo:0,idealHi:10,hi:15,span:5}`, light는 기본과 같다.
- 종별 차이:
  - 벼: water idealLo 75 / idealHi 110 / hi 125
  - 옥수수·나팔꽃: light idealLo 70, temp idealLo 22
  - 강낭콩: nutrient idealHi 50
  - 민들레: 모든 band의 span ×1.5(튼튼함)
  - 사과·감: light idealLo 70

각 종의 `blurb`(한 줄 소개):
- 봉숭아: "여름에 예쁜 꽃이 피어요"
- 강낭콩: "떡잎이 크고 빨리 자라요"
- 나팔꽃: "햇빛을 아주 좋아해요"
- 벼: "물을 아주 좋아해요"
- 옥수수: "따뜻하고 밝은 곳을 좋아해요"
- 사과나무: "여러 해 동안 열매를 맺어요"
- 민들레: "어디서나 잘 자라요"
- 개나리: "봄에 노란 꽃이 피어요"
- 감나무: "가을에 주황색 열매가 열려요"

- [ ] **Step 1: 실패하는 테스트 작성** — 다음을 확인한다.
  - 9종이 있고 annual 5 / perennial 4
  - annual의 `stages.length === 6`이고 끝이 `'seedDone'`
  - perennial은 8이고 끝이 `'newShoot'`
  - transplant 종 집합 === `{apple, persimmon, forsythia}`
  - 모든 band에서 `lo ≤ idealLo ≤ idealHi ≤ hi`
  - `SPECIES.rice.bands.grow.water.idealLo > SPECIES.balsam.bands.grow.water.idealLo`
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — 위 값대로 작성한다. 기본값 객체를 복사한 뒤 덮어쓰는 헬퍼 `makeBands(over)`를 둔다.
- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: Commit** — `feat(sim): nine species data`

---

### Task 4: 하루 마감 엔진 `endDay`

**Files:**
- Create: `src/sim/day.ts`, `src/sim/rng.ts`
- Modify: `src/sim/types.ts` (PlantState, DayActions, DayReport 추가)
- Test: `tests/sim/day.test.ts`

**Interfaces:**
- Consumes: `levelFor`, `SPECIES`, `phaseOf`, `STAGE_POINTS`
- Produces:
  - `type Place = 'window'|'desk'|'shade'|'yardSunny'|'yardPartial'|'yardShade'`
  - `PLACE_ENV: Record<Place,{ light: number; temp: number; evap: number }>` = window `{90,27,25}`, desk `{65,22,18}`, shade `{30,18,12}`, yardSunny `{90,24,22}`, yardPartial `{65,21,16}`, yardShade `{35,18,12}`. winter 단계일 때 온도 −15, 증발 ×0.5.
  - `type PlantState = { speciesId; stageIndex: number; growth: number; health: number; water: number; nutrient: number; lightExp: number; place: Place; bugs: number; day: number; heightCm: number; leaves: number; dead: boolean; deathCause?: string }`
  - `type DayActions = { waterAdded: number; pellets: number; bugsRemoved: number; place: Place }`
  - `type DayReport = { statuses: Record<ConditionKey, Status>; healthDelta: number; grew: boolean; stageChanged: boolean; died: boolean; newBugs: number; heightDelta: number }`
  - `currentStatuses(s: PlantState): Record<ConditionKey, Status>` — 화면 상태판도 이 함수를 쓴다.
  - `endDay(s: PlantState, a: DayActions, rng: () => number): { state: PlantState; report: DayReport }`
  - `newPlant(id: SpeciesId): PlantState` — water 55, nutrient 40, health 100, place 'desk', lightExp 65
  - `mulberry32(seed: number): () => number`, `seedFor(day: number, speciesId: string): number`

endDay 순서(바꾸지 말 것):
1. 행동을 반영한다. `water = clamp(water + waterAdded, 0, 150)`, `nutrient = clamp(nutrient + pellets·15, 0, 150)`, `bugs = max(0, bugs - bugsRemoved)`, `place = a.place`.
2. `lightExp = round(0.5·lightExp + 0.5·PLACE_ENV[place].light)`. "햇빛을 너무 오래"는 이 이동평균에 누적되어 나타난다.
3. 상태를 판정한다. temp는 `PLACE_ENV`의 온도, pest는 벌레 수로 매긴다(0 → 4, 1~2 → 2, 3~4 → 1, 5 이상 → 0, dir 'high'). seed phase에서는 light·nutrient·pest가 `notNeeded`다.
4. 건강을 계산한다. 활성 조건 각각에 대해 level 0 → −25, 1 → −12, 2 → −4, 3·4 → 0. 활성 조건이 모두 3 이상이면 +10. 결과는 0~100으로 제한한다. 0이면 `dead = true`, `deathCause = deathCause(...)`(Task 5)이고, 성장은 건너뛴다.
5. 성장을 계산한다. 활성 조건 level의 평균을 `{4:2, 3:1.5, 2:0.5, 1:0, 0:0}`로 변환해 `growth`에 더한다. `growth ≥ STAGE_POINTS`면 다음 단계로 넘어가고 `growth -= STAGE_POINTS`. `heightCm`과 `leaves`는 성장량에 비례해 늘린다(비율은 구현자 재량, 감소하지 않음).
6. 다음 날 아침을 준비한다. `water -= evap`, grow phase면 `nutrient -= 5`, `newBugs = rollPests(...)`(Task 5), `bugs += 남은 벌레 수 + newBugs`, `day += 1`.

- [ ] **Step 1: 실패하는 테스트 작성** — 테스트 이름과 단언:
  - `ideal care finishes annual in 10 days`: 봉숭아를 매일 desk에 둔다. 매일 마감 전에 water·nutrient를 그날 phase band의 `(idealLo+idealHi)/2`로 맞추는 만큼 넣고, 벌레는 0이다. 10회 endDay 후 마지막 stage === `'seedDone'`, `dead === false`.
  - `ideal care finishes perennial in 14 days`: 민들레로 같은 방식. 14회 후 `'newShoot'`.
  - `single very-dangerous day never kills from half health`: health 50, water 0이고 나머지는 적정 → 결과 health 25, dead false.
  - `seed stage ignores light and nutrient`: stage 'seed', place 'shade', nutrient 0 → statuses.light와 statuses.nutrient가 `notNeeded`이고 healthDelta ≥ 0.
  - `shade after sprout weakens plant`: stage 'leafStem'에서 shade 3일 연속 → light level ≤ 2, dir 'low'.
  - `window for many days over light-limit`: 기본 band 종을 window에 5일 → lightExp 90 → level 4(95 이하)임을 확인한다. 이어서 band hi를 80으로 낮춘 테스트용 종에서는 level ≤ 2, dir 'high'.
  - `water and nutrient clamp`: waterAdded 1e9, pellets 1e6 → water ≤ 150, nutrient ≤ 150, 모든 수치가 `Number.isFinite`.
  - `dead plant does not grow`: health 10, 조건 두 개가 0 → dead true, stageIndex 변화 없음.
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — 위 순서대로. `rollPests`·`deathCause`는 Task 5 전까지 임시 함수로 두지 말고, Task 5를 먼저 끝내거나 이 Task에서 함께 만든다(구현자 선택).
- [ ] **Step 4: 통과 확인** — PASS. 10일·14일 테스트가 실패하면 `STAGE_POINTS`나 변환표가 아니라 evap·band 값을 조정하고, 조정한 값을 Task 3 데이터에 반영한다.
- [ ] **Step 5: Commit** — `feat(sim): day engine with cumulative damage and growth`

---

### Task 5: 병충해와 사망 원인

**Files:**
- Create: `src/sim/pests.ts`, `src/sim/death.ts`
- Test: `tests/sim/pests.test.ts`, `tests/sim/death.test.ts`

**Interfaces:**
- Produces:
  - `pestChance(st: Record<ConditionKey, Status>): number` = `0.03 + 0.30·[water high ≤2] + 0.20·[nutrient low ≤2] + 0.15·[light low ≤2]`, 최대 0.8. seed phase면 0.
  - `rollPests(st, rng): number` — `rng() < pestChance`면 `1 + floor(rng()·3)`, 아니면 0.
  - `deathCause(history: Record<ConditionKey, Status>[]): string` — 최근 3일 동안 level 합이 가장 낮은 조건과 그 dir로 문장을 고른다.

사망 문장:

| 조건 | 방향 | 문장 |
|---|---|---|
| water | high | "물을 너무 많이 줘서 뿌리가 썩었어요." |
| water | low | "물이 부족해서 말라 버렸어요." |
| light | low | "햇빛을 오래 못 받아서 약해졌어요." |
| light | high | "강한 햇빛을 너무 오래 받아서 잎이 탔어요." |
| temp | low | "너무 추워서 견디지 못했어요." |
| temp | high | "너무 더워서 견디지 못했어요." |
| nutrient | low | "영양분이 부족해서 힘이 없었어요." |
| nutrient | high | "비료를 너무 많이 줘서 뿌리가 상했어요." |
| pest | — | "벌레가 너무 많아져서 잎을 다 갉아 먹었어요." |

- [ ] **Step 1: 실패하는 테스트 작성** — 다음을 확인한다.
  - `perfect care almost never gets bugs`: 모든 조건 4 → pestChance === 0.03
  - `overwatering raises bug chance`: water `{2,'high'}` → ≥ 0.33
  - `seed stage has no bugs`
  - `death cause picks worst recent condition`: 3일 기록에서 water가 매일 `{0,'high'}`이면 "물을 너무 많이 줘서 뿌리가 썩었어요."
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — PASS. Task 4 테스트도 다시 PASS인지 확인한다.
- [ ] **Step 5: Commit** — `feat(sim): pests and death cause`

---

### Task 6: 날짜 판정, 저장, 복원 코드

**Files:**
- Create: `src/sim/clock.ts`, `src/sim/save.ts`
- Test: `tests/sim/clock.test.ts`, `tests/sim/save.test.ts`

**Interfaces:**
- Produces:
  - `todayKey(d?: Date): string` — 로컬 `YYYY-MM-DD`
  - `isNewDay(lastDayKey: string|null, today: string): boolean` — null이면 true, 문자열 비교로 `today > lastDayKey`일 때만 true
  - `type SaveData = { v: 1; plant: PlantState|null; pendingActions: DayActions|null; lastDayKey: string|null; dayDone: boolean; journal: JournalEntry[]; pastTries: PastTry[]; dex: SpeciesId[]; settings: { sound: boolean; tutorialSeen: boolean } }`
  - `type JournalEntry = { day: number; dateKey: string; stage: StageId; heightCm: number; leaves: number; actions: DayActions; statuses: Record<ConditionKey, Status> }`
  - `type PastTry = { speciesId: SpeciesId; days: number; stage: StageId; cause: string }`
  - `emptySave(): SaveData`
  - `loadSave(storage?: Storage): { data: SaveData; warning?: 'corrupt'|'unavailable' }`
  - `writeSave(data: SaveData, storage?: Storage): boolean`
  - `exportCode(data: SaveData): string` — `'PL1-' + LZString.compressToEncodedURIComponent(JSON.stringify(data))`
  - `importCode(code: string): { ok: true; data: SaveData } | { ok: false; message: string }` — 앞뒤 공백을 제거하고, 접두사 `PL1-`, JSON, `v === 1`을 확인한다. 실패 문구: "코드가 맞지 않아요. 다시 확인해 주세요."
  - 저장 키: `'plantlife.v1'`
  - `requestPersist(): Promise<void>` — `navigator.storage?.persist?.()`를 호출하고 실패는 무시한다.

- [ ] **Step 1: 실패하는 테스트 작성** — 다음을 확인한다.
  - `clock rejects past date`: `isNewDay('2026-10-21','2026-10-20') === false`, 같은 날 false, 다음 날 true, null → true
  - `save roundtrip`
  - `corrupt save falls back to fresh state`: 저장소에 `'{oops'` → data가 emptySave와 같고 warning 'corrupt'
  - `throwing storage reports unavailable`: getItem이 throw하는 가짜 Storage → warning 'unavailable', 예외가 밖으로 나가지 않음
  - `restore code roundtrip`
  - `bad restore code keeps current save`: `''`, `'PL1-xyz'`, `v:2` 데이터 → ok false, message가 위 문구
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — `npm i lz-string`.
- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: Commit** — `feat(sim): date gating, save and restore code`

---

### Task 7: 스토어 — 하루 흐름 연결

**Files:**
- Create: `src/store.ts`
- Test: `tests/ui/store.test.ts`

**Interfaces:**
- Consumes: Task 3~6 전부
- Produces:
  - `type Screen = 'pick'|'grow'|'transplant'|'dead'|'journal'|'dex'|'backup'`
  - `type AppState = SaveData & { screen: Screen; morning: DayReport|null; warning?: string }`
  - `type Action = {type:'pick', id: SpeciesId} | {type:'water', amount: number} | {type:'pellet'} | {type:'removeBug'} | {type:'move', place: Place} | {type:'endDay'} | {type:'replant', id: SpeciesId} | {type:'chooseYard', place: Place} | {type:'open', screen: Screen} | {type:'restore', data: SaveData} | {type:'toggleSound'} | {type:'tutorialDone'}`
  - `boot(data: SaveData, today: string): AppState` — 앱 시작 시 한 번 호출한다.
  - `reducer(s: AppState, a: Action, today: string): AppState`
  - `useApp(): [AppState, (a: Action) => void]` — 매 dispatch 후 `writeSave`를 호출한다.

규칙:
- 행동(water/pellet/removeBug/move)은 두 가지를 동시에 한다. 하나는 `plant`의 표시값(water·nutrient·bugs·place)을 즉시 바꾸는 것이다(상태판이 바로 반응). 다른 하나는 같은 양을 `pendingActions`에 기록하는 것이다(일지·자동 마감용). 하루 마감 때 `endDay`에는 `{waterAdded:0, pellets:0, bugsRemoved:0, place: plant.place}`를 넘긴다. 행동이 두 번 더해지지 않게 하기 위해서다. 일지에는 `pendingActions`를 기록한다.
- `dayDone`이면 행동 액션은 무시한다.
- `boot`:
  - `isNewDay(lastDayKey, today)`이고 `dayDone === false`이고 `pendingActions !== null`이면, 그날을 자동 마감한 뒤 새 날을 시작한다.
  - 새 날이면 `dayDone = false`, `morning = 직전 report`.
  - 같은 날 `dayDone`이면 grow 화면에서 보기만 가능하다.
- `endDay` 후의 분기:
  - 죽었으면 `pastTries`에 추가하고 screen 'dead'.
  - 한해살이 'seedDone' 또는 여러해살이 'newShoot'에 도달하면 dex에 추가하고 screen 'journal'.
  - transplant 종이 'grownTree'에 도달하면 screen 'transplant'.
- `replant`: 새 `newPlant`를 만들고 그날을 '씨 심기'로 마감한다(`dayDone = true`, `lastDayKey = today`).
- `chooseYard`: place를 yard 자리로 고정하고, 이후 `move` 액션을 무시한다.

- [ ] **Step 1: 실패하는 테스트 작성** — 다음을 확인한다.
  - `one endDay per date`: 같은 today에서 endDay 두 번 → day는 1만 증가
  - `unfinished day auto-finalizes on next date`: 10-21에 water만 하고 닫음 → 10-22에 boot → day 증가, morning not null, 행동이 journal에 기록됨
  - `missing days do not decay`: 10-21 마감 후 10-28에 boot → water가 10-21 마감 직후 값과 같음
  - `replant consumes the day`
  - `actions ignored after dayDone`
  - `transplant species routes to transplant screen`: apple stageIndex를 leafStem으로 두고 growth 3.9에서 이상적인 하루 → screen 'transplant'
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: Commit** — `feat: app store wiring day flow`

---

### Task 8: 상태판 `StatusBoard`

**Files:**
- Create: `src/ui/StatusBoard.tsx`, `src/ui/icons.tsx`(물방울·해·온도계·새싹·벌레·하트 스트로크 SVG, 이모지 금지)
- Test: `tests/ui/StatusBoard.test.tsx`

**Interfaces:**
- Consumes: `Status`, `LEVEL_LABEL`, `dirLabel`
- Produces: `<StatusBoard statuses={Record<ConditionKey,Status>} health={number} layout="side"|"bottom" />`

표시 규칙:
- 행마다 아이콘 + 이름(물/햇빛/온도/영양/병충해) + 5칸 막대(level+1칸 채움, `--lv-n` 색) + 단계 글자 + 방향 글자.
- `notNeeded`면 막대를 회색으로 하고 "지금은 필요 없어요"를 쓴다.
- 종합 건강은 하트 아이콘 + 0~100 막대 + 숫자다. 30 미만이면 빨강이고 "위험해요!"를 붙인다.
- 각 행은 `role="group"`, `aria-label="물 위험 부족"`처럼 읽힌다.
- `layout`은 Task 9의 시안 선택(A=side, B=bottom)에 따른다.

- [ ] **Step 1: 실패하는 테스트 작성** — 다음을 확인한다.
  - water `{1,'low'}` → 행 텍스트에 "위험"과 "← 부족", 채운 칸 2개
  - light notNeeded → "지금은 필요 없어요", 채운 칸 0
  - temp `{2,'high'}` → "← 더워요"
  - health 25 → "위험해요!"
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — 칸 크기 ≥ 20px. 글자는 18px 이상. 주의(노랑) 칸 옆 글자는 `--lv-2-text`를 쓴다.
- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: Commit** — `feat(ui): status board`

---

### Task 9: 키우기 화면과 직접 조작

**Files:**
- Create: `src/ui/PlantView.tsx`, `src/ui/tools/WateringCan.tsx`, `src/ui/tools/Fertilizer.tsx`, `src/ui/tools/PlaceSlots.tsx`, `src/ui/tools/Bugs.tsx`, `src/ui/screens/GrowScreen.tsx`, `src/ui/screens/MorningCard.tsx`, `src/ui/Tutorial.tsx`, `src/ui/sound.ts`
- Test: `tests/e2e/grow.spec.ts`, `tests/ui/PlantView.test.tsx`

**Interfaces:**
- Consumes: `useApp`, `currentStatuses`, `StatusBoard`
- Produces:
  - `<PlantView speciesId stage health lightLow:boolean place />` — 이미지 경로는 `/plants/${id}/${stage}.webp`, `/pots/${face}.webp`, `/bg/${place}.webp`
  - `faceFor(health: number): 'happy'|'normal'|'worried'|'sick'` — ≥75 / ≥50 / ≥25 / 그 미만

조작 규칙:
- **WateringCan:** `pointerdown`부터 `pointerup`·`pointercancel`·`pointerleave`까지 100ms마다 `dispatch({type:'water', amount:1.2})`(초당 12)를 보낸다. 물줄기 애니메이션과 물소리를 낸다. `setPointerCapture`를 쓴다.
- **PlaceSlots:** 화분을 끌어서 슬롯 위에서 놓으면 `move`를 보낸다. 8px 이상 움직여야 끌기가 시작된다. 놓을 수 있는 슬롯은 강조한다. 끌기가 어려운 학생을 위해 슬롯을 탭해도 이동하게 한다.
- **Fertilizer:** 알갱이를 화분 영역에 놓으면 `pellet`을 보낸다. 탭해도 1알이 들어간다.
- **Bugs:** `plant.bugs`만큼 잎 위 고정 좌표(seed rng)에 그린다. 각 벌레는 48px 이상의 버튼이고 `aria-label="벌레 잡기"`. 탭하면 `removeBug`를 보내고 톡 소리를 낸다.
- **PlantView 건강 효과:** health에 따라 `filter: saturate(…) sepia(…)`와 줄기 기울기 `rotate`를 적용한다. `lightLow`(light level ≤ 2, dir low)면 `saturate(.5) brightness(1.15)`와 `scaleX(.85) scaleY(1.06)`로 "연하고 가늘게" 보이게 한다. reduced-motion이면 전환 애니메이션을 끈다.
- **GrowScreen:** 상단에 "봉숭아 · 4일째 · 잎과 줄기가 자라요"를 표시한다. 그 아래 PlantView, PlaceSlots, 도구, StatusBoard, [하루 마치기](주 버튼 1개)가 온다.
  - dayDone이면 도구를 비활성화하고 "내일 다시 만나요"를 표시한다.
  - 레이아웃은 교사가 고른 시안(A: 상태판 오른쪽 / B: 상태판 아래)을 따른다. 세로 화면에서는 B로 자동 전환한다.
- **MorningCard:** 새 날 진입 시 report로 한 줄 요약을 만든다(키가 Ncm 자랐어요 / 잎이 처졌어요 / 벌레가 N마리 생겼어요 / 단계가 바뀌었어요). 탭하면 닫힌다(진행을 막지 않는 카드).
- **Tutorial:** `tutorialSeen`이 false면 물뿌리개 → 화분 → 벌레 순서로 말풍선 3개를 띄운다. 각 말풍선은 탭하면 넘어간다.
- **sound:** WebAudio 짧은 효과음이고 `settings.sound`가 false면 무음이다.

- [ ] **Step 1: 실패하는 테스트 작성** — e2e(두 터치 프로젝트 모두)로 확인한다.
  - `hold watering can raises water`: 2초 누름 → 상태판 물 행이 '부족'에서 벗어남(fixture: water 20인 저장을 localStorage에 주입)
  - `drag pot to window`: 화분을 창가 슬롯으로 끌기 → 창가 슬롯 `aria-pressed=true`
  - `tap slot also moves`
  - `tap bug removes it`: bugs 2 fixture → 벌레 버튼 2개 → 탭 후 1개
  - `long press shows no context menu`: 물뿌리개 1.5초 누른 뒤 `window.getSelection().toString() === ''`
  - `end day locks tools`

  단위 테스트로 `faceFor(80)==='happy'`, `faceFor(20)==='sick'`을 확인한다.
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — 그림은 Task 12 전까지 `public/`에 시안 폴더 그림(`docs/mockup/img`)을 임시로 복사해 쓴다.
- [ ] **Step 4: 통과 확인** — `npm run e2e` PASS.
- [ ] **Step 5: Commit** — `feat(ui): grow screen with direct manipulation`

---

### Task 10: 여러해살이 — 옮겨 심기와 겨울

**Files:**
- Create: `src/ui/screens/TransplantScreen.tsx`
- Modify: `src/ui/screens/GrowScreen.tsx`(yard 모드), `src/ui/tools/PlaceSlots.tsx`
- Test: `tests/e2e/perennial.spec.ts`, `tests/sim/day.test.ts`(겨울 케이스 추가)

**Interfaces:**
- Consumes: `chooseYard` 액션, `PLACE_ENV`의 yard 자리, `phaseOf('winter')`
- Produces: yard 모드 GrowScreen. 화분이 없고 PlaceSlots를 숨기며, 건강은 나무 옆 표지판 캐릭터(face 4종 재사용, 작은 팻말 프레임)로 보여 준다.

규칙:
- TransplantScreen은 "나무가 커서 화분이 좁아요. 마당에 옮겨 심어요!" 문구와 함께 양지·반그늘·그늘 카드 3장을 보여 준다(그림 + 한 줄: "햇빛이 하루 종일 / 반나절 / 조금"). 고르면 `chooseYard`.
- 'grownTree' 단계에서는 화면 상단에 "1년 뒤", "2년 뒤"를 성장 점수에 따라 표시한다(growth < 2 → 1년 뒤, 그 이상 → 2년 뒤).
- 'winter' 단계: 배경을 겨울판으로 바꾸고(같은 bg에 흰 오버레이 + 눈 입자, 별도 그림 없음) 잎 없는 나무 그림을 쓴다. 상태판은 winter band를 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성** — 다음을 확인한다.
  - sim: `winter prefers little water`: winter에서 water 70 → level ≤ 2 'high'
  - e2e: `apple transplant flow`: grownTree 직전 fixture에서 하루 마감 → 옮겨 심기 화면 → 양지 선택 → 화분 슬롯이 사라짐
  - e2e: `dandelion stays in pot`: 민들레 grownTree에서 PlaceSlots가 보임
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: Commit** — `feat: perennial transplant and winter`

---

### Task 11: 고르기·죽음·일지·도감·백업 화면

**Files:**
- Create: `src/ui/screens/PickScreen.tsx`, `DeathScreen.tsx`, `JournalScreen.tsx`, `DexScreen.tsx`, `BackupPanel.tsx`, `src/styles/print.css`
- Test: `tests/e2e/screens.spec.ts`, `tests/ui/Journal.test.tsx`

**Interfaces:**
- Consumes: `AppState`, `exportCode`, `importCode`, `SPECIES`
- Produces: 각 화면 컴포넌트. App의 라우팅은 `state.screen`으로 분기한다.

화면 규칙:
- **PickScreen:** 9종 카드(그림 = 그 종의 'flower' 단계 그림 + 이름 + blurb)를 한해살이/여러해살이 두 묶음으로 보여 준다. 도감에 있는 종에는 완성 표시를 붙인다. 하단에 [씨 도감] [기록 지키기(백업)] 링크를 둔다.
- **DeathScreen:** 시든 식물 그림 + `deathCause` 문장 + "N일째, ○○ 단계까지 자랐어요" + [같은 식물 다시 심기] [다른 식물 고르기].
- **JournalScreen:** 단계별 대표 그림을 화살표로 이은 띠(교과서 110~111쪽 형태) + 날짜별 표(일차·단계·키·잎·한 일·상태 요약) + 지난 시도 목록 + [인쇄하기](`window.print()`). `print.css`: A4 세로, 배경색 제거, 띠·표만 남긴다.
- **DexScreen:** 9칸 격자. 완성한 칸에는 씨 그림 + 한살이 띠 축소판, 아닌 칸은 실루엣 + 이름. 완성 후 [다른 식물 키우기] → PickScreen.
- **BackupPanel:** 복원 코드 텍스트(복사 버튼) + QR(`qrcode` 패키지) + "이 코드를 실험관찰에 적어 두세요" + 코드 입력칸·[기록 되살리기]. 되살리기 전에 "지금 기록이 바뀌어요. 계속할까요?" 확인을 거치고, 실패하면 입력칸 아래에 오류 문구를 띄운다. 앱 시작 시 `warning`이 있으면 이 패널을 먼저 연다.
- **설정:** 소리 끄기 토글은 GrowScreen 상단 아이콘 버튼(`aria-label="소리"`)에 둔다.

- [ ] **Step 1: 실패하는 테스트 작성** — 다음을 확인한다.
  - `pick shows nine species in two groups`
  - `death screen shows cause sentence`(fixture)
  - `journal lists every recorded day`(5일 journal fixture → 표 행 5개)
  - `backup roundtrip`: 코드 복사 → 저장 비우기 → 코드 붙여넣기 → 되살리기 → 같은 일차
  - `bad code shows message`
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — `npm i qrcode`.
- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: Commit** — `feat(ui): pick, death, journal, dex, backup screens`

---

### Task 12: 그림 생성 파이프라인과 종별 교사 검수

**Files:**
- Create: `assets/manifest.json`, `assets/approved.json`, `scripts/gen_assets.py`, `scripts/contact_sheet.py`, `src/sim/approved.ts`
- Test: `tests/sim/approved.test.ts`, `scripts/test_contact_sheet.py`

**Interfaces:**
- Produces:
  - `manifest.json` 행: `{ "path": "public/plants/balsam/leafStem.webp", "prompt": "...", "aspect": "3:4", "transparent": true, "species": "balsam" }`
  - `python scripts/gen_assets.py --species balsam [--only <path>]` — 키는 `~/docs/.env`의 `KIE_API_KEY`를 `KIE_AI_API_KEY`로 넘긴다. 생성기는 `~/.claude/skills/education-pptx/scripts/image_gen.py`를 호출하고, png를 webp(최대 1024px, quality 85)로 변환한다.
  - `python scripts/contact_sheet.py --species balsam` → `assets/review/balsam.png`(단계 그림을 순서대로 한 줄 + 단계 이름 라벨)
  - `isApproved(id: SpeciesId): boolean` — `approved.json`을 import한다. PickScreen은 미승인 종 카드를 출시 빌드(`import.meta.env.PROD`)에서 "준비 중"으로 비활성화한다.

프롬프트 규칙:
- 식물 단계 그림: "Realistic botanical illustration … children's science encyclopedia watercolor and colored pencil style … plant only, no pot, no soil, stem base at bottom center" + 종·단계별 정확한 형태 묘사(잎 모양, 꽃색, 열매). 기준은 `docs/style-samples/B_real.png`.
- 'seed' 그림은 그 종의 실제 씨 2~3알 클로즈업이다. 'winter'는 잎 없는 가지다.
- transplant 종의 'grownTree' 이후 그림은 땅에 선 나무다(밑동이 흙에 닿음, 배경 투명).
- 화분 4종·배경 6종·벌레 2종은 클레이풍이고 기준은 `docs/style-samples/A_cute.png`의 화분·배경이다.

검수 관문(종마다 반복):
1. 해당 종을 생성한다.
2. AI 선검수: 모음판을 읽고 도감 기준(잎 모양·잎차례·꽃 모양·색·열매)과 맞지 않는 단계를 골라 다시 만든다. 최대 2회.
3. 모음판 경로를 교사에게 보이고 기다린다. 불합격 단계만 다시 만든다.
4. 통과하면 `approved.json`에 `true`로 기록한다.
- **봉숭아를 먼저 끝까지 통과시킨 뒤** 그 결과로 프롬프트 공통부·크기·여백 기준을 확정하고 나머지 8종을 진행한다.

- [ ] **Step 1: 실패하는 테스트 작성** — 다음을 확인한다.
  - `approved.test.ts`: approved.json에 balsam만 true → `isApproved('balsam')` true, `isApproved('rice')` false
  - `manifest covers every species stage`: SPECIES의 모든 (id, stage) 조합에 manifest 행이 있음(TS 테스트에서 json import로 확인)
  - `test_contact_sheet.py`: 더미 png 3장 → 출력 폭이 3장 폭 합 이상
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — manifest 행 수는 식물 (6×5 + 8×4) = 62 + 화분 4 + 배경 6 + 벌레 2 = 74.
- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: 봉숭아 생성 → AI 선검수 → 교사 검수 대기** — 교사 응답 없이 다음 종으로 넘어가지 않는다.
- [ ] **Step 6: 나머지 8종을 같은 관문으로 진행**(종별로 교사 검수).
- [ ] **Step 7: Commit** — 종이 통과할 때마다 `feat(assets): <species> approved`

---

### Task 13: 오프라인·영구 저장·배포

**Files:**
- Modify: `vite.config.ts`(vite-plugin-pwa), `src/main.tsx`(`requestPersist()` 호출)
- Create: `public/manifest.webmanifest`, `vercel.json`
- Test: `tests/e2e/offline.spec.ts`

**Interfaces:**
- Consumes: 전체 앱
- Produces: 프로덕션 URL

- [ ] **Step 1: 실패하는 테스트 작성** — `works offline after first load`: 미리보기 서버에서 한 번 로드 → `context.setOffline(true)` → 새로고침 → `main` 보임, 식물 그림 로드됨.
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — workbox precache 범위는 js·css·폰트·`public/**/*.webp`. 앱 이름은 교사가 정할 때까지 "나의 식물 한살이"로 둔다.
- [ ] **Step 4: 미러 빌드 후 통과 확인** — `bash scripts/mirror-build.sh` 성공, 미러에서 `npx playwright test tests/e2e/offline.spec.ts` PASS.
- [ ] **Step 5: 배포** — 미러에서 `npx vercel deploy --prod --yes --cwd /c/Users/Public/plant-life`. 배포 URL을 갤럭시탭·아이패드·크롬북 실기기로 확인하는 일은 교사에게 요청한다(물주기 길게 누르기, 끌기, 인쇄).
- [ ] **Step 6: Commit** — `chore: pwa offline and deploy config`
