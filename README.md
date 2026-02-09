# CodexR - VS Code Chat Interface for Codex, Claude & Pi CLI

CodexR is a VS Code extension that provides a sidebar chat interface as a GUI wrapper for Codex CLI, Claude Code CLI, and Pi CLI.

## Features

- **Multi Provider Support**: Switch between Codex, Claude, and Pi directly in the chat input
- **Sidebar Chat Interface**: Access AI directly from VS Code's sidebar
- **Smart Output Parsing**: Automatically separates thinking process from final answer
- **Markdown Rendering**: Beautiful formatted responses with code syntax highlighting
- **Collapsible Thinking**: View AI reasoning in a collapsible details section
- **Workspace Integration**: Automatically uses current workspace as working directory

## Requirements

- Codex provider: `codex` command must be installed and available in PATH
- Claude provider: `claude` command must be installed and available in PATH
- Pi provider: `pi` command must be installed and available in PATH
- VS Code version 1.109.0 or higher

## Usage

1. Install the extension
2. Click the CodexR icon in the activity bar
3. Select provider (`Codex` / `Claude` / `Pi`) in the input bar
4. Type your question in the chat input
5. Press Enter or click Send to get AI assistance

## Settings

- `codexSidebar.defaultProvider`: default provider for new input (`codex`, `claude`, or `pi`, default is `codex`)
- `codexSidebar.parserMode`: streaming parser mode (`v2` or `legacy`, default `v2`)
- `codexSidebar.showToolUsageIndicator`: show `Thinking Process · Tools N` summary indicator with highlight when tool calls are detected (default `true`)
- `codexSidebar.codexThinkingNoiseFilterEnabled`: filter low-value Codex thinking lines like `Planning/Preparing/...` headings before rendering (default `true`)
- `codexSidebar.codexAutoResumeSession`: auto-resume last Codex session for follow-up requests (default `true`)
- `codexSidebar.codexEnforceCheckpointPolicy`: inject a system policy requiring checkpoints before file edits (default `true`)
- `codexSidebar.codexRequireHardCheckpoint`: create a real workspace snapshot before each Codex request; request is blocked on failure (default `true`)
- `codexSidebar.codexHardCheckpointRetention`: number of hard snapshots to keep (default `20`)

## Codex Resume & Checkpoint Behavior

- Codex requests reuse the latest `codex exec` session by default; set `codexSidebar.codexAutoResumeSession` to `false` to disable native resume and use local context fallback only.
- The extension injects a system policy for Codex: before editing/creating files, create a checkpoint first.
- This policy is skipped for read-only tasks and can be disabled via `codexSidebar.codexEnforceCheckpointPolicy`.

## Hard Checkpoint Guarantee

- Before every Codex request, the extension creates a workspace snapshot under extension global storage.
- If snapshot creation fails, the Codex run is stopped immediately to guarantee recoverability.
- Snapshot retention is controlled by `codexSidebar.codexHardCheckpointRetention`.

## Restore Checkpoint

- `CodexR: Restore Latest Checkpoint` and `CodexR: Restore Checkpoint...` are currently placeholders in this build.
- Running either command only shows an informational message that checkpoint restore is temporarily unavailable.

## Claude Stream Notes

- Claude integration runs with `-p --verbose --output-format stream-json`
- `--verbose` is required by Claude CLI when using `stream-json`

## Parser Rollback

- The new segmented parser is enabled by default with `codexSidebar.parserMode = v2`.
- If you hit parsing regressions in production, switch to `codexSidebar.parserMode = legacy` for quick rollback.

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Security / quality gate (local strict checks)
npm run check:strict

# Package extension
npm run vscode:prepublish
vsce package
```

## Local Quality Gate

- Run `npm run check:strict` before opening/merging PRs.
- It executes: lint + compile + extension tests + high severity dependency audit.
- This repository currently uses local strict checks as the CI baseline.

## License

MIT
