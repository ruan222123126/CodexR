# CodexR - VS Code Chat Interface for Codex CLI

CodexR is a VS Code extension that provides a sidebar chat interface as a GUI wrapper for the Codex CLI.

## Features

- **Sidebar Chat Interface**: Access Codex AI directly from VS Code's sidebar
- **Smart Output Parsing**: Automatically separates thinking process from final answer
- **Markdown Rendering**: Beautiful formatted responses with code syntax highlighting
- **Collapsible Thinking**: View AI reasoning in a collapsible details section
- **Workspace Integration**: Automatically uses current workspace as working directory

## Requirements

- [Codex CLI](https://github.com/RuanEason/CodexR) must be installed and available in your system PATH
- VS Code version 1.109.0 or higher

## Usage

1. Install the extension
2. Click the CodexR icon in the activity bar
3. Type your question in the chat input
4. Press Enter or click Send to get AI assistance

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
