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

# Rust 백엔드 타입 체크
cd src-tauri && cargo check

# Rust 백엔드 빌드
cd src-tauri && cargo build
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
- **components/office/OfficeCanvas.tsx**: PixiJS 기반 2x2 사무실 렌더링 (상단에 상수 정의)
- **hooks/useTauriEvents.ts**: `listen("app-event")`로 Tauri 이벤트 구독
- **store/agentStore.ts, logStore.ts**: Zustand 상태 관리
- **types/index.ts**: 타입 정의, `DESK_CONFIGS` (2x2 그리드 배치), `AGENT_COLORS`

### Type Synchronization (중요)
Rust와 TypeScript 타입은 수동 동기화 필요:
- `AgentType`: researcher, coder, reviewer, artist
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
- TodoWrite → Artist (분홍색)

### Office Layout
2x2 그리드 배치 (`DESK_CONFIGS` in types/index.ts):
```
Researcher | Coder
-----------+--------
Reviewer   | Artist
```
