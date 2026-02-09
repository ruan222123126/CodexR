import * as vscode from 'vscode';
import { WEBVIEW_STYLES } from './webviewStyles';
import { getWebviewScript } from './webviewScript';

function createNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let value = '';
    for (let i = 0; i < 32; i += 1) {
        value += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return value;
}

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri, defaultProvider: 'codex' | 'claude' | 'pi') {
    const codexSelected = defaultProvider === 'codex' ? 'selected' : '';
    const claudeSelected = defaultProvider === 'claude' ? 'selected' : '';
    const piSelected = defaultProvider === 'pi' ? 'selected' : '';
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
                <div id="top-toolbar" class="top-toolbar">
                    <span id="toolbar-title" class="toolbar-title">codeR</span>
                    <button id="add-session-btn" class="toolbar-add-btn" title="新建会话">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                </div>
                <div id="history-page" class="history-page" aria-hidden="true">
                    <div class="history-page-topbar">
                        <div class="history-page-topbar-left">
                            <button id="history-back-btn" class="history-back-btn" title="返回聊天" aria-label="返回聊天">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <path d="M15 18l-6-6 6-6"></path>
                                </svg>
                            </button>
                            <div class="history-page-heading">
                                <span class="history-page-title">HISTORY</span>
                            </div>
                        </div>
                        <div class="history-page-actions">
                            <button id="history-multi-select-btn" class="history-icon-btn" type="button" title="多选" aria-label="多选">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <rect x="3"  y="3"  width="7"  height="7"  rx="1"></rect>
                                    <rect x="14" y="3"  width="7"  height="7"  rx="1"></rect>
                                    <rect x="14" y="14" width="7"  height="7"  rx="1"></rect>
                                    <rect x="3"  y="14" width="7"  height="7"  rx="1"></rect>
                                </svg>
                            </button>
                            <div id="history-multi-actions" class="history-multi-actions" style="display: none;">
                                <span id="history-selected-count" class="history-selected-count">0</span>
                                <button id="history-multi-delete-btn" class="history-multi-btn" type="button" title="删除选中" aria-label="删除选中">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                                <button id="history-multi-export-btn" class="history-multi-btn" type="button" title="导出选中" aria-label="导出选中">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                </button>
                                <button id="history-multi-cancel-btn" class="history-multi-btn" type="button" title="取消多选" aria-label="取消多选">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="history-search-wrap">
                        <span class="history-search-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="11" cy="11" r="7"></circle>
                                <path d="M20 20l-3.2-3.2"></path>
                            </svg>
                        </span>
                        <input id="history-search-input" class="history-search-input" type="text" placeholder="FIND DATA..." />
                    </div>
                    <div class="history-filter-row">
                        <div class="history-filter-chip history-filter-chip-sort">
                            <button id="history-sort-btn" class="history-filter-btn" type="button" title="按时间排序">Newest</button>
                        </div>
                    </div>
                    <div id="history-list" class="history-list"></div>
                    <div class="history-page-footer" aria-hidden="true">
                        <div class="history-page-footer-line"></div>
                    </div>
                </div>
                <div id="chat-container"></div>
                <div id="input-area">
                    <div class="obsidian-input-wrapper">
                        <div id="session-header" class="session-header">
                            <span class="session-header-title">Recent Tasks</span>
                            <button id="session-view-all-btn" class="session-view-all-btn" title="View all sessions">View all</button>
                        </div>
                        <div id="recent-tasks-list" class="recent-tasks-list"></div>
                        <select id="session-select" class="session-select session-select-hidden" title="Select session" aria-hidden="true" tabindex="-1"></select>
                        <div id="input-container" class="obsidian-input-container">
                            <div class="obsidian-progress-bar"></div>
                            <div class="obsidian-input-row">
                                <button id="add-btn" class="obsidian-btn" title="Add attachment">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                </button>
                                <textarea id="input-box" placeholder="Ask anything..." rows="1"></textarea>
                                <button id="send-btn" class="obsidian-send-btn" title="Send message">
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
                                Ready
                            </div>
                            <div id="provider-select-wrap" class="provider-select-wrap">
                                <button
                                    id="provider-select-trigger"
                                    class="provider-select-trigger"
                                    type="button"
                                    title="Session provider"
                                    aria-haspopup="listbox"
                                    aria-expanded="false"
                                >
                                    <span id="provider-select-label" class="provider-select-label">Codex</span>
                                    <svg class="provider-select-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>
                                <div id="provider-select-menu" class="provider-select-menu" role="listbox" aria-label="Session provider">
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
                                <select id="provider-select" class="provider-select provider-select-native" title="Session provider" tabindex="-1" aria-hidden="true">
                                    <option value="codex" ${codexSelected}>Codex</option>
                                    <option value="claude" ${claudeSelected}>Claude</option>
                                    <option value="pi" ${piSelected}>Pi</option>
                                </select>
                            </div>
                        </div>
                        <div id="hint-text" class="obsidian-hint-text"></div>
                    </div>
                </div>
                ${script}
            </body>
            </html>`;
}
