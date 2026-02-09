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
    'settings.general': string;
    'settings.display': string;
    'settings.session': string;
    'settings.language': string;
    'settings.languageDesc': string;
    'settings.showToolIndicator': string;
    'settings.showToolIndicatorDesc': string;
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

    // Messages
    'message.thinkingProcess': string;
    'message.requestCanceled': string;
    'message.requestTimedOut': string;
    'message.waitingForOutput': string;
    'message.sessionOperationFailed': string;
    'message.attachmentLimitHint': string;
    'message.emptyTitleError': string;
}
