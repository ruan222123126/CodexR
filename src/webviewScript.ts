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
                    const settingsBtn = document.getElementById('settings-btn');
                    const settingsPage = document.getElementById('settings-page');
                    const settingsBackBtn = document.getElementById('settings-back-btn');
                    const settingsLanguage = document.getElementById('settings-language');
                    const settingsLanguageWrap = document.getElementById('settings-language-wrap');
                    const settingsLanguageTrigger = document.getElementById('settings-language-trigger');
                    const settingsLanguageLabel = document.getElementById('settings-language-label');
                    const settingsLanguageMenu = document.getElementById('settings-language-menu');
                    const settingsShowToolIndicator = document.getElementById('settings-show-tool-indicator');
                    const settingsThinkingFilter = document.getElementById('settings-thinking-filter');
                    const settingsCodexHideThinking = document.getElementById('settings-codex-hide-thinking');
                    const settingsClaudeDisableThinking = document.getElementById('settings-claude-disable-thinking');
                    const settingsPiDisableThinking = document.getElementById('settings-pi-disable-thinking');
                    const settingsCodexAutoResume = document.getElementById('settings-codex-auto-resume');
                    const settingsClaudeAutoResume = document.getElementById('settings-claude-auto-resume');
                    const settingsPiAutoResume = document.getElementById('settings-pi-auto-resume');
                    const settingsTitleMode = document.getElementById('settings-title-mode');
                    const settingsTitleModeWrap = document.getElementById('settings-title-mode-wrap');
                    const settingsTitleModeTrigger = document.getElementById('settings-title-mode-trigger');
                    const settingsTitleModeLabel = document.getElementById('settings-title-mode-label');
                    const settingsTitleModeMenu = document.getElementById('settings-title-mode-menu');
                    const settingsTitleFixedProvider = document.getElementById('settings-title-fixed-provider');
                    const settingsTitleFixedProviderWrap = document.getElementById('settings-title-fixed-provider-wrap');
                    const settingsTitleFixedProviderTrigger = document.getElementById('settings-title-fixed-provider-trigger');
                    const settingsTitleFixedProviderLabel = document.getElementById('settings-title-fixed-provider-label');
                    const settingsTitleFixedProviderMenu = document.getElementById('settings-title-fixed-provider-menu');
                    const settingsTitleFixedProviderItem = document.getElementById('settings-title-fixed-provider-item');
                    const settingsPiModel = document.getElementById('settings-pi-model');
                    const settingsPiApiKey = document.getElementById('settings-pi-api-key');
                    const settingsPiThinkingLevel = document.getElementById('settings-pi-thinking-level');
                    const settingsPiThinkingLevelWrap = document.getElementById('settings-pi-thinking-level-wrap');
                    const settingsPiThinkingLevelTrigger = document.getElementById('settings-pi-thinking-level-trigger');
                    const settingsPiThinkingLevelLabel = document.getElementById('settings-pi-thinking-level-label');
                    const settingsPiThinkingLevelMenu = document.getElementById('settings-pi-thinking-level-menu');
                    const settingsCodexModel = document.getElementById('settings-codex-model');
                    const settingsCodexConfigOverrides = document.getElementById('settings-codex-config-overrides');
                    const settingsCodexProfile = document.getElementById('settings-codex-profile');
                    const settingsCodexOss = document.getElementById('settings-codex-oss');
                    const settingsCodexSandboxMode = document.getElementById('settings-codex-sandbox-mode');
                    const settingsCodexSandboxModeWrap = document.getElementById('settings-codex-sandbox-mode-wrap');
                    const settingsCodexSandboxModeTrigger = document.getElementById('settings-codex-sandbox-mode-trigger');
                    const settingsCodexSandboxModeLabel = document.getElementById('settings-codex-sandbox-mode-label');
                    const settingsCodexSandboxModeMenu = document.getElementById('settings-codex-sandbox-mode-menu');
                    const settingsCodexApprovalPolicy = document.getElementById('settings-codex-approval-policy');
                    const settingsCodexApprovalPolicyWrap = document.getElementById('settings-codex-approval-policy-wrap');
                    const settingsCodexApprovalPolicyTrigger = document.getElementById('settings-codex-approval-policy-trigger');
                    const settingsCodexApprovalPolicyLabel = document.getElementById('settings-codex-approval-policy-label');
                    const settingsCodexApprovalPolicyMenu = document.getElementById('settings-codex-approval-policy-menu');
                    const settingsCodexFullAuto = document.getElementById('settings-codex-full-auto');
                    const settingsClaudeModel = document.getElementById('settings-claude-model');
                    const settingsClaudeAgent = document.getElementById('settings-claude-agent');
                    const settingsClaudeTools = document.getElementById('settings-claude-tools');
                    const settingsClaudePermissionMode = document.getElementById('settings-claude-permission-mode');
                    const settingsClaudePermissionModeWrap = document.getElementById('settings-claude-permission-mode-wrap');
                    const settingsClaudePermissionModeTrigger = document.getElementById('settings-claude-permission-mode-trigger');
                    const settingsClaudePermissionModeLabel = document.getElementById('settings-claude-permission-mode-label');
                    const settingsClaudePermissionModeMenu = document.getElementById('settings-claude-permission-mode-menu');
                    const settingsStepDetailLevel = document.getElementById('settings-step-detail-level');
                    const settingsStepDetailLevelWrap = document.getElementById('settings-step-detail-level-wrap');
                    const settingsStepDetailLevelTrigger = document.getElementById('settings-step-detail-level-trigger');
                    const settingsStepDetailLevelLabel = document.getElementById('settings-step-detail-level-label');
                    const settingsStepDetailLevelMenu = document.getElementById('settings-step-detail-level-menu');
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
                    const historyMultiSelectAllBtn = document.getElementById('history-multi-select-all-btn');
                    const settingsSearchInput = document.getElementById('settings-search-input');
                    const recentTasksPanel = document.getElementById('recent-tasks-panel');
                    const recentTasksToggleBtn = document.getElementById('recent-tasks-toggle-btn');
                    const sessionHeader = document.getElementById('session-header');
                    const recentTasksList = document.getElementById('recent-tasks-list');
                    const statusBtn = document.getElementById('status-btn');
                    const statusModal = document.getElementById('status-modal');
                    const statusModalClose = document.getElementById('status-modal-close');
                    const statusModalRefresh = document.getElementById('status-modal-refresh');
                    const claudeStatusIndicator = document.getElementById('claude-status-indicator');
                    const codexStatusIndicator = document.getElementById('codex-status-indicator');
                    const piStatusIndicator = document.getElementById('pi-status-indicator');
                    const claudeMcpList = document.getElementById('claude-mcp-list');
                    const codexMcpList = document.getElementById('codex-mcp-list');
                    const piExtList = document.getElementById('pi-ext-list');
                    const settingsPiOpenConfig = document.getElementById('settings-pi-open-config');
                    const settingsCodexOpenConfig = document.getElementById('settings-codex-open-config');
                    const settingsClaudeOpenConfig = document.getElementById('settings-claude-open-config');
                    let isMultiSelectMode = false;
                    let selectedSessionIds = new Set();
                    const sendBtn = document.getElementById('send-btn');
                    const sendBtnContent = document.getElementById('send-btn-content');
                    const sendIcon = document.getElementById('send-icon');
                    const statusText = document.getElementById('status-text');
                    const hintText = document.getElementById('hint-text');
                    const toolbarTitle = document.getElementById('toolbar-title');
                    const tokenCounter = document.getElementById('token-counter');
                    const tokenCounterValue = document.getElementById('token-counter-value');
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
                    let settingsMode = false;
                    let isHomeMode = false;
                    let recentTasksCollapsed = false;
                    let selectedAttachments = [];
                    let dragDepth = 0;
                    let hintTimer = null;
                    let showToolUsageIndicator = true;
                    let codexThinkingNoiseFilterEnabled = true;
                    let stepDetailLevel = 'compact';
                    let translations = window.__TRANSLATIONS__ || {};
                    let currentLanguage = window.__LANGUAGE__ || 'en';
                    let currentTokenUsage = 0;


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
