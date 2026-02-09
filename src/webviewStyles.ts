export const WEBVIEW_STYLES = `
                <style>
                    html {
                        width: 100%;
                        max-width: 100%;
                        overflow-x: hidden;
                    }

                    *,
                    *::before,
                    *::after {
                        box-sizing: border-box;
                    }

                    body {
                        width: 100%;
                        max-width: 100%;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        padding: 0; margin: 0;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        display: flex; flex-direction: column; height: 100vh;
                        overflow: hidden;
                    }

                    /* 顶部工具栏 */
                    .top-toolbar {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        width: 100%;
                        height: 36px;
                        padding: 0 12px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        background: var(--vscode-editor-background);
                        flex-shrink: 0;
                    }

                    .toolbar-title {
                        font-size: 12px;
                        font-weight: 500;
                        letter-spacing: 0.2em;
                        color: rgba(161, 161, 170, 0.9);
                        text-transform: uppercase;
                        cursor: pointer;
                        user-select: none;
                        transition: color 0.3s ease;
                    }

                    .toolbar-title:hover {
                        color: rgba(228, 228, 231, 0.95);
                    }

                    .toolbar-add-btn {
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        border: none;
                        background: transparent;
                        color: rgba(113, 113, 122, 0.9);
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 0;
                        margin-left: 0;
                        transition: all 0.2s ease;
                    }

                    .toolbar-add-btn:hover {
                        background: rgba(255, 255, 255, 0.05);
                        color: rgba(228, 228, 231, 0.95);
                    }

                    .toolbar-add-btn:active {
                        transform: scale(0.9);
                    }

                    .toolbar-add-btn svg {
                        width: 14px;
                        height: 14px;
                        stroke-width: 2;
                    }

                    body.history-mode #top-toolbar {
                        display: none;
                    }
                    #chat-container {
                        flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px;
                        display: flex; flex-direction: column; gap: 15px;
                    }

                    body.history-mode #chat-container,
                    body.history-mode #input-area {
                        display: none;
                    }

                    .history-page {
                        display: none;
                        flex: 1;
                        min-height: 0;
                        padding: 14px 14px 10px;
                        box-sizing: border-box;
                        background: #030303;
                        overflow: hidden;
                        color: #f0f0f0;
                        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    }

                    body.history-mode .history-page {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }

                    .history-page-topbar {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        padding: 2px 2px 10px;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
                    }

                    .history-page-topbar-left {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        min-width: 0;
                    }

                    .history-back-btn {
                        width: 24px;
                        height: 24px;
                        border: none;
                        border-radius: 999px;
                        background: transparent;
                        color: rgba(255, 255, 255, 0.36);
                        cursor: pointer;
                        padding: 0;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        transition: background-color 0.2s ease, color 0.2s ease;
                    }

                    .history-back-btn svg {
                        width: 14px;
                        height: 14px;
                    }

                    .history-back-btn:hover {
                        background: rgba(255, 255, 255, 0.06);
                        color: rgba(255, 255, 255, 0.92);
                    }

                    .history-page-heading {
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                        min-width: 0;
                    }

                    .history-page-kicker {
                        font-size: 9px;
                        letter-spacing: 0.2em;
                        text-transform: uppercase;
                        color: rgba(255, 255, 255, 0.25);
                        white-space: nowrap;
                    }

                    .history-page-title {
                        font-size: 12px;
                        line-height: 1.2;
                        font-weight: 600;
                        letter-spacing: 0.08em;
                        text-transform: uppercase;
                        color: rgba(255, 255, 255, 0.58);
                        white-space: nowrap;
                    }

                    .history-page-actions {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }

                    .history-icon-btn {
                        width: 24px;
                        height: 24px;
                        border-radius: 8px;
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        background: transparent;
                        color: rgba(255, 255, 255, 0.22);
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        cursor: not-allowed;
                        padding: 0;
                        transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
                    }

                    .history-icon-btn svg {
                        width: 13px;
                        height: 13px;
                    }

                    .history-icon-btn:not(:disabled):hover {
                        color: rgba(255, 255, 255, 0.75);
                        border-color: rgba(255, 255, 255, 0.2);
                        background: rgba(255, 255, 255, 0.06);
                        cursor: pointer;
                    }

                    .history-icon-btn:disabled {
                        opacity: 1;
                    }

                    .history-search-wrap {
                        position: relative;
                        display: flex;
                        align-items: center;
                        padding: 8px 4px 2px;
                    }

                    .history-search-icon {
                        position: absolute;
                        left: 6px;
                        top: 50%;
                        transform: translateY(-50%);
                        color: rgba(255, 255, 255, 0.4);
                        pointer-events: none;
                        transition: color 0.2s ease;
                    }

                    .history-search-icon svg {
                        width: 13px;
                        height: 13px;
                    }

                    .history-search-input {
                        width: 100%;
                        height: 32px;
                        border: none;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.09);
                        background: transparent;
                        color: rgba(255, 255, 255, 0.74);
                        padding: 0 6px 0 24px;
                        font-size: 10px;
                        font-weight: 600;
                        letter-spacing: 0.2em;
                        text-transform: uppercase;
                        outline: none;
                        transition: border-color 0.2s ease, color 0.2s ease;
                    }

                    .history-search-input::placeholder {
                        color: rgba(255, 255, 255, 0.35);
                        opacity: 1;
                    }

                    .history-search-input:focus {
                        border-bottom-color: rgba(255, 255, 255, 0.24);
                        color: rgba(255, 255, 255, 0.92);
                    }

                    .history-search-wrap:focus-within .history-search-icon {
                        color: rgba(255, 255, 255, 0.34);
                    }

                    .history-filter-row {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        padding: 0 4px 4px;
                    }

                    .history-filter-chip {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        color: rgba(255, 255, 255, 0.55);
                        font-size: 9px;
                        font-weight: 700;
                        letter-spacing: 0.2em;
                        text-transform: uppercase;
                        min-width: 0;
                        transition: color 0.2s ease;
                    }

                    .history-filter-chip-icon {
                        font-size: 10px;
                        line-height: 1;
                    }

                    .history-filter-select {
                        min-width: 0;
                        border: none;
                        background: transparent;
                        color: currentColor;
                        font-size: inherit;
                        font-weight: inherit;
                        letter-spacing: inherit;
                        text-transform: inherit;
                        outline: none;
                        padding: 0;
                        cursor: pointer;
                        max-width: 180px;
                    }

                    .history-filter-select option {
                        color: #cfcfcf;
                        background: #0b0b0b;
                    }

                    .history-filter-btn {
                        border: none;
                        background: transparent;
                        color: currentColor;
                        font-size: inherit;
                        font-weight: inherit;
                        letter-spacing: inherit;
                        text-transform: inherit;
                        outline: none;
                        padding: 0;
                        cursor: pointer;
                    }

                    .history-filter-chip:focus-within,
                    .history-filter-chip:hover {
                        color: rgba(255, 255, 255, 0.8);
                    }

                    .history-list {
                        flex: 1;
                        min-height: 0;
                        overflow-y: auto;
                        overflow-x: hidden;
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                        padding: 0 0 2px;
                        scrollbar-width: thin;
                        scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
                    }

                    .history-list::-webkit-scrollbar {
                        width: 2px;
                    }

                    .history-list::-webkit-scrollbar-track {
                        background: transparent;
                    }

                    .history-list::-webkit-scrollbar-thumb {
                        background: rgba(255, 255, 255, 0.14);
                    }

                    .history-item {
                        position: relative;
                        border: 1px solid transparent;
                        border-radius: 18px;
                        background: transparent;
                        padding: 14px 16px;
                        cursor: pointer;
                        transition: background-color 0.35s ease, border-color 0.35s ease, transform 0.35s ease;
                    }

                    .history-item:hover {
                        background: rgba(255, 255, 255, 0.02);
                    }

                    .history-item.active {
                        background: rgba(255, 255, 255, 0.03);
                        border-color: rgba(255, 255, 255, 0.05);
                    }

                    .history-item-title-row {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        margin-bottom: 8px;
                    }

                    .history-item-title {
                        flex: 1;
                        min-width: 0;
                        font-size: 15px;
                        font-weight: 400;
                        letter-spacing: -0.03em;
                        line-height: 1.2;
                        color: rgba(255, 255, 255, 0.65);
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        transition: color 0.25s ease;
                    }

                    .history-item.active .history-item-title {
                        color: rgba(255, 255, 255, 0.97);
                    }

                    .history-item-meta {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        min-height: 16px;
                    }

                    .history-item-model {
                        font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
                        font-size: 9px;
                        line-height: 1;
                        color: rgba(255, 255, 255, 0.7);
                        border: 1px solid rgba(255, 255, 255, 0.15);
                        border-radius: 4px;
                        padding: 2px 5px;
                        text-transform: uppercase;
                    }

                    .history-item-count {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        font-size: 9px;
                        font-weight: 700;
                        letter-spacing: 0.18em;
                        text-transform: uppercase;
                        color: rgba(255, 255, 255, 0.65);
                    }

                    .history-item-count svg {
                        width: 10px;
                        height: 10px;
                    }

                    .history-item-preview {
                        margin-top: 9px;
                        font-size: 12px;
                        line-height: 1.5;
                        font-style: normal;
                        font-weight: 400;
                        color: rgba(255, 255, 255, 0.55);
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        transition: color 0.2s ease;
                    }

                    .history-item:hover .history-item-preview {
                        color: rgba(255, 255, 255, 0.75);
                    }

                    .history-item-time {
                        margin-top: 8px;
                        font-size: 8px;
                        font-weight: 700;
                        letter-spacing: 0.2em;
                        text-transform: uppercase;
                        color: rgba(255, 255, 255, 0.5);
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                    }

                    .history-item-time svg {
                        width: 9px;
                        height: 9px;
                    }

                    .history-item-actions {
                        position: absolute;
                        right: 14px;
                        bottom: 12px;
                        display: none;
                        align-items: center;
                        gap: 5px;
                        z-index: 2;
                    }

                    .history-item:hover .history-item-actions,
                    .history-item:focus-within .history-item-actions {
                        display: inline-flex;
                    }

                    .history-item-action-btn {
                        width: 22px;
                        height: 22px;
                        border-radius: 7px;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        background: rgba(8, 8, 8, 0.95);
                        color: rgba(255, 255, 255, 0.68);
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        padding: 0;
                        font-size: 12px;
                        line-height: 1;
                        transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
                    }

                    .history-item-action-btn:hover {
                        border-color: rgba(255, 255, 255, 0.3);
                        color: rgba(255, 255, 255, 0.95);
                        background: rgba(24, 24, 24, 0.98);
                    }

                    .history-item-action-btn:focus-visible {
                        outline: 1px solid rgba(255, 255, 255, 0.48);
                        outline-offset: 1px;
                    }

                    .history-item-action-btn:disabled {
                        opacity: 0.45;
                        cursor: not-allowed;
                    }

                    .history-item-indicator {
                        position: absolute;
                        right: 13px;
                        top: 50%;
                        transform: translateY(-50%);
                        width: 6px;
                        height: 6px;
                        border-radius: 50%;
                        background: rgba(255, 255, 255, 0.95);
                        animation: history-pulse-glow 3s infinite ease-in-out;
                    }

                    @keyframes history-pulse-glow {
                        0% {
                            transform: translateY(-50%) scale(1);
                            opacity: 0.8;
                            box-shadow: 0 0 0 rgba(255, 255, 255, 0);
                        }
                        50% {
                            transform: translateY(-50%) scale(1.35);
                            opacity: 1;
                            box-shadow: 0 0 8px rgba(255, 255, 255, 0.45);
                        }
                        100% {
                            transform: translateY(-50%) scale(1);
                            opacity: 0.8;
                            box-shadow: 0 0 0 rgba(255, 255, 255, 0);
                        }
                    }

                    .history-empty {
                        border: 1px dashed rgba(255, 255, 255, 0.12);
                        border-radius: 12px;
                        padding: 22px 12px;
                        color: rgba(255, 255, 255, 0.45);
                        text-align: center;
                        font-size: 12px;
                        background: rgba(255, 255, 255, 0.01);
                    }

                    .history-page-footer {
                        height: 18px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }

                    .history-page-footer-line {
                        width: 78px;
                        height: 1px;
                        background: rgba(255, 255, 255, 0.08);
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
                        justify-content: center;
                        gap: 8px;
                        margin-bottom: 8px;
                    }

                    .session-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        height: 38px;
                        padding: 0 12px;
                        margin-bottom: 8px;
                        border-radius: 10px;
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        background: linear-gradient(180deg, rgba(20, 20, 20, 0.95), rgba(12, 12, 12, 0.92));
                    }

                    /* 会话模式下隐藏 Recent Tasks 标题和 View all 按钮 */
                    body:not(.home-mode) .session-header {
                        display: none;
                    }

                    .session-header-title {
                        font-size: 13px;
                        font-weight: 600;
                        color: rgba(255, 255, 255, 0.9);
                        letter-spacing: 0.2px;
                    }

                    .session-view-all-btn {
                        border: none;
                        background: transparent;
                        color: rgba(255, 255, 255, 0.62);
                        font-size: 12px;
                        cursor: pointer;
                        padding: 0;
                        line-height: 1;
                        transition: color 0.2s ease;
                    }

                    .session-view-all-btn:hover {
                        color: rgba(255, 255, 255, 0.9);
                    }

                    .session-view-all-btn:disabled {
                        color: rgba(255, 255, 255, 0.35);
                        cursor: not-allowed;
                    }

                    .session-select {
                        flex: 0 1 300px;
                        min-width: 180px;
                        height: 32px;
                        border-radius: 10px;
                        border: 1px solid rgba(255, 255, 255, 0.12);
                        background: rgba(20, 20, 20, 0.7);
                        color: rgba(255, 255, 255, 0.9);
                        padding: 0 10px;
                        font-size: 12px;
                        outline: none;
                        text-align: center;
                        text-align-last: center;
                    }

                    .session-select-hidden {
                        display: none;
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

                    .provider-select-wrap {
                        position: relative;
                        width: 100%;
                        max-width: 90px;
                        margin-left: auto;
                    }

                    .provider-select-native {
                        position: absolute;
                        width: 0;
                        height: 0;
                        opacity: 0;
                        pointer-events: none;
                    }

                    .provider-select-trigger {
                        position: relative;
                        width: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 10px;
                        background: rgba(12, 12, 12, 0.92);
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        border-radius: 14px;
                        color: rgba(235, 235, 235, 0.95);
                        padding: 8px 12px;
                        font-size: 13px;
                        line-height: 1.2;
                        cursor: pointer;
                        transition: all 0.25s ease;
                    }

                    .provider-select-trigger:hover {
                        background: rgba(18, 18, 18, 0.98);
                        border-color: rgba(255, 255, 255, 0.18);
                    }

                    .provider-select-trigger:focus-visible {
                        outline: none;
                        border-color: rgba(200, 200, 200, 0.4);
                        box-shadow: 0 0 0 2px rgba(180, 180, 180, 0.15);
                    }

                    .provider-select-label {
                        font-size: 13px;
                        color: rgba(235, 235, 235, 0.95);
                        letter-spacing: 0.01em;
                    }

                    .provider-select-chevron {
                        width: 14px;
                        height: 14px;
                        color: rgba(150, 150, 150, 0.85);
                        transition: transform 0.25s ease, color 0.25s ease;
                        flex-shrink: 0;
                    }

                    .provider-select-wrap.open .provider-select-chevron {
                        transform: rotate(180deg);
                        color: rgba(230, 230, 230, 0.95);
                    }

                    .provider-select-menu {
                        position: absolute;
                        z-index: 50;
                        top: 100%;
                        left: 0;
                        right: 0;
                        margin-top: 8px;
                        background: rgba(10, 10, 10, 0.98);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 14px;
                        box-shadow: 0 18px 36px rgba(0, 0, 0, 0.55);
                        padding: 6px;
                        max-height: min(220px, calc(100vh - 32px));
                        overflow-y: auto;
                        opacity: 0;
                        visibility: hidden;
                        pointer-events: none;
                        transition: opacity 0.2s ease;
                    }

                    .provider-select-wrap.open-up .provider-select-menu {
                        top: auto;
                        bottom: calc(100% + 8px);
                        margin-top: 0;
                    }

                    .provider-select-wrap.open .provider-select-menu {
                        opacity: 1;
                        visibility: visible;
                        pointer-events: auto;
                    }

                    .provider-select-option {
                        width: 100%;
                        border: none;
                        background: transparent;
                        color: rgba(176, 176, 176, 0.9);
                        border-radius: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 10px;
                        padding: 8px 10px;
                        cursor: pointer;
                        transition: all 0.18s ease;
                        text-align: left;
                    }

                    .provider-select-option:hover {
                        background: rgba(255, 255, 255, 0.06);
                        color: rgba(220, 220, 220, 0.95);
                    }

                    .provider-select-option[data-selected="true"] {
                        background: rgba(255, 255, 255, 0.09);
                        color: rgba(245, 245, 245, 0.96);
                    }

                    .provider-select-option-text {
                        min-width: 0;
                        display: flex;
                        align-items: center;
                    }

                    .provider-select-option-main {
                        font-size: 13px;
                        line-height: 1.25;
                        font-weight: 500;
                        color: inherit;
                    }

                    .provider-select-option-check {
                        font-size: 13px;
                        color: rgba(230, 230, 230, 0.95);
                        opacity: 0;
                        transition: opacity 0.15s ease;
                        flex-shrink: 0;
                    }

                    .provider-select-option[data-selected="true"] .provider-select-option-check {
                        opacity: 1;
                    }

                    .provider-select-wrap.is-disabled .provider-select-trigger {
                        opacity: 0.68;
                        cursor: not-allowed;
                    }

                    .provider-select-wrap.is-disabled .provider-select-menu {
                        display: none;
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
                        margin-left: 4px;
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
                        padding: 0 0 0 16px;
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

                    /* 多选功能样式 */
                    .history-multi-actions {
                        display: none;
                        align-items: center;
                        gap: 8px;
                    }

                    .history-selected-count {
                        font-size: 11px;
                        font-weight: 600;
                        color: rgba(255, 255, 255, 0.75);
                        min-width: 20px;
                        text-align: center;
                    }

                    .history-multi-btn {
                        width: 22px;
                        height: 22px;
                        border-radius: 8px;
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        background: transparent;
                        color: rgba(255, 255, 255, 0.22);
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        padding: 0;
                        transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
                    }

                    .history-multi-btn:not(:disabled):hover {
                        color: rgba(255, 255, 255, 0.75);
                        border-color: rgba(255, 255, 255, 0.2);
                        background: rgba(255, 255, 255, 0.06);
                    }

                    .history-multi-btn:active {
                        transform: scale(0.92);
                    }

                    .history-multi-btn svg {
                        width: 13px;
                        height: 13px;
                    }

                    .history-multi-btn.delete:hover {
                        border-color: rgba(239, 68, 68, 0.5);
                        color: rgba(239, 68, 68, 0.9);
                        background: rgba(239, 68, 68, 0.15);
                    }

                    .history-multi-btn.export:hover {
                        border-color: rgba(59, 130, 246, 0.5);
                        color: rgba(59, 130, 246, 0.9);
                        background: rgba(59, 130, 246, 0.15);
                    }

                    .history-multi-btn.cancel:hover {
                        border-color: rgba(255, 255, 255, 0.3);
                    }

                    /* 多选模式下的历史项样式 */
                    .history-page.multi-select-mode .history-item {
                        padding-left: 40px;
                        cursor: default;
                    }

                    .history-page.multi-select-mode .history-item-checkbox {
                        display: inline-flex;
                    }

                    .history-page.multi-select-mode .history-item:hover {
                        background: transparent;
                    }

                    .history-page.multi-select-mode .history-item:hover .history-item-checkbox {
                        background: rgba(255, 255, 255, 0.12);
                        border-color: rgba(255, 255, 255, 0.35);
                    }

                    .history-page.multi-select-mode .history-item:hover .history-item-checkbox:hover {
                        background: rgba(255, 255, 255, 0.18);
                        border-color: rgba(255, 255, 255, 0.45);
                    }

                    .history-page.multi-select-mode .history-item:hover .history-item-checkbox.checked {
                        background: rgba(59, 130, 246, 0.85);
                        border-color: rgba(59, 130, 246, 0.9);
                    }

                    .history-item-checkbox {
                        position: absolute;
                        left: 14px;
                        top: 50%;
                        transform: translateY(-50%);
                        width: 16px;
                        height: 16px;
                        border-radius: 4px;
                        border: 1.5px solid rgba(255, 255, 255, 0.25);
                        background: transparent;
                        display: none;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        z-index: 10;
                    }

                    .history-item-checkbox.checked {
                        background: rgba(59, 130, 246, 0.7);
                        border-color: rgba(59, 130, 246, 0.85);
                    }

                    .history-item-checkbox svg {
                        width: 10px;
                        height: 10px;
                        color: rgba(255, 255, 255, 0.95);
                        display: none;
                    }

                    .history-item-checkbox.checked svg {
                        display: block;
                    }

                    .history-item.selected {
                        background: rgba(59, 130, 246, 0.08) !important;
                        border-color: rgba(59, 130, 246, 0.25) !important;
                    }

                    /* 多选模式下隐藏项目操作按钮 */
                    .history-page.multi-select-mode .history-item-actions {
                        display: none !important;
                    }

                    .history-page.multi-select-mode .history-item-indicator {
                        display: none !important;
                    }
                </style>
`;
