/**
 * 聊天区域样式 - 消息气泡、思维区域等
 */
export const CHAT_STYLES = `
#chat-container {
    flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px;
    display: flex; flex-direction: column; gap: 15px;
}

body.history-mode #chat-container,
body.history-mode #input-area,
body.settings-mode #chat-container,
body.settings-mode #input-area {
    display: none !important;
    position: static !important;
    flex: 0 !important;
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

/* 用户消息包装器 - 复制按钮在消息外部 */
.user-message-wrapper {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    align-self: flex-end;
}
.user-message-wrapper .user-actions {
    opacity: 0;
    transition: opacity 0.15s;
    margin-top: 0;
}
.user-message-wrapper:hover .user-actions {
    opacity: 1;
}
.user-message-wrapper .copy-btn {
    border: none;
    background: transparent;
}

.message.bot {
    align-self: flex-start;
    background-color: var(--vscode-editor-inactiveSelectionBackground);
    color: var(--vscode-editor-foreground);
    padding: 0; /* Bot 消息由内部元素填充 */
    background-color: transparent; /* 透明背景，依靠内部块着色 */
}

/* 🧠 思考过程折叠块样式 - 简洁版 */
details.thinking-block {
    background: transparent;
    border: none;
    margin-bottom: 8px;
    min-width: 0;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
}
details.thinking-block summary {
    padding: 4px 0;
    cursor: pointer;
    font-weight: 500;
    user-select: none;
    outline: none;
    list-style: none;
    opacity: 0.7;
    transition: opacity 0.15s;
}
details.thinking-block summary:hover {
    opacity: 1;
}
details.thinking-block.has-tools summary {
    opacity: 0.85;
}
details.thinking-block summary::-webkit-details-marker { display: none; }
details.thinking-block summary::before {
    content: '▸';
    font-size: 11px;
    display: inline-block;
    margin-right: 4px;
    transition: transform 0.15s;
}
details[open].thinking-block summary::before {
    transform: rotate(90deg);
}
.thinking-tool-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    margin-left: 4px;
    font-size: 10px;
    font-weight: 600;
    border-radius: 8px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
}
.thinking-content {
    padding: 6px 0 6px 12px;
    border-left: 2px solid var(--vscode-textBlockQuote-border);
    margin-left: 4px;
    display: block;
    min-width: 0;
    max-height: 200px;
    overflow-x: hidden;
    overflow-y: auto;
}
.thinking-content > * + * {
    margin-top: 6px;
}
.thinking-text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: 11px;
    line-height: 1.4;
    opacity: 0.8;
}
.thinking-text + .thinking-text {
    border-top: 1px dashed var(--vscode-textBlockQuote-border);
    padding-top: 6px;
    margin-top: 2px;
}
.ai-text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: 11px;
    line-height: 1.4;
    background: var(--vscode-textBlockQuote-background);
    border-left: 2px solid var(--vscode-textLink-foreground);
    padding: 4px 8px;
    border-radius: 2px;
}
.ai-text + .ai-text {
    margin-top: 4px;
}
.ai-label {
    font-weight: 600;
    color: var(--vscode-textLink-foreground);
    margin-right: 4px;
}
.thinking-separator {
    height: 1px;
    background: linear-gradient(to right, var(--vscode-textBlockQuote-border), transparent);
    margin: 4px 0;
    opacity: 0.6;
}
/* 简化的操作卡片样式 */
.op-card {
    background: var(--vscode-textBlockQuote-background);
    border-radius: 4px;
    padding: 6px 8px;
    min-width: 0;
    font-size: 11px;
}
.op-card + .op-card {
    margin-top: 4px;
}
.op-card-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
}
.op-head-right {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
}
.op-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    opacity: 0.7;
}
.op-status {
    font-size: 10px;
    font-weight: 500;
}
.op-status.success {
    color: var(--vscode-testing-iconPassed, #4caf50);
}
.op-status.failed {
    color: var(--vscode-errorForeground, #f14c4c);
}
.op-time {
    font-size: 10px;
    opacity: 0.6;
}
.op-command {
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: 11px;
    line-height: 1.35;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
    padding: 4px 6px;
}
.op-output {
    margin-top: 4px;
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: 10px;
    line-height: 1.35;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 3px;
    padding: 4px 6px;
    max-height: 80px;
    overflow-y: auto;
    opacity: 0.85;
}
.op-meta {
    margin-top: 4px;
    font-size: 10px;
    overflow-wrap: anywhere;
    opacity: 0.6;
}
.op-files {
    margin: 4px 0 0;
    padding-left: 12px;
    font-size: 10px;
}
.op-files li {
    margin: 1px 0;
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    opacity: 0.8;
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

/* 📋 消息复制按钮 */
.message-actions {
    display: flex;
    justify-content: flex-start;
    margin-top: 6px;
    opacity: 0;
    transition: opacity 0.15s;
}
.message:hover .message-actions,
.message-actions:focus-within {
    opacity: 1;
}
.copy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 6px;
    font-size: 14px;
    color: var(--vscode-descriptionForeground);
    background: transparent;
    border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.3));
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
    min-width: 28px;
}
.copy-btn:hover {
    background: var(--vscode-toolbar-hoverBackground);
    color: var(--vscode-foreground);
}
.copy-btn.copied {
    color: var(--vscode-testing-iconPassed, #4caf50);
    border-color: var(--vscode-testing-iconPassed, #4caf50);
}
`;
