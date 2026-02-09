/**
 * 输入区域样式
 */
export const INPUT_STYLES = `
#input-area {
    padding: 15px 15px 2px;
    background: var(--vscode-editor-background);
    border-top: 1px solid var(--vscode-panel-border);
    display: flex; justify-content: center; align-items: center;
}

/* 首页模式 - 输入区域垂直居中 */
body.home-mode #chat-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}

body.home-mode #input-area {
    position: absolute;
    top: 42%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: calc(100% - 30px);
    max-width: 600px;
    border-top: none;
    padding: 20px 15px;
}

body.home-mode .obsidian-input-wrapper {
    position: relative;
}

body.home-mode .recent-tasks-panel {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    max-height: calc(50vh - 100px);
    overflow: hidden;
}

body.home-mode .recent-tasks-list {
    margin-bottom: 0;
    overflow-y: auto;
}

/* 主页模式下状态栏移到输入框上方 */
body.home-mode .obsidian-status-bar {
    order: -1;
    margin-top: 0;
    margin-bottom: 12px;
}

/* 版本号标签 */
.version-tag {
    display: none;
}

body.home-mode:not(.history-mode):not(.settings-mode) .version-tag {
    display: block;
    position: fixed;
    left: 12px;
    bottom: 12px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.25);
    letter-spacing: 0.5px;
}

/* Made by 标签 */
.made-by-tag {
    display: none;
}

body.home-mode:not(.history-mode):not(.settings-mode) .made-by-tag {
    display: block;
    position: fixed;
    right: 12px;
    bottom: 12px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.25);
    letter-spacing: 0.5px;
    text-decoration: none;
    transition: color 0.2s ease;
}

body.home-mode:not(.history-mode):not(.settings-mode) .made-by-tag:hover {
    color: rgba(255, 255, 255, 0.5);
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

.recent-tasks-panel {
    position: relative;
}

.recent-tasks-toggle-btn {
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.45);
    display: none;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.2s ease, background 0.2s ease, color 0.2s ease;
}

body.home-mode .recent-tasks-toggle-btn {
    display: inline-flex;
}

body.home-mode .session-header:hover .recent-tasks-toggle-btn {
    opacity: 1;
}

.recent-tasks-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
}

.recent-tasks-toggle-icon {
    font-size: 10px;
    line-height: 1;
    transition: transform 0.2s ease;
}

body.home-mode .recent-tasks-panel.collapsed .recent-tasks-toggle-icon {
    transform: rotate(-90deg);
}

.session-header {
    display: none;
    align-items: center;
    justify-content: space-between;
    height: 38px;
    padding: 0 12px;
    margin-bottom: 8px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(180deg, rgba(20, 20, 20, 0.95), rgba(12, 12, 12, 0.92));
}

body.home-mode .session-header {
    display: flex;
}

.session-header-left {
    display: flex;
    align-items: center;
    gap: 6px;
}

.recent-tasks-list {
    display: none;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
    max-height: 200px;
    overflow-y: auto;
}

body.home-mode .recent-tasks-list {
    display: flex;
}

body.home-mode .recent-tasks-panel.collapsed .recent-tasks-list {
    display: none;
}

body.home-mode .recent-tasks-panel.collapsed .session-header {
    margin-bottom: 8px;
}

.recent-task-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(20, 20, 20, 0.6);
    cursor: pointer;
    transition: all 0.2s ease;
}

.recent-task-item:hover {
    background: rgba(30, 30, 30, 0.8);
    border-color: rgba(255, 255, 255, 0.12);
}

.recent-task-item.active {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(40, 40, 40, 0.7);
}

.recent-task-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.recent-task-title {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.recent-task-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.45);
}

.recent-task-provider {
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.recent-task-time {
    color: rgba(255, 255, 255, 0.35);
}

.recent-tasks-empty {
    padding: 16px;
    text-align: center;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
}

.session-header-logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05));
    border: 1px solid rgba(255, 255, 255, 0.12);
    font-size: 12px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: 0;
    margin-right: 8px;
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
    padding: 8px 0 8px;
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
    width: 38px;
    height: 38px;
    padding: 0;
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
    flex-shrink: 0;
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
`;
