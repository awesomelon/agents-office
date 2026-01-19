# Session Context - 2026-01-19T00:00:00Z

## Current Session Overview
- **Main Task/Feature**: Claude Code 동작 시각화 확장 (HUD 지표 강화 + 문서 전달 연출 스택/툴 스탬프 + 이벤트/렌더 성능 최적화 및 BatchUpdate 경로 추가)
- **Session Duration**: 이 대화 세션 동안 연속 작업
- **Current Status**: 문서 전달(툴 스탬프/스택) 및 HUD(평균 응답시간) 구현 완료. 이후 사용자가 BatchUpdate/성능 최적화 패치를 추가로 적용한 상태로 보이며, Rust 백엔드에서 `BatchUpdate` 이벤트를 실제로 emit하는지/프론트 타입이 맞는지 최종 점검이 남아있음.

## Recent Activity (Last 30-60 minutes)
- **What We Just Did**:
  - HUD 지표에 최근 60초 기준 `Calls/Avg/Err/Switch` 표시 및 rate limit/LIMIT 표시 유지.
  - 문서 전달 애니메이션을 단일값에서 큐(스택)로 바꾸고, 툴 스탬프/색상 표시 추가.
  - 사용자 패치로 BatchUpdate 경로 추가:
    - `useTauriEvents`에 `BatchUpdate` 케이스 추가 및 `handleBatchUpdate`로 로그/에이전트/상태를 배치로 처리.
    - `agentStore`에 batch 업데이트 함수들(`updateAgentsBatch`, `setAgentVacationsBatch`, `setAgentErrorsBatch`) 추가.
    - `hudStore`에 `recordEventsBatch` 추가(툴콜/툴결과/에러/스위치 집계 일괄 처리).
  - 사용자 패치로 OfficeCanvas 성능 개선:
    - RAF tick마다 state 업데이트 대신 `nowRef` + `forceUpdate`(조건부/스로틀)로 렌더 빈도 감소.
    - `OfficeBackground`를 뷰포트 기반으로 부분 렌더 및 가로 반복 데코(창/화분) 처리.
    - Zustand selector들을 `useShallow`로 통합해 re-render 감소.
- **Active Problems**:
  - `AppEvent` 타입에 `BatchUpdate`가 TS/Rust 양쪽에 정의되어 있는지 확인 필요 (`src/types/index.ts`, `src-tauri/src/models/mod.rs`).
  - Rust watcher/emit 쪽에서 실제로 `BatchUpdate` payload(logs/agents)가 생성/emit되는지 확인 필요 (`src-tauri/src/...`).
  - `useTauriEvents.ts`에 `isToolActivity`가 중복 선언된 것으로 보임(파일 중간에 동일 함수가 2번 존재). 기능상 문제는 없을 수 있으나 정리 필요.
  - `OfficeCanvas`의 `useEffect(()=>{...})`(finalize entering) 의존성 없는 상태로 매 렌더마다 실행되는 구조가 의도인지 확인 필요(현재 코드상 `forceUpdate`로 렌더가 발생할 수 있어 잦은 setState 가능).
- **Current Files**:
  - `src/hooks/useTauriEvents.ts`
  - `src/store/agentStore.ts`
  - `src/store/logStore.ts`
  - `src/store/hudStore.ts`
  - `src/components/office/OfficeCanvas.tsx`
- **Test Status**:
  - 이전 단계에서는 `npm run build`(tsc+vite build) 성공 확인.
  - 사용자 패치 이후에는 빌드/린트 재확인이 필요(현재 핸드오프 시점에서는 실행하지 않음).

## Key Technical Decisions Made
- **Architecture Choices**:
  - 기존 흐름 유지: Tauri `app-event` → `useTauriEvents` → Zustand → PixiJS(`OfficeCanvas`).
  - 문서 전달은 UI 연출이므로 Rust 타입 추가 없이 프론트 상태(`agentStore`) 확장으로 구현.
  - 이벤트 폭주에 대비해 “배치 업데이트(BatchUpdate)” 경로를 추가해 store set 횟수를 줄이는 방향(사용자 패치).
