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
- **lib.rs**: Tauri 앱 진입점, 백그라운드 태스크로 로그 워처 시작
- **watcher/log_watcher.rs**: notify-debouncer-full로 파일 감시, FileTracker로 파일별 읽은 위치 추적
- **watcher/log_parser.rs**: 로그 라인 파싱, 도구 이름으로 에이전트 타입 결정
- **models/mod.rs**: `Agent`, `LogEntry`, `AppEvent` 타입 정의

### Frontend (src/)
- **components/office/OfficeCanvas.tsx**: PixiJS 기반 사무실 렌더링 (550x700 캔버스)
  - `FlyingDocument`: 에이전트 간 서류 전달 애니메이션 (포물선 궤적, 회전)
  - `MonitorScreen`: 에이전트 상태별 모니터 화면 동적 변화
  - `AgentSprite`: 에이전트 캐릭터 렌더링 및 바운스 애니메이션
  - `HorizontalPartition`: 섹션 구분용 연두색 가로 파티션 바
  - `HudDisplay`: 상단 HUD 바 (툴콜/에러/에이전트전환 카운트, 레이트리밋 표시)
  - `AlertLight`: 에러 발생 시 책상 위 빨간 경고등 깜빡임
  - `QueueIndicator`: 레이트리밋 시 모래시계 + 대기열 점 애니메이션
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
- `AgentType`: reader, searcher, writer, editor, runner, tester, planner, support
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

### Agent-Tool Mapping
`log_parser.rs`의 `determine_agent_type()`:
- Read → Reader (파란색 0x60a5fa)
- Glob/Grep/WebSearch/WebFetch → Searcher (하늘색 0x38bdf8)
- Write → Writer (초록색 0x4ade80)
- Edit/NotebookEdit → Editor (진초록 0x22c55e)
- Bash (일반) → Runner (노란색 0xfbbf24)
- Bash (git/test/npm/pnpm/yarn/cargo) → Tester (주황색 0xf97316)
- TodoWrite/Task → Planner (분홍색 0xf472b6)
- AskUserQuestion/Error → Support (보라색 0xa78bfa)

### Office Layout
3-3-2 세로 배치 (`DESK_CONFIGS` in types/index.ts, 550x700 캔버스, 좌측 정렬):
```
┌─────────────────────────────────────────────┐ Y=0
│              (벽 영역 70px)                  │
├═══════════════════════┤                     │ Y=70 (파티션 1)
│ [Reader]  [Searcher]  [Writer]              │ Y=130 (facing up)
│   (60)      (200)      (340)                │
│                                             │
│ [Editor]  [Runner]    [Tester]              │ Y=320 (facing down)
│   (60)      (200)      (340)                │
├═══════════════════════┤                     │ Y=420 (파티션 2)
│ [Planner] [Support]                         │ Y=520 (facing up)
│   (60)      (200)                           │
└─────────────────────────────────────────────┘ Y=700
```
Agent 위치는 `getAgentPosition()` 함수가 DESK_CONFIGS에서 계산 (책상 Y - 55px).

### Document Transfer Animation
에이전트 간 업무 전환을 서류 전달로 시각화:
1. `useTauriEvents.ts`의 `handleDocumentTransfer()`가 tool_call 이벤트에서 에이전트 변경 감지
2. `agentStore.startDocumentTransfer(fromId, toId)` 호출
3. `OfficeCanvas`의 `FlyingDocument` 컴포넌트가 600ms 동안 포물선 애니메이션 렌더링
4. 완료 시 `clearDocumentTransfer()` 자동 호출

### Monitor Screen States
`MonitorScreen` 컴포넌트가 에이전트 상태별 화면 표시:
- **idle**: 어두운 화면 + 스캔라인
- **working**: 에이전트 색상의 코드 라인 스크롤 + 커서 깜빡임
- **thinking**: 로딩 점 3개 순차 깜빡임
- **passing**: 화살표 오른쪽 이동 애니메이션
- **error**: 빨간 배경 깜빡임 + X 마크

### Agent Motion
- **입장 모션**: 에이전트가 활성화되면 화면 상단 입구에서 책상 위치로 700ms 동안 이동 (`entering` phase)
- **걷기 모션**: 에이전트가 `idle` 상태로 전환되면 사무실을 걸어다님 (`walking` phase)
  - 한 번이라도 등장한 에이전트만 걷기 가능 (처음 idle은 무시)
  - 같은 Y band 내에서만 이동 (파티션 관통 방지)
  - 2~4초 멈춤 후 다음 웨이포인트로 이동 반복
  - 걷기 애니메이션: 더 빠른 프레임 간격(180ms), 더 큰 다리/팔 움직임
  - 이동 방향에 따라 눈동자 시선 변경
- **복귀 모션**: 걷는 중 `working` 상태로 전환되면 책상으로 복귀 (`returning` phase)
  - 거리 기반 duration (300~800ms 범위)
- **Walkable bands** (Y좌표 범위):
  - 85~115: 파티션1 아래
  - 175~280: Section A~B 사이
  - 360~410: Section B~파티션2 사이
  - 440~490: 파티션2 아래
  - 565~670: Section C 아래~바닥

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
