import * as vscode from 'vscode';
import { WEBVIEW_STYLES } from './webviewStyles';
import { WEBVIEW_SCRIPT } from './webviewScript';

export function getWebviewHtml(_webview: vscode.Webview, defaultProvider: 'codex' | 'claude') {
    const codexSelected = defaultProvider === 'codex' ? 'selected' : '';
    const claudeSelected = defaultProvider === 'claude' ? 'selected' : '';

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
                ${WEBVIEW_STYLES}
            </head>
            <body>
                <div id="chat-container"></div>
                <div id="input-area">
                    <div class="obsidian-input-wrapper">
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
                                    <div id="send-btn-content">
                                        <svg id="send-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                            <line x1="12" y1="19" x2="12" y2="5"></line>
                                            <polyline points="5 12 12 5 19 12"></polyline>
                                        </svg>
                                    </div>
                                </button>
                            </div>
                        </div>
                        <div class="provider-row">
                            <select id="provider-select" class="provider-select" title="Select provider">
                                <option value="codex" ${codexSelected}>Codex</option>
                                <option value="claude" ${claudeSelected}>Claude</option>
                            </select>
                        </div>
                        <div class="obsidian-status-bar">
                            <div id="status-text" class="obsidian-status-text">
                                <span class="status-dot"></span>
                                Ready
                            </div>
                            <div id="hint-text" class="obsidian-hint-text"></div>
                        </div>
                    </div>
                </div>
                ${WEBVIEW_SCRIPT}
            </body>
            </html>`;
}
