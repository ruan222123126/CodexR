/**
 * 历史页面样式
 */
export const HISTORY_STYLES = `
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
    align: center;
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
`;
