# Agents Office

Claude Code가 작업하는 과정을 **사무실 속 에이전트(Researcher/Coder/Reviewer/Artist)**로 시각화하는 Tauri 데스크톱 앱입니다.  
로컬의 Claude 로그(`$HOME/.claude/**`)를 감시(watch)하고, 이벤트를 프론트엔드(PixiJS 캔버스 + Inbox 로그 패널)로 스트리밍합니다.

![Agents Office screenshot](./image.png)

## 주요 기능
- **에이전트 시각화**: 상태(Idle/Working/Thinking/Passing/Error)를 픽셀 아트 스타일로 표시
- **Inbox 로그**: Claude 로그 라인을 `LogEntry`로 파싱해 최근 항목을 표시(최대 100개)
- **Watcher 상태 표시**: `Watching/Idle`, 세션 ID 표시(이벤트 기반)

## 요구사항
- **Node.js**: 18 이상 권장
- **Rust**: stable toolchain
- **Tauri prerequisites**: OS별 빌드 의존성 설치가 필요합니다. 자세한 내용은 [Tauri prerequisites](https://tauri.app/start/prerequisites/)를 참고하세요.

## 실행 방법

### 1) 의존성 설치

```bash
npm install
```

### 2) 웹(브라우저)로 개발 실행

```bash
npm run dev
```

### 3) 데스크톱(Tauri)로 개발 실행

```bash
npm run tauri:dev
```

## 빌드

### 웹 빌드

```bash
npm run build
```

### 데스크톱(Tauri) 빌드

```bash
npm run tauri:build
```

## 권한/보안 (중요)
이 앱은 Claude 로그를 읽기 위해 Tauri capability로 **로컬 파일 읽기 권한**을 사용합니다.

- **읽는 경로**: `$HOME/.claude/**`
  - 주로 `$HOME/.claude/debug`, `$HOME/.claude/projects` 하위를 감시합니다.
- **읽는 파일 유형**: `.txt`, `.jsonl`, `.json`
- **동작 방식**: 파일의 “새로 추가된 줄”만 읽어 프론트로 이벤트를 emit 합니다.
- **주의**: 로그에 민감 정보가 포함될 수 있습니다. 앱은 로컬에서만 처리하지만, 화면 공유/스크린샷에 포함되지 않도록 주의하세요.

관련 설정은 [`src-tauri/capabilities/default.json`](./src-tauri/capabilities/default.json)에서 확인할 수 있습니다.

## 아키텍처 개요

```mermaid
flowchart LR
  claudeHome[claudeHomeDir] --> debugDir[debugDir]
  claudeHome --> projectsDir[projectsDir]
  watcher[logWatcherRust] -->|"emit(app-event)"| frontend[reactPxiUi]
  frontend --> stores[zustandStores]
```

### 이벤트 흐름(요약)
- Rust 워처가 파일 변경을 감지하고 로그 라인을 파싱
- `app-event`로 프론트에 이벤트 전송
  - `LogEntry`: Inbox 로그 추가
  - `AgentUpdate`: 에이전트 상태/업무 표시 갱신
  - `WatcherStatus`: 상단 상태(Watching/Idle) 갱신

## 라이선스
MIT

