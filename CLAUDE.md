# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agents Office는 Claude Code의 작업을 2D 픽셀아트 사무실에서 일하는 에이전트들로 시각화하는 Tauri 데스크톱 앱입니다. `~/.claude/debug`와 `~/.claude/projects` 디렉토리를 감시하여 실시간으로 에이전트 상태를 업데이트합니다.

## Commands

```bash
# Tauri 앱 개발 모드 (프론트엔드 + Rust 백엔드)
npm run tauri:dev

# 프론트엔드만 개발 서버 (브라우저에서 확인)
npm run dev

# 프로덕션 빌드
npm run tauri:build

# 프론트엔드만 빌드
npm run build

# 프론트엔드 프리뷰 (빌드 결과 확인)
npm run preview

# Rust 백엔드 타입 체크
cd src-tauri && cargo check

# Rust 테스트 실행
cd src-tauri && cargo test
```

## Tech Stack
- **Frontend**: React 18 + PixiJS 7 + Zustand 5 + Vite 6 + TypeScript 5
- **Backend**: Tauri 2.x + Rust (notify-debouncer-full for file watching)
- **Styling**: TailwindCSS 3

## Architecture

### Data Flow
```
~/.claude/debug/*.txt   ─┐
                         ├→ Rust LogWatcher → AppEvent → Tauri emit → useTauriEvents → Zustand → PixiJS
~/.claude/projects/**/* ─┘     (200ms debounce)         ("app-event")
```

### AppEvent Types (Tauri → Frontend)
- `LogEntry`: Inbox 로그 항목 추가
- `AgentUpdate`: 에이전트 상태/현재 작업 갱신
- `WatcherStatus`: 상단 Watching/Idle 상태 표시
- `SessionUpdate`: 세션 ID 갱신
- `BatchUpdate`: 여러 로그/에이전트 업데이트를 배치로 처리 (성능 최적화)

### Backend (src-tauri/src/)
- **lib.rs**: Tauri 앱 진입점, 로그 워처는 `spawn_blocking`으로 실행(블로킹 watcher 루프가 런타임을 점유하지 않게 격리)
- **watcher/log_watcher.rs**: notify-debouncer-full로 파일 감시 + 배치 emit (`AppEvent::BatchUpdate`)
  - `FileTracker`는 파일별 읽은 위치를 **실제 stream position 기준**으로 추적(EOF seek로 점프하지 않음 → append 중에도 누락 방지)
  - 파일 truncate/rotate 감지 시 오프셋 리셋
  - **개행 없는 마지막 줄**은 tail-buffer로 보관 후 다음 이벤트에서 이어붙임(증분 읽기에서 중복/유실 방지)
  - `tracing::debug!`로 배치 처리 시간/라인 수/emit 크기 계측(병목 분석용)
- **watcher/log_parser.rs**: 로그 라인 파싱
  - `"Tool call: ..."` / `"Tool result: ..."`는 fast-path로 분기(Regex/불필요한 lowercase 할당 최소화)
  - tool name 기반 에이전트 타입 결정
- **models/mod.rs**: `Agent`, `LogEntry`, `AppEvent` 타입 정의

