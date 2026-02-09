# CodexR - Codex、Claude 和 Pi CLI 的 VS Code 聊天界面

CodexR 是一个 VS Code 扩展，提供侧边栏聊天界面，作为 Codex CLI、Claude Code CLI 和 Pi CLI 的 GUI 封装。

## 功能特性

- **多提供者支持**：在聊天输入框中直接切换 Codex、Claude 和 Pi
- **侧边栏聊天界面**：直接从 VS Code 侧边栏访问 AI
- **智能输出解析**：自动分离思考过程和最终答案
- **Markdown 渲染**：精美格式化的响应，支持代码语法高亮
- **可折叠思考过程**：在可折叠的详情区域查看 AI 推理过程
- **工作区集成**：自动使用当前工作区作为工作目录

## 环境要求

- Codex 提供者：`codex` 命令必须已安装并在 PATH 中可用
- Claude 提供者：`claude` 命令必须已安装并在 PATH 中可用
- Pi 提供者：`pi` 命令必须已安装并在 PATH 中可用
- VS Code 版本 1.109.0 或更高

## 使用方法

1. 安装扩展
2. 点击活动栏中的 CodexR 图标
3. 在输入栏中选择提供者（`Codex` / `Claude` / `Pi`）
4. 在聊天输入框中输入问题
5. 按 Enter 或点击发送获取 AI 帮助

## 设置选项

- `codexSidebar.defaultProvider`：新输入的默认提供者（`codex`、`claude` 或 `pi`，默认 `codex`）
- `codexSidebar.parserMode`：流式解析器模式（`v2` 或 `legacy`，默认 `v2`）
- `codexSidebar.showToolUsageIndicator`：检测到工具调用时显示 `Thinking Process · Tools N` 摘要指示器并高亮（默认 `true`）
- `codexSidebar.codexThinkingNoiseFilterEnabled`：渲染前过滤低价值的 Codex 思考行，如 `Planning/Preparing/...` 标题（默认 `true`）
- `codexSidebar.codexAutoResumeSession`：自动恢复上一个 Codex 会话以进行后续请求（默认 `true`）
- `codexSidebar.codexEnforceCheckpointPolicy`：注入系统策略，要求在文件编辑前创建检查点（默认 `true`）
- `codexSidebar.codexRequireHardCheckpoint`：在每个 Codex 请求前创建真实的工作区快照；失败时阻止请求（默认 `true`）
- `codexSidebar.codexHardCheckpointRetention`：保留的硬快照数量（默认 `20`）

## Codex 恢复和检查点行为

- Codex 请求默认重用最新的 `codex exec` 会话；将 `codexSidebar.codexAutoResumeSession` 设为 `false` 可禁用原生恢复，仅使用本地上下文回退。
- 扩展为 Codex 注入系统策略：在编辑/创建文件前，先创建检查点。
- 对于只读任务会跳过此策略，也可通过 `codexSidebar.codexEnforceCheckpointPolicy` 禁用。

## 硬检查点保证

- 在每个 Codex 请求前，扩展会在扩展全局存储下创建工作区快照。
- 如果快照创建失败，Codex 运行会立即停止以保证可恢复性。
- 快照保留数量由 `codexSidebar.codexHardCheckpointRetention` 控制。

## 恢复检查点

- `CodexR: Restore Latest Checkpoint` 和 `CodexR: Restore Checkpoint...` 在当前版本中是占位符。
- 运行任一命令只会显示检查点恢复暂时不可用的信息提示。

## Claude 流式说明

- Claude 集成使用 `-p --verbose --output-format stream-json` 运行
- 使用 `stream-json` 时 Claude CLI 需要 `--verbose` 参数

## 解析器回退

- 新的分段解析器默认启用，`codexSidebar.parserMode = v2`。
- 如果在生产环境中遇到解析问题，切换到 `codexSidebar.parserMode = legacy` 可快速回退。

## 开发

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run compile

# 监听变更
npm run watch

# 安全/质量检查（本地严格检查）
npm run check:strict

# 打包扩展
npm run vscode:prepublish
vsce package
```

## 本地质量检查

- 在提交/合并 PR 前运行 `npm run check:strict`。
- 它执行：lint + compile + 扩展测试 + 高危依赖审计。
- 此仓库目前使用本地严格检查作为 CI 基线。

## 许可证

MIT
