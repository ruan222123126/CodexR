# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodexR is a VS Code extension that provides a sidebar chat interface as a GUI wrapper for three AI CLI tools: Codex CLI, Claude Code CLI, and Pi CLI. It enables users to interact with these AI assistants directly from VS Code's sidebar with multi-session management, thinking process visualization, and file attachments.

## Build Commands

```bash
npm run compile        # Compile TypeScript
npm run watch          # Watch mode for development
npm run lint           # Run ESLint
npm run test           # Run tests
npm run check:strict   # Full quality gate (lint + compile + test + security)
vsce package           # Package extension for distribution
```

## Architecture

The extension follows a layered architecture with clear separation between backend (extension host) and frontend (webview):

### Backend (Extension Host)

**Entry Point**: `src/extension.ts` registers the CodexProvider as a WebviewViewProvider.

**Core Provider**: `src/CodexProvider.ts` - Main extension class that orchestrates all components and handles webview communication.

**Provider Modules** (`src/providers/`):
- `session-manager.ts` - Multi-session CRUD operations and lifecycle management
- `executor.ts` - CLI execution with streaming output and error handling
- `provider-builder.ts` - Constructs CLI commands for Codex/Claude/Pi providers
- `attachment-manager.ts` - File selection, validation, and content injection
- `storage.ts` - Persistent storage using VS Code workspace/global state
- `title-generator.ts` - Auto-generates session titles using Codex
- `config.ts` - Settings management

### Frontend (Webview)

**Scripts** (`src/scripts/`):
- `webviewScript.ts` - Main orchestrator combining all frontend scripts
- `webviewScriptParse.ts` - Parses incoming messages from extension
- `webviewScriptRender.ts` - Renders chat messages and thinking process
- `webviewScriptStream.ts` - Handles real-time streaming updates
- `webviewScriptInput.ts` - Input handling and session management UI

**Styles**: `src/styles/webviewStyles.ts` - CSS styling for the webview

### Parsers (`src/parsers/`)

- `codexOutputParser.ts` - Parses Codex CLI output, separates thinking/answer sections
- `claudeOutputParser.ts` - Parses Claude stream-json format
- `piOutputParser.ts` - Parses Pi JSON output

## Key Configuration Settings

```
codexSidebar.defaultProvider     # codex|claude|pi
codexSidebar.parserMode          # v2|legacy
codexSidebar.showToolUsageIndicator
codexSidebar.codexThinkingNoiseFilterEnabled
codexSidebar.codexAutoResumeSession
```

## Communication Flow

1. User input in webview → `postMessage` to extension host
2. CodexProvider receives message → routes to appropriate handler
3. Executor spawns CLI process with streaming output
4. Parser processes CLI output → sends parsed chunks back to webview
5. Webview renders streaming updates in real-time

## Testing

Tests are located in `src/test/`. Run a single test file:
```bash
npx vscode-test --grep "test name pattern"
```
