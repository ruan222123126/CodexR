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

body.home-mode .toolbar-add-btn {
    display: none;
}
`;
