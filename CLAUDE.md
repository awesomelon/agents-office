# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agents Office는 Claude Code의 작업을 2D 픽셀아트 사무실에서 일하는 에이전트들로 시각화하는 Tauri 데스크톱 앱입니다.

## Commands

```bash
# 개발 서버 실행 (프론트엔드만)
npm run dev

# Tauri 앱 개발 모드 (프론트엔드 + Rust 백엔드)
npm run tauri:dev

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
~/.claude/debug/*.txt  →  Rust LogWatcher  →  AppEvent  →  Frontend Store  →  PixiJS Canvas
~/.claude/projects/    →  (file changes)   →  (Tauri)   →  (Zustand)       →  (React)
```

### Backend (src-tauri/src/)
- **lib.rs**: Tauri 앱 진입점, 로그 워처 시작
- **watcher/log_watcher.rs**: `~/.claude` 디렉토리 감시, 파일 변경 시 새 라인만 읽음
- **watcher/log_parser.rs**: 로그 라인 파싱, 도구별 에이전트 타입 결정
- **models/mod.rs**: `Agent`, `LogEntry`, `AppEvent` 타입 정의 (프론트엔드와 동기화 필수)

### Frontend (src/)
- **components/office/OfficeCanvas.tsx**: PixiJS 기반 사무실 렌더링 (배경, 책상, 에이전트, 말풍선)
- **hooks/useTauriEvents.ts**: Tauri 이벤트 구독하여 스토어 업데이트
- **store/agentStore.ts**: 에이전트 상태 관리 (Zustand)
- **types/index.ts**: 타입 정의 및 `DESK_CONFIGS`, `AGENT_COLORS` 상수

### Type Synchronization
Rust `models/mod.rs`의 타입들과 TypeScript `types/index.ts`의 타입들은 수동으로 동기화해야 합니다:
- `AgentType`: researcher, coder, reviewer, artist
- `AgentStatus`: idle, working, thinking, passing, error
- `LogEntryType`: tool_call, tool_result, message, error, todo_update, session_start, session_end

## Key Patterns

### Agent-Tool Mapping
`log_parser.rs`의 `determine_agent_type()`이 도구 이름에 따라 에이전트를 할당:
- Read/Glob/Grep → Researcher
- Edit/Write → Coder
- Bash → Reviewer
- TodoWrite → Artist

### OfficeCanvas Constants
`OfficeCanvas.tsx` 상단에 모든 매직 넘버가 상수로 정의됨 (CANVAS_*, FLOOR_*, WALL_*, etc.)
