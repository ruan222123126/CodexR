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
                    const providerSelectWrap = document.getElementById('provider-select-wrap');
                    const providerSelectTrigger = document.getElementById('provider-select-trigger');
                    const providerSelectLabel = document.getElementById('provider-select-label');
                    const providerSelectMenu = document.getElementById('provider-select-menu');
                    const providerSelectOptions = Array.from(document.querySelectorAll('[data-provider-option]'));
                    const sessionSelect = document.getElementById('session-select');
                    const sessionViewAllBtn = document.getElementById('session-view-all-btn');
                    const sessionNewBtn = document.getElementById('session-new-btn');
                    const sessionRenameBtn = document.getElementById('session-rename-btn');
                    const sessionDeleteBtn = document.getElementById('session-delete-btn');
                    const addSessionBtn = document.getElementById('add-session-btn');
                    const historyPage = document.getElementById('history-page');
                    const historyBackBtn = document.getElementById('history-back-btn');
                    const historySearchInput = document.getElementById('history-search-input');
                    const historyWorkspaceFilter = document.getElementById('history-workspace-filter');
                    const historySortBtn = document.getElementById('history-sort-btn');
                    const historyList = document.getElementById('history-list');
                    const historyMultiSelectBtn = document.getElementById('history-multi-select-btn');
                    const historyMultiActions = document.getElementById('history-multi-actions');
                    const historySelectedCount = document.getElementById('history-selected-count');
                    const historyMultiDeleteBtn = document.getElementById('history-multi-delete-btn');
                    const historyMultiExportBtn = document.getElementById('history-multi-export-btn');
                    const historyMultiCancelBtn = document.getElementById('history-multi-cancel-btn');
                    let historySortOrder = 'updated-desc';
                    let isMultiSelectMode = false;
                    let selectedSessionIds = new Set();
                    const sendBtn = document.getElementById('send-btn');
                    const sendBtnContent = document.getElementById('send-btn-content');
                    const sendIcon = document.getElementById('send-icon');
                    const statusText = document.getElementById('status-text');
                    const hintText = document.getElementById('hint-text');
                    const toolbarTitle = document.getElementById('toolbar-title');
                    const HOME_TITLE = 'codeR';

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
                    let historySearchText = '';
                    let historyWorkspaceValue = 'all';
                    let historySortValue = 'updated-desc';
                    let historyMode = false;
                    let isHomeMode = false;
                    let selectedAttachments = [];
                    let dragDepth = 0;
                    let hintTimer = null;
                    let showToolUsageIndicator = true;
                    let codexThinkingNoiseFilterEnabled = true;


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