### Frontend (src/)
- **components/office/OfficeCanvas.tsx**: PixiJS 기반 사무실 렌더링 (550×700 캔버스)
- **components/office/canvas/**: OfficeCanvas 하위 모듈
  - `agent/AgentSprite.tsx`: 에이전트 캐릭터 렌더링 및 바운스 애니메이션
  - `desk/Desk.tsx`: 책상 + 모니터(상태별 화면), AlertLight, QueueIndicator 포함
  - `document/FlyingDocument.tsx`: 에이전트 간 서류 전달 애니메이션 (포물선 궤적, 회전, 툴 스탬프)
  - `effects/EffectsLayer.tsx`: 시각 효과 레이어 (4가지 효과 타입)
  - `background/OfficeBackground.tsx`: 바닥 타일, 창문, 벽, 우측 장식 요소 렌더링
  - `partition/HorizontalPartition.tsx`: 섹션 구분 파티션 (300px 너비)
  - `hud/HudDisplay.tsx`: 상단 HUD 바 (툴콜/에러/에이전트전환 카운트, 레이트리밋 표시)
  - `hooks/useAgentMotion.ts`: 에이전트 모션 상태 관리 (5단계 phase)
  - `hooks/useNowRaf.ts`: RAF 루프 드라이버 (애니메이션 시 ~30fps throttle)
  - `hooks/useOfficeViewport.ts`: 뷰포트 스케일링 계산
  - `constants.ts`, `layout.ts`, `types.ts`, `math.ts`: 상수, 레이아웃 유틸, 타입, 수학 함수
- **hooks/useTauriEvents.ts**: `listen("app-event")`로 Tauri 이벤트 구독, 에이전트 전환 감지, HUD 메트릭 기록
- **store/agentStore.ts**: Zustand 상태 관리
  - `documentTransfer`: 서류 전달 애니메이션 상태 (fromAgentId, toAgentId, startedAt)
  - `lastActiveAgentId`: 마지막 활성 에이전트 추적 (서류 전달 트리거용)
  - `lastTaskUpdateById`: 에이전트별 마지막 task 업데이트 시간 (말풍선 타임아웃용)
  - `errorById`: 에이전트별 에러 상태 추적 (경고등 표시용)
- **store/hudStore.ts**: HUD 메트릭 상태 관리
  - 60초 슬라이딩 윈도우로 tool_call, error, agent_switch 이벤트 추적
  - `rateLimitActive`: 레이트리밋 활성 상태
- **store/logStore.ts**: 로그 엔트리 관리
- **types/index.ts**: 타입 정의, `DESK_CONFIGS` (3-3-2 세로 배치), `AGENT_COLORS`

### Type Synchronization (중요)
Rust와 TypeScript 타입은 수동 동기화 필요:
- `AgentType`: explorer, analyzer, architect, developer, operator, validator, connector, liaison
- `AgentStatus`: idle, working, thinking, passing, error
- `LogEntryType`: tool_call, tool_result, message, error, todo_update, session_start, session_end

변경 시 `src-tauri/src/models/mod.rs`와 `src/types/index.ts` 둘 다 수정해야 함.

## Key Patterns

### Tauri 환경 체크
브라우저에서 `npm run dev` 실행 시 Tauri API가 없어서 에러 발생. Tauri API 사용 전 환경 체크 필요:
```typescript
function isTauriEnv(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}
```
`useTauriEvents.ts`에서 이 패턴으로 브라우저/Tauri 환경 분기 처리함.

### Agent-Tool Mapping (워크플로우 기반)
`log_parser.rs`의 `determine_agent_type()`:
- Read/Glob → Explorer (파란색 0x3b82f6) - 파일 탐색
- Grep/WebSearch → Analyzer (cyan 0x06b6d4) - 내용 분석
- TodoWrite/Task → Architect (분홍색 0xf472b6) - 계획 수립
- Write/Edit/NotebookEdit → Developer (초록색 0x22c55e) - 코드 작성
- Bash (일반) → Operator (노란색 0xfbbf24) - 명령 실행
- Bash (test/git/jest/vitest/pytest) → Validator (주황색 0xf97316) - 테스트/검증
- WebFetch/mcp__*/Skill → Connector (보라색 0x8b5cf6) - 외부 연동
- AskUserQuestion/Error → Liaison (핑크 0xec4899) - 사용자 소통

### Office Layout
3-3-2 세로 배치 (`DESK_CONFIGS` in types/index.ts, 550×700 캔버스):
```
┌─────────────────────────────────────────────┬────────┐ Y=0
│              (벽 영역 70px)                  │        │
│  ┌──────────────────────────────────────────┤[Hanger]│ Y=70
│  │ ENTRANCE (156px)                         │        │ Y=80
├═══════════════════════════┤                 │[Locker]│ Y=70 (파티션 1, 300px 너비)
│ [Explorer] [Analyzer] [Architect]           │        │ Y=130 (facing up)
│   (60)      (150)      (240)                │        │  탐색/분석/설계
│                                             │  RIGHT │
│ [Developer][Operator] [Validator]           │  WALL  │ Y=320 (facing down)
│   (60)      (150)      (240)                │ X=500~ │  구현/실행/검증
├═══════════════════════════┤                 │        │ Y=420 (파티션 2, 300px 너비)
│ [Connector][Liaison]                        │        │ Y=520 (facing up)
│   (60)      (150)                           │        │  통합/소통
├─────────────────────────────────────────────┴────────┤
│              (하단 창문 밴드 78px)                     │
└──────────────────────────────────────────────────────┘ Y=700
```
- Agent 위치: `getAgentPosition()` 함수가 DESK_CONFIGS에서 계산 (책상 Y - 55px)
- 우측 장식: 옷걸이(Y=80), 사물함 2×5 그리드(Y=180)
- 파티션: 300px 너비 (우측 벽 영역 회피)

