/**
 * 设置页面样式
 */
export const SETTINGS_STYLES = `
/* 设置页面 */
.settings-page {
    display: none;
    padding: 14px 14px 10px;
    box-sizing: border-box;
    background: var(--vscode-editor-background);
    color: #f0f0f0;
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

body.settings-mode .settings-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
}

.settings-page-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 2px 2px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.settings-page-topbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.settings-back-btn {
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

.settings-back-btn svg {
    width: 14px;
    height: 14px;
}

.settings-back-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.92);
}

.settings-page-heading {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.settings-page-title {
    font-size: 12px;
    line-height: 1.2;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.58);
    white-space: nowrap;
}

/* Settings Search */
.settings-search-wrap {
    position: relative;
    display: flex;
    align-items: center;
    padding: 4px 0 8px;
}

.settings-search-container {
    position: relative;
    width: 100%;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 0.3s ease;
}

.settings-search-container:hover {
    background: rgba(0, 0, 0, 0.4);
    border-color: rgba(255, 255, 255, 0.1);
}

.settings-search-container:focus-within {
    background: rgba(0, 0, 0, 0.5);
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.settings-search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(255, 255, 255, 0.3);
    pointer-events: none;
    transition: color 0.3s ease;
}

.settings-search-icon svg {
    width: 14px;
    height: 14px;
}

.settings-search-container:focus-within .settings-search-icon {
    color: rgba(255, 255, 255, 0.5);
}

.settings-search-input {
    width: 100%;
    height: 38px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.85);
    padding: 0 12px 0 38px;
    font-size: 13px;
    font-weight: 400;
    letter-spacing: 0.01em;
    outline: none;
    transition: color 0.3s ease;
}

.settings-search-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
    opacity: 1;
}

.settings-search-input:focus {
    color: rgba(255, 255, 255, 0.95);
}

.settings-search-clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.settings-search-clear:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
}

.settings-search-clear svg {
    width: 12px;
    height: 12px;
}

.settings-search-container.has-value .settings-search-clear {
    display: inline-flex;
}

/* Settings search highlight */
.settings-section.hidden-by-search,
.settings-item.hidden-by-search {
    display: none !important;
}

.settings-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px 4px 2px;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.settings-content::-webkit-scrollbar {
    display: none;
}

.settings-section {
    margin-bottom: 20px;
    padding: 0 10px;
}

.settings-section-title {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: rgba(255, 255, 255, 0.35);
    text-transform: uppercase;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.settings-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.settings-item:last-child {
    border-bottom: none;
}

.settings-item-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    margin-right: 16px;
}

.settings-item-label {
    font-size: 13px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.75);
}

.settings-item-desc {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    line-height: 1.4;
}

/* Settings Select - 自定义下拉组件 */
.settings-select-wrap {
    position: relative;
    min-width: 100px;
    flex-shrink: 0;
}

.settings-select-native {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
}

.settings-select-trigger {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.75);
    padding: 6px 10px;
    font-size: 12px;
    line-height: 1.2;
    cursor: pointer;
    transition: all 0.2s ease;
}

.settings-select-trigger:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.9);
}

.settings-select-trigger:focus-visible {
    outline: none;
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
}

.settings-select-label {
    font-size: 12px;
    font-weight: 500;
    color: inherit;
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.settings-select-chevron {
    width: 12px;
    height: 12px;
    color: inherit;
    opacity: 0.6;
    transition: transform 0.2s ease, opacity 0.2s ease;
    flex-shrink: 0;
}

.settings-select-wrap.open .settings-select-chevron {
    transform: rotate(180deg);
    opacity: 1;
}

.settings-select-menu {
    position: absolute;
    z-index: 50;
    top: 100%;
    right: 0;
    min-width: 120px;
    margin-top: 6px;
    background: rgba(18, 18, 18, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    padding: 4px;
    max-height: min(200px, calc(100vh - 32px));
    overflow-y: auto;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 0.15s ease;
}

.settings-select-wrap.open-up .settings-select-menu {
    top: auto;
    bottom: calc(100% + 6px);
    margin-top: 0;
}

.settings-select-wrap.open .settings-select-menu {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
}

.settings-select-option {
    width: 100%;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    font-size: 12px;
}

.settings-select-option:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
}

.settings-select-option[data-selected="true"] {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.9);
}

.settings-select-option-text {
    min-width: 0;
    display: flex;
    align-items: center;
}

.settings-select-option-main {
    font-size: 12px;
    line-height: 1.25;
    font-weight: 400;
    color: inherit;
}

.settings-select-option-check {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    opacity: 0;
    transition: opacity 0.15s ease;
    flex-shrink: 0;
}

.settings-select-option[data-selected="true"] .settings-select-option-check {
    opacity: 1;
}

/* Settings Text Input */
.settings-text-input {
    min-width: 120px;
    max-width: 180px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.75);
    padding: 6px 10px;
    font-size: 12px;
    line-height: 1.2;
    transition: all 0.2s ease;
    flex-shrink: 0;
}

.settings-text-input:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);
}

.settings-text-input:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
}

.settings-text-input::placeholder {
    color: rgba(255, 255, 255, 0.35);
}

/* Settings Toggle */
.settings-toggle {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
    flex-shrink: 0;
}

.settings-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
}

.settings-toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.1);
    transition: 0.3s;
    border-radius: 22px;
}

.settings-toggle-slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background-color: rgba(255, 255, 255, 0.6);
    transition: 0.3s;
    border-radius: 50%;
}

.settings-toggle input:checked + .settings-toggle-slider {
    background-color: rgba(99, 102, 241, 0.6);
}

.settings-toggle input:checked + .settings-toggle-slider:before {
    transform: translateX(18px);
    background-color: rgba(255, 255, 255, 0.9);
}

.settings-toggle:hover .settings-toggle-slider {
    background-color: rgba(255, 255, 255, 0.15);
}

.settings-toggle input:checked + .settings-toggle-slider:hover {
    background-color: rgba(99, 102, 241, 0.7);
}

/* Settings Open Config Button */
.settings-open-config-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.65);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
}

.settings-open-config-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.9);
}

.settings-open-config-btn:active {
    background: rgba(255, 255, 255, 0.1);
}

.settings-open-config-btn svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
}
`;
