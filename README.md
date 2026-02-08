# CodexR - VS Code Chat Interface for Codex & Claude CLI

CodexR is a VS Code extension that provides a sidebar chat interface as a GUI wrapper for Codex CLI and Claude Code CLI.

## Features

- **Dual Provider Support**: Switch between Codex and Claude directly in the chat input
- **Sidebar Chat Interface**: Access AI directly from VS Code's sidebar
- **Smart Output Parsing**: Automatically separates thinking process from final answer
- **Markdown Rendering**: Beautiful formatted responses with code syntax highlighting
- **Collapsible Thinking**: View AI reasoning in a collapsible details section
- **Workspace Integration**: Automatically uses current workspace as working directory

## Requirements

- Codex provider: `codex` command must be installed and available in PATH
- Claude provider: `claude` command must be installed and available in PATH
- VS Code version 1.109.0 or higher

## Usage

1. Install the extension
2. Click the CodexR icon in the activity bar
3. Select provider (`Codex` / `Claude`) in the input bar
4. Type your question in the chat input
5. Press Enter or click Send to get AI assistance

## Settings

- `codexSidebar.defaultProvider`: default provider for new input (`codex` or `claude`, default is `codex`)

## Claude Stream Notes

- Claude integration runs with `-p --verbose --output-format stream-json`
- `--verbose` is required by Claude CLI when using `stream-json`

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Package extension
npm run vscode:prepublish
vsce package
```

## License

MIT
