import * as vscode from 'vscode';
import { WEBVIEW_STYLES } from './webviewStyles';
import { getWebviewScript } from './webviewScript';
import { Config, type TitleGenerationMode } from './providers/config';
import { getTranslations, type SupportedLanguage, type TranslationStrings } from './i18n';

function createNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let value = '';
    for (let i = 0; i < 32; i += 1) {
        value += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return value;
}

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const titleMode = Config.getTitleGenerationMode();
    const titleFixedProvider = Config.getTitleFixedProvider();
    const language = Config.getLanguage();
    const stepDetailLevel = Config.getStepDetailLevel();
    const t = getTranslations(language);

    const langEnSelected = language === 'en' ? 'selected' : '';
    const langZhCNSelected = language === 'zh-CN' ? 'selected' : '';

    const titleModeCurrentSelected = titleMode === 'currentProvider' ? 'selected' : '';
    const titleModeFixedSelected = titleMode === 'fixedProvider' ? 'selected' : '';
    const titleModeFirstMsgSelected = titleMode === 'firstMessage' ? 'selected' : '';

    const titleFixedCodexSelected = titleFixedProvider === 'codex' ? 'selected' : '';
    const titleFixedClaudeSelected = titleFixedProvider === 'claude' ? 'selected' : '';
    const titleFixedPiSelected = titleFixedProvider === 'pi' ? 'selected' : '';

    const nonce = createNonce();

    const markedScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'vendor', 'marked.min.js'));
    const purifyScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'vendor', 'purify.min.js'));

    const csp = [
        "default-src 'none'",
        `img-src ${webview.cspSource} https: data:`,
        `style-src ${webview.cspSource} 'nonce-${nonce}'`,
        `font-src ${webview.cspSource}`,
        `script-src ${webview.cspSource} 'nonce-${nonce}'`,
    ].join('; ');

    const stylesWithNonce = WEBVIEW_STYLES.replace('<style>', `<style nonce="${nonce}">`);
    const script = getWebviewScript(nonce);
    const translationsJson = JSON.stringify(t);

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="${csp}">
                <script nonce="${nonce}" src="${markedScriptUri}"></script>
                <script nonce="${nonce}" src="${purifyScriptUri}"></script>
                ${stylesWithNonce}
            </head>
            <body>
                <script nonce="${nonce}">
                    window.__TRANSLATIONS__ = ${translationsJson};
                    window.__LANGUAGE__ = '${language}';
                </script>
                <div id="top-toolbar" class="top-toolbar">
                    <div class="toolbar-left">
                        <span id="toolbar-title" class="toolbar-title">codeR</span>
                        <div id="token-counter" class="token-counter" title="${t['toolbar.tokenUsage']}" data-i18n-title="toolbar.tokenUsage">
                            <svg class="token-counter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                            </svg>
                            <span id="token-counter-value" class="token-counter-value">0</span>
                        </div>
                    </div>
                    <div class="toolbar-actions">
                        <button id="add-session-btn" class="toolbar-add-btn" title="${t['toolbar.newSession']}" data-i18n-title="toolbar.newSession">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        <button id="status-btn" class="toolbar-status-btn" title="${t['status.modalTitle']}" data-i18n-title="status.modalTitle">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </button>
                        <button id="settings-btn" class="toolbar-settings-btn" title="${t['toolbar.settings']}" data-i18n-title="toolbar.settings">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div id="history-page" class="history-page" aria-hidden="true">
                    <div class="history-page-topbar">
                        <div class="history-page-topbar-left">
                            <button id="history-back-btn" class="history-back-btn" title="${t['history.back']}" aria-label="${t['history.back']}" data-i18n-title="history.back" data-i18n-aria-label="history.back">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <path d="M15 18l-6-6 6-6"></path>
                                </svg>
                            </button>
                            <div class="history-page-heading">
                                <span class="history-page-title" data-i18n="history.title">${t['history.title']}</span>
                            </div>
                        </div>
                        <div class="history-page-actions">
                            <button id="history-multi-select-btn" class="history-icon-btn" type="button" title="${t['history.multiSelect']}" aria-label="${t['history.multiSelect']}" data-i18n-title="history.multiSelect" data-i18n-aria-label="history.multiSelect">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <rect x="3"  y="3"  width="7"  height="7"  rx="1"></rect>
                                    <rect x="14" y="3"  width="7"  height="7"  rx="1"></rect>
                                    <rect x="14" y="14" width="7"  height="7"  rx="1"></rect>
                                    <rect x="3"  y="14" width="7"  height="7"  rx="1"></rect>
                                </svg>
                            </button>
                            <div id="history-multi-actions" class="history-multi-actions" style="display: none;">
                                <span id="history-selected-count" class="history-selected-count">0</span>
                                <button id="history-multi-select-all-btn" class="history-multi-btn select-all" type="button" title="${t['history.selectAll']}" aria-label="${t['history.selectAll']}" data-i18n-title="history.selectAll" data-i18n-aria-label="history.selectAll">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <polyline points="9 11 12 14 22 4"></polyline>
                                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                                    </svg>
                                </button>
                                <button id="history-multi-delete-btn" class="history-multi-btn delete" type="button" title="${t['history.deleteSelected']}" aria-label="${t['history.deleteSelected']}" data-i18n-title="history.deleteSelected" data-i18n-aria-label="history.deleteSelected">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                                <button id="history-multi-export-btn" class="history-multi-btn export" type="button" title="${t['history.exportSelected']}" aria-label="${t['history.exportSelected']}" data-i18n-title="history.exportSelected" data-i18n-aria-label="history.exportSelected">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                </button>
                                <button id="history-multi-cancel-btn" class="history-multi-btn cancel" type="button" title="${t['history.cancelMultiSelect']}" aria-label="${t['history.cancelMultiSelect']}" data-i18n-title="history.cancelMultiSelect" data-i18n-aria-label="history.cancelMultiSelect">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="history-search-wrap">
                        <div class="history-search-container">
                            <span class="history-search-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="7"></circle>
                                    <path d="M21 21l-4-4"></path>
                                </svg>
                            </span>
                            <input id="history-search-input" class="history-search-input" type="text" placeholder="${t['history.searchPlaceholder']}" data-i18n-placeholder="history.searchPlaceholder" />
                            <button class="history-search-clear" type="button" aria-label="Clear search">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="history-filter-row">
                        <div class="history-filter-chip history-filter-chip-sort">
                            <button id="history-sort-btn" class="history-filter-btn" type="button" title="${t['history.sortNewest']}" data-i18n="history.sortNewest">${t['history.sortNewest']}</button>
                        </div>
                    </div>
                    <div id="history-list" class="history-list"></div>
                    <div class="history-page-footer" aria-hidden="true">
                        <div class="history-page-footer-line"></div>
                    </div>
                </div>
                <div id="settings-page" class="settings-page" aria-hidden="true">
                    <div class="settings-page-topbar">
                        <div class="settings-page-topbar-left">
                            <button id="settings-back-btn" class="settings-back-btn" title="${t['settings.back']}" aria-label="${t['settings.back']}" data-i18n-title="settings.back" data-i18n-aria-label="settings.back">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <path d="M15 18l-6-6 6-6"></path>
                                </svg>
                            </button>
                            <div class="settings-page-heading">
                                <span class="settings-page-title" data-i18n="settings.title">${t['settings.title']}</span>
                            </div>
                        </div>
                    </div>
                    <div class="settings-search-wrap">
                        <div class="settings-search-container">
                            <span class="settings-search-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="7"></circle>
                                    <path d="M21 21l-4-4"></path>
                                </svg>
                            </span>
                            <input id="settings-search-input" class="settings-search-input" type="text" placeholder="${t['settings.searchPlaceholder']}" data-i18n-placeholder="settings.searchPlaceholder" />
                            <button class="settings-search-clear" type="button" aria-label="Clear search">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="settings-content">
                        <div class="settings-section">
                            <div class="settings-section-title" data-i18n="settings.general">${t['settings.general']}</div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.language">${t['settings.language']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.languageDesc">${t['settings.languageDesc']}</span>
                                </div>
                                <div id="settings-language-wrap" class="settings-select-wrap">
                                    <button
                                        id="settings-language-trigger"
                                        class="settings-select-trigger"
                                        type="button"
                                        aria-haspopup="listbox"
                                        aria-expanded="false"
                                    >
                                        <span id="settings-language-label" class="settings-select-label">${language === 'zh-CN' ? '简体中文' : 'English'}</span>
                                        <svg class="settings-select-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </button>
                                    <div id="settings-language-menu" class="settings-select-menu" role="listbox">
                                        <button type="button" class="settings-select-option" data-settings-option="en" data-settings-select="language" role="option" aria-selected="${language === 'en'}">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">English</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="zh-CN" data-settings-select="language" role="option" aria-selected="${language === 'zh-CN'}">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">简体中文</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                    </div>
                                    <select id="settings-language" class="settings-select-native" tabindex="-1" aria-hidden="true">
                                        <option value="en" ${langEnSelected}>English</option>
                                        <option value="zh-CN" ${langZhCNSelected}>简体中文</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="settings-section">
                            <div class="settings-section-title" data-i18n="settings.display">${t['settings.display']}</div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.showToolIndicator">${t['settings.showToolIndicator']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.showToolIndicatorDesc">${t['settings.showToolIndicatorDesc']}</span>
                                </div>
                                <label class="settings-toggle">
                                    <input type="checkbox" id="settings-show-tool-indicator" />
                                    <span class="settings-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.stepDetailLevel">${t['settings.stepDetailLevel']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.stepDetailLevelDesc">${t['settings.stepDetailLevelDesc']}</span>
                                </div>
                                <div id="settings-step-detail-level-wrap" class="settings-select-wrap">
                                    <button
                                        id="settings-step-detail-level-trigger"
                                        class="settings-select-trigger"
                                        type="button"
                                        aria-haspopup="listbox"
                                        aria-expanded="false"
                                    >
                                        <span id="settings-step-detail-level-label" class="settings-select-label">${stepDetailLevel === 'full' ? t['settings.stepDetailLevelFull'] : t['settings.stepDetailLevelCompact']}</span>
                                        <svg class="settings-select-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </button>
                                    <div id="settings-step-detail-level-menu" class="settings-select-menu" role="listbox">
                                        <button type="button" class="settings-select-option" data-settings-option="compact" data-settings-select="step-detail-level" role="option" aria-selected="${stepDetailLevel === 'compact'}" data-i18n="settings.stepDetailLevelCompact">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.stepDetailLevelCompact']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="full" data-settings-select="step-detail-level" role="option" aria-selected="${stepDetailLevel === 'full'}" data-i18n="settings.stepDetailLevelFull">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.stepDetailLevelFull']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                    </div>
                                    <select id="settings-step-detail-level" class="settings-select-native" tabindex="-1" aria-hidden="true">
                                        <option value="compact" ${stepDetailLevel === 'compact' ? 'selected' : ''} data-i18n="settings.stepDetailLevelCompact">${t['settings.stepDetailLevelCompact']}</option>
                                        <option value="full" ${stepDetailLevel === 'full' ? 'selected' : ''} data-i18n="settings.stepDetailLevelFull">${t['settings.stepDetailLevelFull']}</option>
                                    </select>
                                </div>
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.thinkingFilter">${t['settings.thinkingFilter']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.thinkingFilterDesc">${t['settings.thinkingFilterDesc']}</span>
                                </div>
                                <label class="settings-toggle">
                                    <input type="checkbox" id="settings-thinking-filter" />
                                    <span class="settings-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.codexHideThinking">${t['settings.codexHideThinking']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.codexHideThinkingDesc">${t['settings.codexHideThinkingDesc']}</span>
                                </div>
                                <label class="settings-toggle">
                                    <input type="checkbox" id="settings-codex-hide-thinking" />
                                    <span class="settings-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.claudeDisableThinking">${t['settings.claudeDisableThinking']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.claudeDisableThinkingDesc">${t['settings.claudeDisableThinkingDesc']}</span>
                                </div>
                                <label class="settings-toggle">
                                    <input type="checkbox" id="settings-claude-disable-thinking" />
                                    <span class="settings-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.piDisableThinking">${t['settings.piDisableThinking']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.piDisableThinkingDesc">${t['settings.piDisableThinkingDesc']}</span>
                                </div>
                                <label class="settings-toggle">
                                    <input type="checkbox" id="settings-pi-disable-thinking" />
                                    <span class="settings-toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="settings-section">
                            <div class="settings-section-title" data-i18n="settings.session">${t['settings.session']}</div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.codexAutoResume">${t['settings.codexAutoResume']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.codexAutoResumeDesc">${t['settings.codexAutoResumeDesc']}</span>
                                </div>
                                <label class="settings-toggle">
                                    <input type="checkbox" id="settings-codex-auto-resume" />
                                    <span class="settings-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.claudeAutoResume">${t['settings.claudeAutoResume']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.claudeAutoResumeDesc">${t['settings.claudeAutoResumeDesc']}</span>
                                </div>
                                <label class="settings-toggle">
                                    <input type="checkbox" id="settings-claude-auto-resume" />
                                    <span class="settings-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.piAutoResume">${t['settings.piAutoResume']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.piAutoResumeDesc">${t['settings.piAutoResumeDesc']}</span>
                                </div>
                                <label class="settings-toggle">
                                    <input type="checkbox" id="settings-pi-auto-resume" />
                                    <span class="settings-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.titleMode">${t['settings.titleMode']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.titleModeDesc">${t['settings.titleModeDesc']}</span>
                                </div>
                                <div id="settings-title-mode-wrap" class="settings-select-wrap">
                                    <button
                                        id="settings-title-mode-trigger"
                                        class="settings-select-trigger"
                                        type="button"
                                        aria-haspopup="listbox"
                                        aria-expanded="false"
                                    >
                                        <span id="settings-title-mode-label" class="settings-select-label">${titleMode === 'currentProvider' ? t['settings.titleModeCurrentProvider'] : titleMode === 'fixedProvider' ? t['settings.titleModeFixedProvider'] : t['settings.titleModeFirstMessage']}</span>
                                        <svg class="settings-select-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </button>
                                    <div id="settings-title-mode-menu" class="settings-select-menu" role="listbox">
                                        <button type="button" class="settings-select-option" data-settings-option="currentProvider" data-settings-select="title-mode" role="option" aria-selected="${titleMode === 'currentProvider'}" data-i18n="settings.titleModeCurrentProvider">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.titleModeCurrentProvider']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="fixedProvider" data-settings-select="title-mode" role="option" aria-selected="${titleMode === 'fixedProvider'}" data-i18n="settings.titleModeFixedProvider">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.titleModeFixedProvider']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="firstMessage" data-settings-select="title-mode" role="option" aria-selected="${titleMode === 'firstMessage'}" data-i18n="settings.titleModeFirstMessage">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.titleModeFirstMessage']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                    </div>
                                    <select id="settings-title-mode" class="settings-select-native" tabindex="-1" aria-hidden="true">
                                        <option value="currentProvider" ${titleModeCurrentSelected} data-i18n="settings.titleModeCurrentProvider">${t['settings.titleModeCurrentProvider']}</option>
                                        <option value="fixedProvider" ${titleModeFixedSelected} data-i18n="settings.titleModeFixedProvider">${t['settings.titleModeFixedProvider']}</option>
                                        <option value="firstMessage" ${titleModeFirstMsgSelected} data-i18n="settings.titleModeFirstMessage">${t['settings.titleModeFirstMessage']}</option>
                                    </select>
                                </div>
                            </div>
                            <div class="settings-item" id="settings-title-fixed-provider-item" style="display: ${titleMode === 'fixedProvider' ? 'flex' : 'none'};">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.titleFixedProvider">${t['settings.titleFixedProvider']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.titleFixedProviderDesc">${t['settings.titleFixedProviderDesc']}</span>
                                </div>
                                <div id="settings-title-fixed-provider-wrap" class="settings-select-wrap">
                                    <button
                                        id="settings-title-fixed-provider-trigger"
                                        class="settings-select-trigger"
                                        type="button"
                                        aria-haspopup="listbox"
                                        aria-expanded="false"
                                    >
                                        <span id="settings-title-fixed-provider-label" class="settings-select-label">${titleFixedProvider === 'codex' ? 'Codex' : titleFixedProvider === 'claude' ? 'Claude' : 'Pi'}</span>
                                        <svg class="settings-select-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </button>
                                    <div id="settings-title-fixed-provider-menu" class="settings-select-menu" role="listbox">
                                        <button type="button" class="settings-select-option" data-settings-option="codex" data-settings-select="title-fixed-provider" role="option" aria-selected="${titleFixedProvider === 'codex'}">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">Codex</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="claude" data-settings-select="title-fixed-provider" role="option" aria-selected="${titleFixedProvider === 'claude'}">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">Claude</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="pi" data-settings-select="title-fixed-provider" role="option" aria-selected="${titleFixedProvider === 'pi'}">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">Pi</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                    </div>
                                    <select id="settings-title-fixed-provider" class="settings-select-native" tabindex="-1" aria-hidden="true">
                                        <option value="codex" ${titleFixedCodexSelected}>Codex</option>
                                        <option value="claude" ${titleFixedClaudeSelected}>Claude</option>
                                        <option value="pi" ${titleFixedPiSelected}>Pi</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="settings-section">
                            <div class="settings-section-title" data-i18n="settings.piConfig">${t['settings.piConfig']}</div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.openConfig">${t['settings.openConfig']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.openConfigDesc">${t['settings.openConfigDesc']}</span>
                                </div>
                                <button id="settings-pi-open-config" class="settings-open-config-btn" type="button" data-provider="pi" title="${t['settings.openConfig']}" data-i18n-title="settings.openConfig">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                        <polyline points="15 3 21 3 21 9"></polyline>
                                        <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                    <span data-i18n="settings.openConfig">${t['settings.openConfig']}</span>
                                </button>
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.piModel">${t['settings.piModel']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.piModelDesc">${t['settings.piModelDesc']}</span>
                                </div>
                                <input type="text" id="settings-pi-model" class="settings-text-input" value="" placeholder="" />
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.piApiKey">${t['settings.piApiKey']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.piApiKeyDesc">${t['settings.piApiKeyDesc']}</span>
                                </div>
                                <input type="password" id="settings-pi-api-key" class="settings-text-input" value="" placeholder="${t['settings.piApiKeyPlaceholder']}" data-i18n-placeholder="settings.piApiKeyPlaceholder" />
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.piThinkingLevel">${t['settings.piThinkingLevel']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.piThinkingLevelDesc">${t['settings.piThinkingLevelDesc']}</span>
                                </div>
                                <div id="settings-pi-thinking-level-wrap" class="settings-select-wrap">
                                    <button
                                        id="settings-pi-thinking-level-trigger"
                                        class="settings-select-trigger"
                                        type="button"
                                        aria-haspopup="listbox"
                                        aria-expanded="false"
                                    >
                                        <span id="settings-pi-thinking-level-label" class="settings-select-label">${t['settings.piThinkingLevelDefault']}</span>
                                        <svg class="settings-select-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </button>
                                    <div id="settings-pi-thinking-level-menu" class="settings-select-menu" role="listbox">
                                        <button type="button" class="settings-select-option" data-settings-option="default" data-settings-select="pi-thinking-level" role="option" aria-selected="true" data-i18n="settings.piThinkingLevelDefault">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.piThinkingLevelDefault']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="off" data-settings-select="pi-thinking-level" role="option" aria-selected="false">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">Off</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="minimal" data-settings-select="pi-thinking-level" role="option" aria-selected="false">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">Minimal</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="low" data-settings-select="pi-thinking-level" role="option" aria-selected="false">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">Low</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="medium" data-settings-select="pi-thinking-level" role="option" aria-selected="false">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">Medium</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="high" data-settings-select="pi-thinking-level" role="option" aria-selected="false">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">High</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="xhigh" data-settings-select="pi-thinking-level" role="option" aria-selected="false">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">XHigh</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                    </div>
                                    <select id="settings-pi-thinking-level" class="settings-select-native" tabindex="-1" aria-hidden="true">
                                        <option value="default" selected>${t['settings.piThinkingLevelDefault']}</option>
                                        <option value="off">Off</option>
                                        <option value="minimal">Minimal</option>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="xhigh">XHigh</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="settings-section">
                            <div class="settings-section-title" data-i18n="settings.codexConfig">${t['settings.codexConfig']}</div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.openConfig">${t['settings.openConfig']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.openConfigDesc">${t['settings.openConfigDesc']}</span>
                                </div>
                                <button id="settings-codex-open-config" class="settings-open-config-btn" type="button" data-provider="codex" title="${t['settings.openConfig']}" data-i18n-title="settings.openConfig">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                        <polyline points="15 3 21 3 21 9"></polyline>
                                        <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                    <span data-i18n="settings.openConfig">${t['settings.openConfig']}</span>
                                </button>
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.codexModel">${t['settings.codexModel']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.codexModelDesc">${t['settings.codexModelDesc']}</span>
                                </div>
                                <input type="text" id="settings-codex-model" class="settings-text-input" value="" placeholder="${t['settings.codexModelPlaceholder']}" data-i18n-placeholder="settings.codexModelPlaceholder" />
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.codexConfigOverrides">${t['settings.codexConfigOverrides']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.codexConfigOverridesDesc">${t['settings.codexConfigOverridesDesc']}</span>
                                </div>
                                <input type="text" id="settings-codex-config-overrides" class="settings-text-input" value="" placeholder="${t['settings.codexConfigOverridesPlaceholder']}" data-i18n-placeholder="settings.codexConfigOverridesPlaceholder" />
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.codexProfile">${t['settings.codexProfile']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.codexProfileDesc">${t['settings.codexProfileDesc']}</span>
                                </div>
                                <input type="text" id="settings-codex-profile" class="settings-text-input" value="" placeholder="${t['settings.codexProfilePlaceholder']}" data-i18n-placeholder="settings.codexProfilePlaceholder" />
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.codexOss">${t['settings.codexOss']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.codexOssDesc">${t['settings.codexOssDesc']}</span>
                                </div>
                                <label class="settings-toggle">
                                    <input type="checkbox" id="settings-codex-oss" />
                                    <span class="settings-toggle-slider"></span>
                                </label>
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.codexSandboxMode">${t['settings.codexSandboxMode']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.codexSandboxModeDesc">${t['settings.codexSandboxModeDesc']}</span>
                                </div>
                                <div id="settings-codex-sandbox-mode-wrap" class="settings-select-wrap">
                                    <button
                                        id="settings-codex-sandbox-mode-trigger"
                                        class="settings-select-trigger"
                                        type="button"
                                        aria-haspopup="listbox"
                                        aria-expanded="false"
                                    >
                                        <span id="settings-codex-sandbox-mode-label" class="settings-select-label">${t['settings.codexSandboxModeDefault']}</span>
                                        <svg class="settings-select-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </button>
                                    <div id="settings-codex-sandbox-mode-menu" class="settings-select-menu" role="listbox">
                                        <button type="button" class="settings-select-option" data-settings-option="default" data-settings-select="codex-sandbox-mode" role="option" aria-selected="true" data-i18n="settings.codexSandboxModeDefault">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.codexSandboxModeDefault']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="read-only" data-settings-select="codex-sandbox-mode" role="option" aria-selected="false" data-i18n="settings.codexSandboxModeReadOnly">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.codexSandboxModeReadOnly']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="workspace-write" data-settings-select="codex-sandbox-mode" role="option" aria-selected="false" data-i18n="settings.codexSandboxModeWorkspaceWrite">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.codexSandboxModeWorkspaceWrite']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="danger-full-access" data-settings-select="codex-sandbox-mode" role="option" aria-selected="false" data-i18n="settings.codexSandboxModeDangerFullAccess">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.codexSandboxModeDangerFullAccess']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                    </div>
                                    <select id="settings-codex-sandbox-mode" class="settings-select-native" tabindex="-1" aria-hidden="true">
                                        <option value="default" selected>${t['settings.codexSandboxModeDefault']}</option>
                                        <option value="read-only">${t['settings.codexSandboxModeReadOnly']}</option>
                                        <option value="workspace-write">${t['settings.codexSandboxModeWorkspaceWrite']}</option>
                                        <option value="danger-full-access">${t['settings.codexSandboxModeDangerFullAccess']}</option>
                                    </select>
                                </div>
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.codexApprovalPolicy">${t['settings.codexApprovalPolicy']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.codexApprovalPolicyDesc">${t['settings.codexApprovalPolicyDesc']}</span>
                                </div>
                                <div id="settings-codex-approval-policy-wrap" class="settings-select-wrap">
                                    <button
                                        id="settings-codex-approval-policy-trigger"
                                        class="settings-select-trigger"
                                        type="button"
                                        aria-haspopup="listbox"
                                        aria-expanded="false"
                                    >
                                        <span id="settings-codex-approval-policy-label" class="settings-select-label">${t['settings.codexApprovalPolicyDefault']}</span>
                                        <svg class="settings-select-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </button>
                                    <div id="settings-codex-approval-policy-menu" class="settings-select-menu" role="listbox">
                                        <button type="button" class="settings-select-option" data-settings-option="default" data-settings-select="codex-approval-policy" role="option" aria-selected="true" data-i18n="settings.codexApprovalPolicyDefault">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.codexApprovalPolicyDefault']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="untrusted" data-settings-select="codex-approval-policy" role="option" aria-selected="false" data-i18n="settings.codexApprovalPolicyUntrusted">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.codexApprovalPolicyUntrusted']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="on-failure" data-settings-select="codex-approval-policy" role="option" aria-selected="false" data-i18n="settings.codexApprovalPolicyOnFailure">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.codexApprovalPolicyOnFailure']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="never" data-settings-select="codex-approval-policy" role="option" aria-selected="false" data-i18n="settings.codexApprovalPolicyNever">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.codexApprovalPolicyNever']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                    </div>
                                    <select id="settings-codex-approval-policy" class="settings-select-native" tabindex="-1" aria-hidden="true">
                                        <option value="default" selected>${t['settings.codexApprovalPolicyDefault']}</option>
                                        <option value="untrusted">${t['settings.codexApprovalPolicyUntrusted']}</option>
                                        <option value="on-failure">${t['settings.codexApprovalPolicyOnFailure']}</option>
                                        <option value="never">${t['settings.codexApprovalPolicyNever']}</option>
                                    </select>
                                </div>
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.codexFullAuto">${t['settings.codexFullAuto']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.codexFullAutoDesc">${t['settings.codexFullAutoDesc']}</span>
                                </div>
                                <label class="settings-toggle">
                                    <input type="checkbox" id="settings-codex-full-auto" />
                                    <span class="settings-toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="settings-section">
                            <div class="settings-section-title" data-i18n="settings.claudeConfig">${t['settings.claudeConfig']}</div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.openConfig">${t['settings.openConfig']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.openConfigDesc">${t['settings.openConfigDesc']}</span>
                                </div>
                                <button id="settings-claude-open-config" class="settings-open-config-btn" type="button" data-provider="claude" title="${t['settings.openConfig']}" data-i18n-title="settings.openConfig">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                        <polyline points="15 3 21 3 21 9"></polyline>
                                        <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                    <span data-i18n="settings.openConfig">${t['settings.openConfig']}</span>
                                </button>
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.claudeModel">${t['settings.claudeModel']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.claudeModelDesc">${t['settings.claudeModelDesc']}</span>
                                </div>
                                <input type="text" id="settings-claude-model" class="settings-text-input" value="" placeholder="${t['settings.claudeModelPlaceholder']}" data-i18n-placeholder="settings.claudeModelPlaceholder" />
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.claudeAgent">${t['settings.claudeAgent']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.claudeAgentDesc">${t['settings.claudeAgentDesc']}</span>
                                </div>
                                <input type="text" id="settings-claude-agent" class="settings-text-input" value="" placeholder="${t['settings.claudeAgentPlaceholder']}" data-i18n-placeholder="settings.claudeAgentPlaceholder" />
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.claudeTools">${t['settings.claudeTools']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.claudeToolsDesc">${t['settings.claudeToolsDesc']}</span>
                                </div>
                                <input type="text" id="settings-claude-tools" class="settings-text-input" value="" placeholder="${t['settings.claudeToolsPlaceholder']}" data-i18n-placeholder="settings.claudeToolsPlaceholder" />
                            </div>
                            <div class="settings-item">
                                <div class="settings-item-info">
                                    <span class="settings-item-label" data-i18n="settings.claudePermissionMode">${t['settings.claudePermissionMode']}</span>
                                    <span class="settings-item-desc" data-i18n="settings.claudePermissionModeDesc">${t['settings.claudePermissionModeDesc']}</span>
                                </div>
                                <div id="settings-claude-permission-mode-wrap" class="settings-select-wrap">
                                    <button
                                        id="settings-claude-permission-mode-trigger"
                                        class="settings-select-trigger"
                                        type="button"
                                        aria-haspopup="listbox"
                                        aria-expanded="false"
                                    >
                                        <span id="settings-claude-permission-mode-label" class="settings-select-label">${t['settings.claudePermissionModeDangerouslySkip']}</span>
                                        <svg class="settings-select-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </button>
                                    <div id="settings-claude-permission-mode-menu" class="settings-select-menu" role="listbox">
                                        <button type="button" class="settings-select-option" data-settings-option="dangerouslySkip" data-settings-select="claude-permission-mode" role="option" aria-selected="true" data-i18n="settings.claudePermissionModeDangerouslySkip">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.claudePermissionModeDangerouslySkip']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="allowDangerouslySkip" data-settings-select="claude-permission-mode" role="option" aria-selected="false" data-i18n="settings.claudePermissionModeAllowDangerouslySkip">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.claudePermissionModeAllowDangerouslySkip']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                        <button type="button" class="settings-select-option" data-settings-option="default" data-settings-select="claude-permission-mode" role="option" aria-selected="false" data-i18n="settings.claudePermissionModeDefault">
                                            <span class="settings-select-option-text">
                                                <span class="settings-select-option-main">${t['settings.claudePermissionModeDefault']}</span>
                                            </span>
                                            <span class="settings-select-option-check">✓</span>
                                        </button>
                                    </div>
                                    <select id="settings-claude-permission-mode" class="settings-select-native" tabindex="-1" aria-hidden="true">
                                        <option value="dangerouslySkip" selected>${t['settings.claudePermissionModeDangerouslySkip']}</option>
                                        <option value="allowDangerouslySkip">${t['settings.claudePermissionModeAllowDangerouslySkip']}</option>
                                        <option value="default">${t['settings.claudePermissionModeDefault']}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="chat-container"></div>
                <div id="input-area">
                    <div class="obsidian-input-wrapper">
                        <div id="recent-tasks-panel" class="recent-tasks-panel">
                            <div id="session-header" class="session-header">
                                <div class="session-header-left">
                                    <span class="session-header-title" data-i18n="input.recentTasks">${t['input.recentTasks']}</span>
                                    <button
                                        id="recent-tasks-toggle-btn"
                                        class="recent-tasks-toggle-btn"
                                        type="button"
                                        title="${t['input.collapseRecentTasks']}"
                                        aria-label="${t['input.collapseRecentTasks']}"
                                        aria-expanded="true"
                                        data-i18n-title="input.collapseRecentTasks"
                                        data-i18n-aria-label="input.collapseRecentTasks"
                                    >
                                        <span class="recent-tasks-toggle-icon">▼</span>
                                    </button>
                                </div>
                                <button id="session-view-all-btn" class="session-view-all-btn" title="${t['input.viewAll']}" data-i18n="input.viewAll">${t['input.viewAll']}</button>
                            </div>
                            <div id="recent-tasks-list" class="recent-tasks-list"></div>
                        </div>
                        <select id="session-select" class="session-select session-select-hidden" title="Select session" aria-hidden="true" tabindex="-1"></select>
                        <div id="input-container" class="obsidian-input-container">
                            <div class="obsidian-progress-bar"></div>
                            <div class="obsidian-input-row">
                                <button id="add-btn" class="obsidian-btn" title="${t['input.addAttachment']}" data-i18n-title="input.addAttachment">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                </button>
                                <textarea id="input-box" placeholder="${t['input.placeholder']}" rows="1" data-i18n-placeholder="input.placeholder"></textarea>
                                <button id="send-btn" class="obsidian-send-btn" title="${t['input.sendMessage']}" data-i18n-title="input.sendMessage">
                                    <span id="send-btn-content">
                                        <svg id="send-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                            <line x1="12" y1="19" x2="12" y2="5"></line>
                                            <polyline points="5 12 12 5 19 12"></polyline>
                                        </svg>
                                    </span>
                                </button>
                            </div>
                            <div id="attachment-list" class="attachment-list"></div>
                        </div>
                        <div class="obsidian-status-bar">
                            <div id="status-text" class="obsidian-status-text">
                                <span class="status-dot"></span>
                                <span data-i18n="status.ready">${t['status.ready']}</span>
                            </div>
                            <div id="provider-select-wrap" class="provider-select-wrap">
                                <button
                                    id="provider-select-trigger"
                                    class="provider-select-trigger"
                                    type="button"
                                    title="${t['input.sessionProvider']}"
                                    aria-haspopup="listbox"
                                    aria-expanded="false"
                                    data-i18n-title="input.sessionProvider"
                                >
                                    <span id="provider-select-label" class="provider-select-label">Codex</span>
                                    <svg class="provider-select-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>
                                <div id="provider-select-menu" class="provider-select-menu" role="listbox" aria-label="${t['input.sessionProvider']}" data-i18n-aria-label="input.sessionProvider">
                                    <button type="button" class="provider-select-option" data-provider-option="codex" role="option" aria-selected="false">
                                        <span class="provider-select-option-text">
                                            <span class="provider-select-option-main">Codex</span>
                                        </span>
                                        <span class="provider-select-option-check">✓</span>
                                    </button>
                                    <button type="button" class="provider-select-option" data-provider-option="claude" role="option" aria-selected="false">
                                        <span class="provider-select-option-text">
                                            <span class="provider-select-option-main">Claude</span>
                                        </span>
                                        <span class="provider-select-option-check">✓</span>
                                    </button>
                                    <button type="button" class="provider-select-option" data-provider-option="pi" role="option" aria-selected="false">
                                        <span class="provider-select-option-text">
                                            <span class="provider-select-option-main">Pi</span>
                                        </span>
                                        <span class="provider-select-option-check">✓</span>
                                    </button>
                                </div>
                                <select id="provider-select" class="provider-select provider-select-native" title="${t['input.sessionProvider']}" tabindex="-1" aria-hidden="true" data-i18n-title="input.sessionProvider">
                                    <option value="codex" selected>Codex</option>
                                    <option value="claude">Claude</option>
                                    <option value="pi">Pi</option>
                                </select>
                            </div>
                        </div>
                        <div id="hint-text" class="obsidian-hint-text"></div>
                    </div>
                </div>
                <div id="version-tag" class="version-tag">v0.0.1</div>
                <a id="made-by-tag" class="made-by-tag" href="https://github.com/ruan222123126/CodexR/tree/linux" target="_blank">MADE FOR RUAN</a>
                <div id="status-modal" class="status-modal" aria-hidden="true">
                    <div class="status-modal-backdrop"></div>
                    <div class="status-modal-container">
                        <div class="status-modal-header">
                            <span class="status-modal-title" data-i18n="status.modalTitle">${t['status.modalTitle']}</span>
                            <button id="status-modal-refresh" class="status-modal-btn" data-i18n="status.refresh">${t['status.refresh']}</button>
                            <button id="status-modal-close" class="status-modal-close" title="${t['status.close']}" data-i18n-title="status.close">&times;</button>
                        </div>
                        <div class="status-modal-content">
                            <div class="status-section" data-provider="claude">
                                <div class="status-section-header">
                                    <span class="status-provider-badge claude">Claude</span>
                                    <span class="status-section-label" data-i18n="status.mcpServers">${t['status.mcpServers']}</span>
                                    <span id="claude-status-indicator" class="status-indicator"></span>
                                </div>
                                <div id="claude-mcp-list" class="status-list"></div>
                            </div>
                            <div class="status-section" data-provider="codex">
                                <div class="status-section-header">
                                    <span class="status-provider-badge codex">Codex</span>
                                    <span class="status-section-label" data-i18n="status.mcpServers">${t['status.mcpServers']}</span>
                                    <span id="codex-status-indicator" class="status-indicator"></span>
                                </div>
                                <div id="codex-mcp-list" class="status-list"></div>
                            </div>
                            <div class="status-section" data-provider="pi">
                                <div class="status-section-header">
                                    <span class="status-provider-badge pi">Pi</span>
                                    <span class="status-section-label" data-i18n="status.extensions">${t['status.extensions']}</span>
                                    <span id="pi-status-indicator" class="status-indicator"></span>
                                </div>
                                <div id="pi-ext-list" class="status-list"></div>
                            </div>
                        </div>
                    </div>
                </div>
                ${script}
            </body>
            </html>`;
}