### Document Transfer Animation
에이전트 간 업무 전환을 서류 전달로 시각화:
1. `useTauriEvents.ts`의 `handleDocumentTransfer()`가 tool_call 이벤트에서 에이전트 변경 감지
2. `agentStore.startDocumentTransfer(fromId, toId, toolName)` 호출 (toolName 포함)
3. `FlyingDocument` 컴포넌트가 600ms 동안 포물선 애니메이션 렌더링:
   - **툴 스탬프**: 서류 위에 툴 종류별 픽셀아트 아이콘 + 라벨 표시
   - `TOOL_STAMPS` 매핑 (워크플로우 기반):
     - read/glob → EXPL (Explorer)
     - grep/websearch → ANLZ (Analyzer)
     - todowrite/task → ARCH (Architect)
     - write/edit → DEV (Developer)
     - bash → OPER (Operator)
     - webfetch/skill → CONN (Connector)
     - askuserquestion → LIAS (Liaison)
   - 스택 깊이에 따른 오프셋/스케일/투명도 조절 (동시 다발 전송 대응)
4. 완료 시 `clearDocumentTransfer()` 자동 호출

### Monitor Screen States
`MonitorScreen` 컴포넌트가 에이전트 상태별 화면 표시:
- **idle**: 어두운 화면 + 스캔라인
- **working**: 에이전트 색상의 코드 라인 스크롤 + 커서 깜빡임
- **thinking**: 로딩 점 3개 순차 깜빡임
- **passing**: 화살표 오른쪽 이동 애니메이션
- **error**: 빨간 배경 깜빡임 + X 마크

### Agent Motion (5-Phase System)
`useAgentMotion` 훅이 에이전트 상태 변화에 따라 5단계 phase를 관리:

**Motion Phases** (`MotionPhase` 타입):
1. **absent**: 등장 전 초기 상태
2. **entering**: 입구에서 책상으로 이동 (700ms, easeOutCubic)
3. **present**: 책상에 정착한 상태 (정적)
4. **walking**: 사무실 내 걷기 (idle 전환 시)
5. **returning**: 걷기 중 working 전환 시 책상으로 복귀

**상태 전이**:
- `absent` → `entering`: 첫 tool_call 발생 시
- `entering` → `present`: 700ms 경과 후
- `present` → `walking`: working → idle 전환 시
- `walking` → `returning`: idle → working 전환 시
- `returning` → `present`: 복귀 완료 시

**걷기 모션 상세**:
- 같은 Y band 내에서만 이동 (파티션 관통 방지)
- 속도: 35px/sec (`WALKING_SPEED_PX_PER_SEC`)
- 웨이포인트 도달 후 2~4초 랜덤 멈춤 후 다음 이동
- 걷기 애니메이션: 180ms 프레임 간격, 확대된 팔다리 움직임
- 이동 방향에 따라 눈동자 시선 변경

**Walkable Areas**:
- X 범위: 30~295 (`WALK_X_MIN` ~ `WALK_X_MAX`)
- Y bands (파티션 관통 방지):
  - 85~115: 파티션1 아래 ~ Section A 위
  - 175~280: Section A ~ Section B 사이
  - 360~410: Section B ~ 파티션2 사이
  - 440~490: 파티션2 아래 ~ Section C 위
  - 565~670: Section C 아래 ~ 바닥

### Speech Bubble Timeout
`OfficeCanvas`에서 `clearExpiredTasks()`를 1초마다 호출하여 5초 이상 업데이트 없는 에이전트의 말풍선을 자동으로 숨김. 타임아웃 값은 `SPEECH_BUBBLE_TIMEOUT_MS` 상수로 조절.

### HUD (Heads-Up Display)
캔버스 상단에 반투명 바로 실시간 지표 표시:
- **Calls**: 60초 내 tool_call 이벤트 수
- **Err**: 60초 내 에러 발생 수
- **Switch**: 60초 내 에이전트 전환 수
- **LIMIT**: 레이트리밋 발생 시 깜빡임 표시

`hudStore.ts`가 이벤트를 60초 슬라이딩 윈도우로 추적하며, 1초마다 오래된 데이터를 자동 정리.

### Error Alert Light
에러 발생 시 해당 에이전트 책상 모니터 우측에 빨간 경고등이 200ms 주기로 깜빡임:
- `useTauriEvents.ts`에서 `entry_type === "error"` 감지 시 `setAgentError(agentId, true)` 호출
- 이후 tool_call/tool_result 성공 시 `setAgentError(agentId, false)`로 해제
- `AlertLight` 컴포넌트가 빨간 불빛 + glow 효과 렌더링

