/**
 * 聊天区域样式 - 消息气泡、思维区域等
 */
export const CHAT_STYLES = `
#chat-container {
    flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px;
    display: flex; flex-direction: column; gap: 15px;
}

body.history-mode #chat-container,
body.history-mode #input-area {
    display: none;
}

.message {
    max-width: 90%;
    min-width: 0;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    line-height: 1.6;
    word-wrap: break-word;
}
.message.user {
    align-self: flex-end;
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}
.message.bot {
    align-self: flex-start;
    background-color: var(--vscode-editor-inactiveSelectionBackground);
    color: var(--vscode-editor-foreground);
    padding: 0; /* Bot 消息由内部元素填充 */
    background-color: transparent; /* 透明背景，依靠内部块着色 */
}

/* 🧠 思考过程折叠块样式 */
details.thinking-block {
    background-color: var(--vscode-textBlockQuote-background);
    border: 1px solid var(--vscode-textBlockQuote-border);
    border-radius: 6px;
    margin-bottom: 10px;
    min-width: 0;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
}
details.thinking-block summary {
    padding: 8px 12px;
    cursor: pointer;
    font-weight: 600;
    user-select: none;
    outline: none;
    list-style: none; /* 隐藏默认三角，下面自定义 */
}
details.thinking-block.has-tools {
    border-color: var(--vscode-charts-blue, var(--vscode-focusBorder));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vscode-charts-blue, var(--vscode-focusBorder)) 25%, transparent);
}
details.thinking-block.has-tools summary {
    color: var(--vscode-charts-blue, var(--vscode-editor-foreground));
}
details.thinking-block summary::-webkit-details-marker { display: none; }
details.thinking-block summary::before {
    content: '▶ ';
    font-size: 10px;
    display: inline-block;
    margin-right: 5px;
    transition: transform 0.2s;
}
details[open].thinking-block summary::before {
    transform: rotate(90deg);
}
.thinking-content {
    padding: 10px 12px;
    border-top: 1px solid var(--vscode-textBlockQuote-border);
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    max-height: 260px;
    overflow-x: hidden;
    overflow-y: auto;
}
.thinking-text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: 12px;
    line-height: 1.5;
    opacity: 0.9;
}
.op-card {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 8px;
    background: var(--vscode-editorHoverWidget-background, rgba(128, 128, 128, 0.12));
    padding: 8px 10px;
    min-width: 0;
}
.op-card + .op-card {
    margin-top: 2px;
}
.op-card-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
}
.op-head-right {
    display: flex;
    align-items: center;
    gap: 8px;
}
.op-badge {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2px;
    color: var(--vscode-descriptionForeground);
}
.op-status {
    font-size: 11px;
    font-weight: 600;
}
.op-status.success {
    color: var(--vscode-testing-iconPassed, #4caf50);
}
.op-status.failed {
    color: var(--vscode-errorForeground, #f14c4c);
}
.op-time {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
}
.op-command {
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: 12px;
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    background: var(--vscode-editor-inactiveSelectionBackground);
    border-radius: 4px;
    padding: 6px 8px;
}
.op-output {
    margin-top: 6px;
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: 12px;
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    background: rgba(0, 0, 0, 0.18);
    border-radius: 4px;
    padding: 6px 8px;
    border: 1px solid var(--vscode-panel-border);
}
.op-meta {
    margin-top: 6px;
    font-size: 11px;
    overflow-wrap: anywhere;
    color: var(--vscode-descriptionForeground);
}
.op-files {
    margin: 8px 0 0;
    padding-left: 16px;
    font-size: 12px;
}
.op-files li {
    margin: 2px 0;
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
}

/* 💬 最终回复样式 */
.answer-block {
    background-color: var(--vscode-editor-inactiveSelectionBackground);
    padding: 12px 16px;
    border-radius: 8px;
}
.answer-block p { margin: 0 0 10px 0; }
.answer-block p:last-child { margin-bottom: 0; }
.answer-block pre {
    background: rgba(0,0,0,0.3);
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
}
.stream-placeholder {
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
}
.stream-caret {
    display: inline-block;
    margin-left: 2px;
    animation: blink-caret 1s steps(1, end) infinite;
}
@keyframes blink-caret {
    50% { opacity: 0; }
}

.system-msg {
    text-align: center; font-size: 12px; opacity: 0.6; margin: 5px 0;
}
`;
