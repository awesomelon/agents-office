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

# Rust 백엔드 타입 체크
cd src-tauri && cargo check
```

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

### Backend (src-tauri/src/)
- **lib.rs**: Tauri 앱 진입점, 백그라운드 태스크로 로그 워처 시작
- **watcher/log_watcher.rs**: notify-debouncer-full로 파일 감시, FileTracker로 파일별 읽은 위치 추적
- **watcher/log_parser.rs**: 로그 라인 파싱, 도구 이름으로 에이전트 타입 결정
- **models/mod.rs**: `Agent`, `LogEntry`, `AppEvent` 타입 정의

### Frontend (src/)
- **components/office/OfficeCanvas.tsx**: PixiJS 기반 2x2 사무실 렌더링
  - `FlyingDocument`: 에이전트 간 서류 전달 애니메이션 (포물선 궤적, 회전)
  - `MonitorScreen`: 에이전트 상태별 모니터 화면 동적 변화
  - `AgentSprite`: 에이전트 캐릭터 렌더링 및 바운스 애니메이션
- **hooks/useTauriEvents.ts**: `listen("app-event")`로 Tauri 이벤트 구독, 에이전트 전환 감지
- **store/agentStore.ts**: Zustand 상태 관리
  - `documentTransfer`: 서류 전달 애니메이션 상태 (fromAgentId, toAgentId, startedAt)
  - `lastActiveAgentId`: 마지막 활성 에이전트 추적 (서류 전달 트리거용)
  - `lastTaskUpdateById`: 에이전트별 마지막 task 업데이트 시간 (말풍선 타임아웃용)
- **store/logStore.ts**: 로그 엔트리 관리
- **types/index.ts**: 타입 정의, `DESK_CONFIGS` (2x2 그리드 배치), `AGENT_COLORS`

### Type Synchronization (중요)
Rust와 TypeScript 타입은 수동 동기화 필요:
- `AgentType`: researcher, coder, reviewer, manager
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
- Read/Glob/Grep → Researcher (파란색)
- Edit/Write → Coder (초록색)
- Bash → Reviewer (노란색)
- TodoWrite/Task → Manager (분홍색)

### Office Layout
2x2 그리드 배치 (`DESK_CONFIGS` in types/index.ts):
```
Researcher | Coder
-----------+--------
Reviewer   | Manager
```

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
- **입장 모션**: 에이전트가 활성화되면 화면 하단에서 책상 위치로 700ms 동안 이동
- **퇴장 모션**: 없음 (즉시 사라짐)

### Speech Bubble Timeout
`OfficeCanvas`에서 `clearExpiredTasks()`를 1초마다 호출하여 5초 이상 업데이트 없는 에이전트의 말풍선을 자동으로 숨김. 타임아웃 값은 `SPEECH_BUBBLE_TIMEOUT_MS` 상수로 조절.
