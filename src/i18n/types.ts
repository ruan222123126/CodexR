/**
 * Supported languages for the interface
 */
export type SupportedLanguage = 'en' | 'zh-CN';

/**
 * Translation strings interface
 * All UI strings that can be translated
 */
export interface TranslationStrings {
    // Toolbar
    'toolbar.newSession': string;
    'toolbar.settings': string;
    'toolbar.tokenUsage': string;

    // History page
    'history.title': string;
    'history.back': string;
    'history.multiSelect': string;
    'history.exitMultiSelect': string;
    'history.deleteSelected': string;
    'history.exportSelected': string;
    'history.selectAll': string;
    'history.cancelMultiSelect': string;
    'history.searchPlaceholder': string;
    'history.sortNewest': string;
    'history.sortOldest': string;
    'history.noSessions': string;
    'history.untitled': string;
    'history.noMessages': string;
    'history.renameSession': string;
    'history.exportSession': string;
    'history.deleteSession': string;
    'history.selectSession': string;
    'history.justNow': string;
    'history.minAgo': string;
    'history.hAgo': string;
    'history.dAgo': string;

    // Settings page
    'settings.title': string;
    'settings.back': string;
    'settings.searchPlaceholder': string;
    'settings.general': string;
    'settings.display': string;
    'settings.session': string;
    'settings.language': string;
    'settings.languageDesc': string;
    'settings.showToolIndicator': string;
    'settings.showToolIndicatorDesc': string;
    'settings.stepDetailLevel': string;
    'settings.stepDetailLevelDesc': string;
    'settings.stepDetailLevelCompact': string;
    'settings.stepDetailLevelFull': string;
    'settings.thinkingFilter': string;
    'settings.thinkingFilterDesc': string;
    'settings.codexHideThinking': string;
    'settings.codexHideThinkingDesc': string;
    'settings.claudeDisableThinking': string;
    'settings.claudeDisableThinkingDesc': string;
    'settings.piDisableThinking': string;
    'settings.piDisableThinkingDesc': string;
    'settings.codexAutoResume': string;
    'settings.codexAutoResumeDesc': string;
    'settings.claudeAutoResume': string;
    'settings.claudeAutoResumeDesc': string;
    'settings.piAutoResume': string;
    'settings.piAutoResumeDesc': string;
    'settings.titleMode': string;
    'settings.titleModeDesc': string;
    'settings.titleModeCurrentProvider': string;
    'settings.titleModeFixedProvider': string;
    'settings.titleModeFirstMessage': string;
    'settings.titleFixedProvider': string;
    'settings.titleFixedProviderDesc': string;
    'settings.piConfig': string;
    'settings.piModel': string;
    'settings.piModelDesc': string;
    'settings.piApiKey': string;
    'settings.piApiKeyDesc': string;
    'settings.piApiKeyPlaceholder': string;
    'settings.piThinkingLevel': string;
    'settings.piThinkingLevelDesc': string;
    'settings.piThinkingLevelDefault': string;
    // Codex configuration
    'settings.codexConfig': string;
    'settings.codexModel': string;
    'settings.codexModelDesc': string;
    'settings.codexModelPlaceholder': string;
    'settings.codexConfigOverrides': string;
    'settings.codexConfigOverridesDesc': string;
    'settings.codexConfigOverridesPlaceholder': string;
    'settings.codexProfile': string;
    'settings.codexProfileDesc': string;
    'settings.codexProfilePlaceholder': string;
    'settings.codexOss': string;
    'settings.codexOssDesc': string;
    // Codex sandbox and approval settings
    'settings.codexSandboxMode': string;
    'settings.codexSandboxModeDesc': string;
    'settings.codexSandboxModeDefault': string;
    'settings.codexSandboxModeReadOnly': string;
    'settings.codexSandboxModeWorkspaceWrite': string;
    'settings.codexSandboxModeDangerFullAccess': string;
    'settings.codexApprovalPolicy': string;
    'settings.codexApprovalPolicyDesc': string;
    'settings.codexApprovalPolicyDefault': string;
    'settings.codexApprovalPolicyUntrusted': string;
    'settings.codexApprovalPolicyOnFailure': string;
    'settings.codexApprovalPolicyNever': string;
    'settings.codexFullAuto': string;
    'settings.codexFullAutoDesc': string;
    // Claude configuration
    'settings.claudeConfig': string;
    'settings.claudeModel': string;
    'settings.claudeModelDesc': string;
    'settings.claudeModelPlaceholder': string;
    'settings.claudeAgent': string;
    'settings.claudeAgentDesc': string;
    'settings.claudeAgentPlaceholder': string;
    'settings.claudeTools': string;
    'settings.claudeToolsDesc': string;
    'settings.claudeToolsPlaceholder': string;
    'settings.claudePermissionMode': string;
    'settings.claudePermissionModeDesc': string;
    'settings.claudePermissionModeDangerouslySkip': string;
    'settings.claudePermissionModeAllowDangerouslySkip': string;
    'settings.claudePermissionModeDefault': string;
    // Open config buttons
    'settings.openConfig': string;
    'settings.openConfigDesc': string;

    // Input area
    'input.placeholder': string;
    'input.placeholderThinking': string;
    'input.addAttachment': string;
    'input.sendMessage': string;
    'input.recentTasks': string;
    'input.viewAll': string;
    'input.collapseRecentTasks': string;
    'input.expandRecentTasks': string;
    'input.noRecentTasks': string;
    'input.sessionProvider': string;

    // Status
    'status.ready': string;
    'status.thinking': string;
    'status.clickToStop': string;
    'status.modalTitle': string;
    'status.refresh': string;
    'status.close': string;
    'status.mcpServers': string;
    'status.extensions': string;
    'status.loading': string;
    'status.noItems': string;

    // Messages
    'message.thinkingProcess': string;
    'message.requestCanceled': string;
    'message.requestTimedOut': string;
    'message.waitingForOutput': string;
    'message.sessionOperationFailed': string;
    'message.attachmentLimitHint': string;
    'message.emptyTitleError': string;
    'message.copy': string;
    'message.copied': string;
}
