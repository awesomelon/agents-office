# Contributing Guide

## Prerequisites

- Node.js >= 18
- Rust (for Tauri backend)
- pnpm/npm/yarn

## Development Setup

```bash
# Clone the repository
git clone https://github.com/awesomelon/agents-office.git
cd agents-office

# Install dependencies
npm install

# Start development server (Tauri + Frontend)
npm run tauri:dev

# Or start frontend only (browser preview)
npm run dev
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start frontend dev server only (browser preview) |
| `build` | `tsc && vite build` | Build frontend (TypeScript compile + Vite bundle) |
| `preview` | `vite preview` | Preview production build locally |
| `tauri` | `tauri` | Run Tauri CLI commands |
| `tauri:dev` | `tauri dev` | Start full Tauri app in dev mode (frontend + Rust backend) |
| `tauri:build` | `tauri build` | Build production Tauri application |
| `zip` | `ditto ...` | Create macOS distribution zip file |

## Project Structure

```
agents-office/
├── src/                    # Frontend React + PixiJS
│   ├── components/         # UI components
│   │   └── office/         # Office canvas components
│   ├── hooks/              # React hooks
│   ├── store/              # Zustand stores
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
├── src-tauri/              # Rust backend
│   └── src/
│       ├── lib.rs          # Tauri app entry
│       ├── models/         # Data models
│       └── watcher/        # File watcher logic
├── cli/                    # CLI entry point
└── docs/                   # Documentation
```

## Development Workflow

1. **Branch from main**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes**
   - Frontend: `src/` directory
   - Backend: `src-tauri/src/` directory

3. **Test locally**
   ```bash
   npm run tauri:dev
   ```

4. **Type check**
   ```bash
   # Frontend
   npm run build

   # Backend
   cd src-tauri && cargo check
   ```

5. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature
   ```

## Type Synchronization

When modifying types, update both locations:
- TypeScript: `src/types/index.ts`
- Rust: `src-tauri/src/models/mod.rs`

Key types to keep in sync:
- `AgentType`: explorer, analyzer, architect, developer, operator, validator, connector, liaison
- `AgentStatus`: idle, working, thinking, passing, error
- `LogEntryType`: tool_call, tool_result, message, error, todo_update, session_start, session_end

## Testing

```bash
# Rust tests
cd src-tauri && cargo test
```

## Code Style

- TypeScript: Follow existing patterns, use strict typing
- Rust: Follow Rust conventions, use `cargo fmt`
- Commits: Use conventional commits (feat, fix, refactor, docs, etc.)
