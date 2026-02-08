export const WEBVIEW_STYLES = `
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        padding: 0; margin: 0;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        display: flex; flex-direction: column; height: 100vh;
                    }
                    #chat-container {
                        flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px;
                        display: flex; flex-direction: column; gap: 15px;
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
                    #input-area {
                        padding: 15px 15px 2px;
                        background: var(--vscode-editor-background);
                        border-top: 1px solid var(--vscode-panel-border);
                        display: flex; justify-content: center; align-items: center;
                    }
                    
                    /* Obsidian 风格输入容器 */
                    .obsidian-input-wrapper {
                        width: 100%;
                        max-width: 600px;
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .obsidian-input-container {
                        position: relative;
                        border-radius: 16px;
                        background: rgba(0, 0, 0, 0.3);
                        backdrop-filter: blur(16px);
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        transition: all 0.5s ease;
                        box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
                    }
                    
                    .obsidian-input-container:hover {
                        background: rgba(0, 0, 0, 0.5);
                    }
                    
                    .obsidian-input-container:focus-within {
                        background: #111;
                        border-color: rgba(255, 255, 255, 0.08);
                    }

                    .obsidian-input-container.drop-active {
                        border-color: rgba(59, 130, 246, 0.7);
                        box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.5), 0 0 24px rgba(59, 130, 246, 0.25);
                    }

                    /* 思考状态下的输入框样式 */
                    .obsidian-input-container.thinking {
                        background: #111;
                        border-color: rgba(128, 128, 128, 0.5);
                        box-shadow: 0 0 40px rgba(0, 0, 0, 0.3);
                    }

                    .obsidian-input-row {
                        display: flex;
                        align-items: flex-end;
                        padding: 7px;
                        gap: 8px;
                    }

                    .attachment-list {
                        display: none;
                        flex-wrap: wrap;
                        gap: 6px;
                        padding: 0 10px 8px;
                    }

                    .attachment-chip {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        max-width: 100%;
                        padding: 4px 8px;
                        border-radius: 999px;
                        border: 1px solid rgba(255, 255, 255, 0.12);
                        background: rgba(255, 255, 255, 0.05);
                        color: rgba(255, 255, 255, 0.75);
                        font-size: 11px;
                    }

                    .attachment-chip-name {
                        max-width: 200px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .attachment-chip-size {
                        color: rgba(255, 255, 255, 0.45);
                    }

                    .attachment-chip-remove {
                        width: 16px;
                        height: 16px;
                        padding: 0;
                        border: none;
                        border-radius: 50%;
                        background: rgba(255, 255, 255, 0.12);
                        color: rgba(255, 255, 255, 0.9);
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        line-height: 1;
                    }

                    .attachment-chip-remove:hover {
                        background: rgba(255, 255, 255, 0.2);
                    }

                    .session-bar {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-bottom: 8px;
                    }

                    .session-select {
                        flex: 1;
                        min-width: 0;
                        height: 32px;
                        border-radius: 10px;
                        border: 1px solid rgba(255, 255, 255, 0.12);
                        background: rgba(20, 20, 20, 0.7);
                        color: rgba(255, 255, 255, 0.9);
                        padding: 0 10px;
                        font-size: 12px;
                        outline: none;
                    }

                    .session-btn {
                        width: 30px;
                        height: 30px;
                        border-radius: 8px;
                        border: 1px solid rgba(255, 255, 255, 0.12);
                        background: rgba(20, 20, 20, 0.72);
                        color: rgba(255, 255, 255, 0.8);
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        padding: 0;
                        line-height: 1;
                        font-size: 14px;
                    }

                    .session-btn:hover {
                        background: rgba(255, 255, 255, 0.12);
                        color: #fff;
                    }

                    .session-btn:disabled,
                    .session-select:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }

                    .provider-select {
                        min-width: 86px;
                        height: 28px;
                        border-radius: 10px;
                        border: 1px solid rgba(255, 255, 255, 0.12);
                        background: rgba(20, 20, 20, 0.7);
                        color: rgba(255, 255, 255, 0.9);
                        padding: 0 10px;
                        font-size: 12px;
                        outline: none;
                    }

                    .provider-select:disabled {
                        opacity: 0.75;
                        cursor: not-allowed;
                    }
                    
                    .obsidian-input-wrapper textarea {
                        flex: 1;
                        background: transparent;
                        color: rgba(255, 255, 255, 0.9);
                        border: none;
                        border-radius: 0;
                        padding: 13px 0 3px;
                        resize: none;
                        height: auto;
                        min-height: 44px;
                        max-height: 200px;
                        font-family: inherit;
                        font-size: 15px;
                        line-height: 1.6;
                        font-weight: 300;
                        outline: none;
                    }

                    /* 思考状态下禁用输入框样式 */
                    .obsidian-input-wrapper textarea:disabled {
                        color: rgba(128, 128, 128, 0.5);
                        cursor: wait;
                    }

                    .obsidian-input-wrapper textarea::placeholder {
                        color: rgba(255, 255, 255, 0.3);
                    }

                    .obsidian-input-wrapper textarea:disabled::placeholder {
                        color: rgba(64, 64, 64, 0.5);
                    }
                    
                    .obsidian-btn {
                        padding: 12px;
                        background: transparent;
                        color: rgba(255, 255, 255, 0.4);
                        border: none;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    
                    .obsidian-btn:hover {
                        color: rgba(255, 255, 255, 0.7);
                        background: rgba(255, 255, 255, 0.05);
                    }

                    /* 思考状态下禁用按钮样式 */
                    .obsidian-btn:disabled {
                        color: rgba(64, 64, 64, 0.5);
                        cursor: not-allowed;
                    }

                    .obsidian-btn svg {
                        width: 20px;
                        height: 20px;
                        stroke-width: 1.5;
                    }
                    

                    
                    .obsidian-send-btn {
                        padding: 10px;
                        margin: 2px;
                        background: rgba(255, 255, 255, 0.9);
                        color: #000;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        transition: all 0.5s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
                        overflow: hidden;
                        position: relative;
                    }
                    
                    .obsidian-send-btn:hover {
                        background: #fff;
                        transform: scale(1.05);
                        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
                    }
                    
                    .obsidian-send-btn:active {
                        transform: scale(0.95);
                    }
                    
                    .obsidian-send-btn svg {
                        width: 18px;
                        height: 18px;
                        stroke-width: 2.5;
                    }

                    /* 思考状态下的停止按钮样式 */
                    .obsidian-send-btn.thinking {
                        background: rgba(128, 128, 128, 0.5);
                        color: rgba(255, 255, 255, 0.4);
                        box-shadow: none;
                    }

                    .obsidian-send-btn.thinking:hover {
                        background: rgba(239, 68, 68, 0.2);
                        color: #fff;
                        border: 1px solid rgba(239, 68, 68, 0.5);
                        transform: none;
                    }

                    .obsidian-send-btn svg.stop-icon {
                        width: 16px;
                        height: 16px;
                        fill: currentColor;
                        stroke-width: 0;
                    }

                    /* 思考状态下的脉冲动画背景 */
                    .obsidian-send-btn-thinking-bg {
                        position: absolute;
                        inset: 0;
                        background: rgba(128, 128, 128, 0.3);
                        animation: pulse 2s ease-in-out infinite;
                    }

                    @keyframes pulse {
                        0%, 100% { opacity: 0.3; }
                        50% { opacity: 0.6; }
                    }

                    /* 底部进度条装饰 */
                    .obsidian-progress-bar {
                        position: absolute;
                        bottom: 0;
                        left: 16px;
                        right: 16px;
                        height: 1px;
                        background: linear-gradient(to right, transparent, rgba(128, 128, 128, 0.5), transparent);
                        opacity: 0;
                        animation: pulse 1.5s ease-in-out infinite;
                    }

                    .obsidian-input-container.thinking .obsidian-progress-bar {
                        opacity: 0.5;
                    }

                    /* 状态指示器 */
                    .obsidian-status-bar {
                        order: 1;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 12px;
                        padding: 0 16px;
                        margin-top: 6px;
                        margin-bottom: 0;
                        overflow: visible;
                    }

                    .obsidian-status-text {
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.1em;
                        font-weight: 500;
                        color: rgba(64, 64, 64, 0.5);
                        transition: all 0.5s ease;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }

                    .obsidian-input-container:focus-within ~ .obsidian-status-bar .obsidian-status-text {
                        color: rgba(128, 128, 128, 0.8);
                    }

                    .obsidian-input-container.thinking ~ .obsidian-status-bar .obsidian-status-text {
                        color: rgba(128, 128, 128, 0.5);
                    }

                    .status-dot {
                        width: 6px;
                        height: 6px;
                        border-radius: 50%;
                        background-color: rgba(128, 128, 128, 0.5);
                    }

                    .obsidian-input-container.thinking ~ .obsidian-status-bar .status-dot {
                        background-color: rgba(128, 128, 128, 0.6);
                        animation: pulse 1s ease-in-out infinite;
                    }

                    .obsidian-hint-text {
                        order: 2;
                        font-size: 10px;
                        color: rgba(64, 64, 64, 0.5);
                        min-height: 14px;
                        padding: 2px 16px 0;
                        text-align: right;
                    }
                </style>
`;
