/**
 * 状态模态框样式
 */
export const STATUS_STYLES = `
/* 状态模态框 */
.status-modal {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 1000;
}

.status-modal[aria-hidden="false"] {
    display: block;
}

.status-modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
}

/* 模态框容器 */
.status-modal-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    background: var(--vscode-editor-background, #1e1e1e);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}

/* 头部 */
.status-modal-header {
    display: flex;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    gap: 10px;
}

.status-modal-title {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    letter-spacing: 0.02em;
}

.status-modal-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    font-size: 11px;
    padding: 5px 10px;
    transition: all 0.2s ease;
}

.status-modal-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
}

.status-modal-close {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    font-size: 18px;
    padding: 4px 8px;
    line-height: 1;
    border-radius: 4px;
    transition: all 0.2s ease;
}

.status-modal-close:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
}

/* 内容区 */
.status-modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.status-modal-content::-webkit-scrollbar {
    display: none;
}

/* 状态区块 */
.status-section {
    margin-bottom: 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 12px 14px;
}

.status-section:last-child {
    margin-bottom: 0;
}

.status-section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.status-provider-badge {
    padding: 3px 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
}

.status-provider-badge.claude {
    background: rgba(217, 119, 6, 0.2);
    color: #f59e0b;
}

.status-provider-badge.codex {
    background: rgba(5, 150, 105, 0.2);
    color: #10b981;
}

.status-provider-badge.pi {
    background: rgba(124, 58, 237, 0.2);
    color: #a78bfa;
}

.status-section-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 500;
}

/* 状态指示器 */
.status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-left: auto;
    flex-shrink: 0;
}

.status-indicator.loading {
    background: #fbbf24;
    animation: status-pulse 1.5s ease-in-out infinite;
}

.status-indicator.success {
    background: #10b981;
}

.status-indicator.error {
    background: #ef4444;
}

.status-indicator.empty {
    background: #6b7280;
}

@keyframes status-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

/* 状态列表 */
.status-list {
    font-size: 12px;
}

.status-item {
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    margin-bottom: 6px;
    color: rgba(255, 255, 255, 0.8);
    word-break: break-all;
}

.status-item:last-child {
    margin-bottom: 0;
}

.status-empty {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
    padding: 4px 0;
}

.status-error {
    color: #f87171;
    font-size: 11px;
    padding: 4px 0;
}

/* 工具栏状态按钮 */
.toolbar-status-btn {
    width: 28px;
    height: 28px;
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

.toolbar-status-btn svg {
    width: 16px;
    height: 16px;
    stroke-width: 1.8;
}

.toolbar-status-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.92);
}
`;
