/**
 * 工具栏样式
 */
export const TOOLBAR_STYLES = `
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

.toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
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
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.toolbar-title:hover {
    color: rgba(228, 228, 231, 0.95);
}

/* Token 计数器 */
.token-counter {
    display: none;
    align-items: center;
    gap: 4px;
    padding: 2px 8px 2px 4px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
    cursor: default;
    transition: all 0.2s ease;
}

.token-counter.visible {
    display: flex;
}

.token-counter:hover {
    background: rgba(255, 255, 255, 0.08);
}

.token-counter-icon {
    width: 14px;
    height: 14px;
    stroke: rgba(161, 161, 170, 0.7);
    transition: stroke 0.2s ease;
}

.token-counter-value {
    font-size: 11px;
    font-weight: 500;
    color: rgba(161, 161, 170, 0.9);
    font-variant-numeric: tabular-nums;
    transition: color 0.2s ease;
}

/* Token 使用量级别颜色 */
.token-counter.level-low .token-counter-icon {
    stroke: rgba(74, 222, 128, 0.8);
}
.token-counter.level-low .token-counter-value {
    color: rgba(74, 222, 128, 0.9);
}

.token-counter.level-medium .token-counter-icon {
    stroke: rgba(250, 204, 21, 0.8);
}
.token-counter.level-medium .token-counter-value {
    color: rgba(250, 204, 21, 0.9);
}

.token-counter.level-high .token-counter-icon {
    stroke: rgba(251, 146, 60, 0.8);
}
.token-counter.level-high .token-counter-value {
    color: rgba(251, 146, 60, 0.9);
}

.token-counter.level-critical .token-counter-icon {
    stroke: rgba(248, 113, 113, 0.8);
}
.token-counter.level-critical .token-counter-value {
    color: rgba(248, 113, 113, 0.9);
}

.toolbar-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.toolbar-add-btn,
.toolbar-settings-btn {
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

.toolbar-add-btn:hover,
.toolbar-settings-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(228, 228, 231, 0.95);
}

.toolbar-add-btn:active,
.toolbar-settings-btn:active {
    transform: scale(0.9);
}

.toolbar-add-btn svg,
.toolbar-settings-btn svg {
    width: 14px;
    height: 14px;
    stroke-width: 2;
}

body.home-mode .toolbar-add-btn {
    display: none;
}
`;
