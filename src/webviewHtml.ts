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
                <div id="chat-container"></div>
                <div id="input-area">
                    <div class="obsidian-input-wrapper">
                        <div class="session-bar">
                            <select id="session-select" class="session-select" title="Select session"></select>
                            <button id="session-new-btn" class="session-btn" title="New session">＋</button>
                            <button id="session-rename-btn" class="session-btn" title="Rename session">✎</button>
                            <button id="session-delete-btn" class="session-btn" title="Delete session">🗑</button>
                        </div>
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
                            <select id="provider-select" class="provider-select" title="Session provider" disabled>
                                <option value="codex" ${codexSelected}>Codex</option>
                                <option value="claude" ${claudeSelected}>Claude</option>
                                <option value="pi" ${piSelected}>Pi</option>
                            </select>
                        </div>
                        <div id="hint-text" class="obsidian-hint-text"></div>
                    </div>
                </div>
                ${script}
            </body>
            </html>`;
}