- **Implementation Approaches**:
  - HUD 평균 응답시간: `tool_call` 타임스탬프 큐 + `tool_result`에서 pop하여 duration 집계(60초 윈도우).
  - 문서 스택: `documentTransfers`(cap=8) + 개별 `id` 기반 제거 + `stackDepth`로 오프셋/알파/스케일/회전 차등.
  - 성능: RAF tick마다 setState 대신 `ref` + 조건부 렌더 트리거, selector 통합(`useShallow`), 배경 렌더링을 뷰포트 기준으로 제한.
- **Technology Selections**:
  - 신규 라이브러리 추가 없음. 기존 `zustand`, `@pixi/react`, `pixi.js`, `tauri` 이벤트 사용.
- **Performance/Security Considerations**:
  - 이벤트 폭주 시: HUD/문서 전달에 cap, pruning(60초) 유지.
  - 저장은 메모리 기반(영구 저장/로그 외부 전송 없음).
  - rate limit 감지는 단일 정규식 + fast path 문자열 체크로 비용 최소화(사용자 패치).

## Code Context
- **Modified Files**:
  - `src/store/hudStore.ts` (avgToolResponseMs + recordEventsBatch)
  - `src/store/logStore.ts` (addLogsBatch + timeline utils 의존)
  - `src/hooks/useTauriEvents.ts` (BatchUpdate 처리, rate limit 최적화, TOOL_TO_AGENT 매핑)
  - `src/store/agentStore.ts` (documentTransfers 큐/스택 + batch setters)
  - `src/components/office/OfficeCanvas.tsx` (문서 스탬프/스택, RAF/viewport 최적화)
- **New Patterns**:
  - Store에 batch API 추가(`*Batch`)로 set 호출 수 절감.
  - Pixi 렌더는 “항상 60fps” 대신 “필요할 때만 ~30fps” 업데이트.
- **Dependencies**: 추가 없음
- **Configuration Changes**: 없음

## Current Implementation State
- **Completed**:
  - HUD에 `Avg`(tool_call→tool_result 평균 ms) 표시
  - 문서 전달 스택/툴 스탬프 렌더링(`OfficeCanvas`/`FlyingDocument`)
  - 배치 처리용 store API 추가(`agentStore`, `logStore`, `hudStore`)
  - `useTauriEvents`에 `BatchUpdate` 케이스 및 배치 처리 로직 추가(사용자 패치)
  - OfficeCanvas의 일부 렌더 최적화(사용자 패치)
- **In Progress**:
  - `BatchUpdate` 이벤트의 end-to-end 연결 확인(TS/Rust 타입 + backend emit)
  - `useTauriEvents.ts` 중복 함수/구조 정리 및 `OfficeCanvas` effect 의존성/루프 리스크 점검
- **Blocked**:
  - Rust 쪽에서 BatchUpdate emit이 없다면 프론트 변경만으로는 효용이 제한됨(backend 구현 필요)
- **Next Steps**:
  1. `src/types/index.ts`와 `src-tauri/src/models/mod.rs`에 `BatchUpdate` 이벤트 계약을 추가/동기화(필요 시).
  2. Rust watcher가 일정 주기/디바운스로 logs/agents를 묶어 `BatchUpdate`로 emit하도록 구현 또는 기존 emit 경로 확인.
  3. `npm run build` 및 실행 시나리오로 문서 스택/스탬프, BatchUpdate 동작 확인.
  4. `useTauriEvents.ts`의 `isToolActivity` 중복 제거, `OfficeCanvas`의 finalize effect 의존성 조정(필요 시).

## Important Context for Handoff
- **Environment Setup**:
  - 개발: `npm run tauri:dev`(Tauri) 또는 `npm run dev`(브라우저, Tauri API 없음 → useTauriEvents에서 스킵)
- **Running/Testing**:
  - 빌드 검증: `npm run build`
  - Rust 체크: `cd src-tauri && cargo check`
- **Known Issues**:
  - BatchUpdate 이벤트는 프론트에서 처리하나, 백엔드가 emit하지 않으면 실제로는 사용되지 않을 수 있음.
  - `logStore.ts`가 `timelineUtils` 및 `TimelineEvent` 타입을 요구하므로 관련 파일/타입 존재 여부 확인 필요.
- **External Dependencies**:
  - 외부 서비스 없음. 로컬 `~/.claude/debug`, `~/.claude/projects` 워처 기반(Tauri 백엔드).