### Rate Limit Visual Effects
레이트리밋 감지 시 시각적 피드백:
1. **휴가 표지판**: 기존 VacationSign 컴포넌트 표시
2. **대기열 표시**: QueueIndicator 컴포넌트 - 모래시계 아이콘 + 점 3개 순차 깜빡임 (500ms 주기)
3. **HUD 강조**: "LIMIT" 텍스트 빨간색 깜빡임

레이트리밋 패턴 감지: `isLimitReachedMessage()` 함수가 "rate_limit", "hit your limit" 등 패턴 매칭.

### Session Timeline
`Timeline.tsx` 컴포넌트가 최근 이벤트를 가로 막대 형태로 시각화:
- 색상 코딩된 점(dot)으로 이벤트 유형 표시 (tool_call, error 등)
- 마우스 호버 시 툴팁으로 상세 정보 표시 (에이전트, 상대 시간)
- `TIMELINE_COLORS`로 이벤트 유형별 색상 정의
- 토글 버튼으로 표시/숨김 전환 가능

### Visual Effects System
`EffectsLayer.tsx`가 에이전트 동작에 따른 시각 효과를 렌더링:

**효과 타입** (`VisualEffect.kind`):
- **searchPulse**: 동심원 펄스 (Explorer/Analyzer/Connector) - 2개 링이 확장하며 페이드아웃
- **typeParticles**: 상승 파티클 (Architect/Developer/Liaison) - 6개 사각형이 위로 떠오름
- **runSpark**: 스파크 버스트 (Operator) - 8방향 스파크 + 중앙 글로우
- **errorBurst**: 폭발 패턴 (에러 발생 시) - 10개 파편 + 플래시

**구현 상세**:
- deterministic 파티클 생성: `seed` 값으로 일관된 랜덤 패턴
- 500ms마다 만료 효과 자동 정리 (`removeExpiredEffects`)
- `easeOutCubic` 적용으로 자연스러운 애니메이션

### Agent Mood System
`AgentMood` 타입이 에이전트 표정을 결정:

**무드 타입**:
- **neutral**: 기본 표정
- **focused**: 집중 표정 (최근 2초 내 tool_call 발생 시)
- **stressed**: 긴장 표정 (에러 발생 시)
- **blocked**: 차단 표정 (레이트리밋/vacation 상태)

**결정 로직** (우선순위 순):
1. `vacationById[id]` → `blocked`
2. `errorById[id]` → `stressed`
3. 마지막 tool_call 2초 이내 → `focused`
4. 기본 → `neutral`

### useNowRaf Pattern
RAF(requestAnimationFrame) 기반 애니메이션 루프:
```typescript
useNowRaf({
  nowRef,           // 현재 시간 ref (리렌더 방지)
  documentTransfers,
  motionById,
  effects,
  removeExpiredEffects,
});
```
- 애니메이션 활성 시에만 ~30fps로 throttle (33ms 간격)
- refs로 자주 변경되는 상태 미러링 → 효과 1회 설치
- 활성 상태 체크: 문서 전송, entering/walking/returning 모션, 시각 효과

### Canvas Constants
주요 레이아웃 상수 (`constants.ts`):
```
OFFICE_WIDTH = 550      // 캔버스 너비
OFFICE_HEIGHT = 700     // 캔버스 높이
RIGHT_WALL_START_X = 500  // 우측 벽 시작 위치
ENTRANCE_WIDTH = 156    // 입구 너비
COAT_HANGER_X = 420     // 옷걸이 X 위치
LOCKER_X = 420          // 사물함 X 위치
LOCKER_CELL_SIZE = 24   // 사물함 칸 크기 (2×5 그리드)
PARTITION_WIDTH = 300   // 파티션 너비 (우측 벽 회피)
```

### Build Optimization
Vite 빌드 설정 (`vite.config.ts`):
```typescript
build: {
  chunkSizeWarningLimit: 700,  // KB (PixiJS 청크 경고 회피)
  rollupOptions: {
    output: {
      manualChunks: {
        pixi: ["pixi.js", "@pixi/react"],  // ~420KB
        react: ["react", "react-dom"],     // ~140KB
        tauri: ["@tauri-apps/api", ...],   // ~30KB
        vendor: ["zustand"],               // ~10KB
      }
    }
  }
}
```
- 주요 의존성 별도 청크 분리로 캐싱 효율 극대화
- PixiJS가 가장 큰 청크이므로 경고 임계값 700KB 설정
