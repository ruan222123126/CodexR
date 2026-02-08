import { WEBVIEW_SCRIPT_PARSE } from './webviewScriptParse';
import { WEBVIEW_SCRIPT_RENDER } from './webviewScriptRender';
import { WEBVIEW_SCRIPT_STREAM } from './webviewScriptStream';
import { WEBVIEW_SCRIPT_INPUT } from './webviewScriptInput';

const WEBVIEW_SCRIPT_HEADER = `
                    const vscode = acquireVsCodeApi();
                    marked.setOptions({ breaks: true, gfm: true });

                    function renderMarkdownSafe(markdownText) {
                        const parsed = marked.parse(String(markdownText || ''));
                        if (typeof DOMPurify === 'undefined' || !DOMPurify || typeof DOMPurify.sanitize !== 'function') {
                            return parsed;
                        }
                        return DOMPurify.sanitize(parsed);
                    }

                    const container = document.getElementById('chat-container');
                    const inputBox = document.getElementById('input-box');
                    const inputContainer = document.getElementById('input-container');
                    const addBtn = document.getElementById('add-btn');
                    const attachmentList = document.getElementById('attachment-list');
                    const providerSelect = document.getElementById('provider-select');
                    const sessionSelect = document.getElementById('session-select');
                    const sessionNewBtn = document.getElementById('session-new-btn');
                    const sessionRenameBtn = document.getElementById('session-rename-btn');
                    const sessionDeleteBtn = document.getElementById('session-delete-btn');
                    const sendBtn = document.getElementById('send-btn');
                    const sendBtnContent = document.getElementById('send-btn-content');
                    const sendIcon = document.getElementById('send-icon');
                    const statusText = document.getElementById('status-text');
                    const hintText = document.getElementById('hint-text');

                    let loadingDiv = null;
                    let activeStreamId = null;
                    let activeStreamElements = null;
                    let activeStreamState = null;
                    let isThinking = false;
                    let currentProvider = providerSelect && providerSelect.value === 'claude'
                        ? 'claude'
                        : (providerSelect && providerSelect.value === 'pi' ? 'pi' : 'codex');
                    let newSessionProvider = currentProvider;
                    let activeSessionId = '';
                    let sessions = [];
                    let sessionMessages = [];
                    let selectedAttachments = [];
                    let dragDepth = 0;
                    let hintTimer = null;


`;

export function getWebviewScript(nonce: string): string {
    return `                <script nonce="${nonce}">
` +
        WEBVIEW_SCRIPT_HEADER +
        WEBVIEW_SCRIPT_PARSE +
        WEBVIEW_SCRIPT_RENDER +
        WEBVIEW_SCRIPT_STREAM +
        WEBVIEW_SCRIPT_INPUT +
        `                </script>
`;
}
