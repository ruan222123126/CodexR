import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';
import { SessionManager } from './providers/session-manager';
import { MessageHandler } from './providers/message-handler';
import { AttachmentManager } from './providers/attachment-manager';
import { ProviderBuilder } from './providers/provider-builder';
import { TitleGenerator } from './providers/title-generator';
import { SessionStorage } from './providers/storage';
import { Executor, type ExecutorDeps, type ExecutorCallbacks } from './providers/executor';
import { Config } from './providers/config';
import { createId, createSession, getWorkspaceDir } from './providers/utils';
import { getTranslations, normalizeLanguage, type SupportedLanguage } from './i18n';
import type {
    ChatSession,
    NormalizedInput,
    ProviderType,
} from './providers/types';

export class CodexProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codex.chatView';

    private _view?: vscode.WebviewView;
    private _sessions: ChatSession[] = [];
    private _activeSessionId = '';
    private _shouldShowHome = false;

    private readonly sessionManager: SessionManager;
    private readonly messageHandler: MessageHandler;
    private readonly attachmentManager: AttachmentManager;
    private readonly providerBuilder: ProviderBuilder;
    private readonly titleGenerator: TitleGenerator;
    private readonly sessionStorage: SessionStorage;
    private readonly executor: Executor;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
    ) {
        this.sessionStorage = new SessionStorage(
            this._context,
            Config.normalizeProvider,
        );

        const initialState = this.sessionStorage.load(
            () => createSession('codex'),
            (raw) => this.sessionStorage.parsePersistedState(raw),
        );
        this._sessions = initialState.sessions;
        this._activeSessionId = initialState.activeSessionId;
        this._shouldShowHome = initialState.isNewWorkspace;

        this.sessionManager = new SessionManager(
            createId,
            (type, value) => this.postToWebview(type, value),
            () => this.persistSessionStore(),
            () => this.cancelExecution(),
        );

        this.messageHandler = new MessageHandler(createId);
        this.attachmentManager = new AttachmentManager();

        this.providerBuilder = new ProviderBuilder(
            createId,
            Config.shouldAutoResumeCodexSession,
            Config.shouldAutoResumeClaudeSession,
            Config.shouldAutoResumePiSession,
            Config.shouldDisableClaudeThinking,
            Config.shouldDisablePiThinking,
        );

        this.titleGenerator = new TitleGenerator(
            createId,
            () => this.persistSessionStore(),
            () => this.publishSessionState(),
        );

        const executorDeps: ExecutorDeps = {
            postToWebview: (type, value) => this.postToWebview(type, value),
            buildProviderCommand: (session) => this.providerBuilder.buildProviderCommand(session),
            isCommandAvailable: (command, versionArgs, cwd) => this.providerBuilder.isCommandAvailable(command, versionArgs, cwd),
            buildPromptWithAttachments: (prompt, attachments) => this.attachmentManager.buildPromptWithAttachments(prompt, attachments),
            shouldInjectRecentContext: (session, usesNativeSession) => this.providerBuilder.shouldInjectRecentContext(session, usesNativeSession),
            injectRecentConversationContext: (session, currentPrompt) => this.providerBuilder.injectRecentConversationContext(session, currentPrompt),
            injectCodexCheckpointPolicy: (prompt) => this.providerBuilder.injectCodexCheckpointPolicy(prompt),
            getParserMode: Config.getParserMode,
            shouldEnableCodexThinkingNoiseFilter: Config.shouldEnableCodexThinkingNoiseFilter,
            markNativeSessionFallbackIfNeeded: (session, providerCommand, cliError, rawOutput, code) =>
                this.providerBuilder.markNativeSessionFallbackIfNeeded(
                    session,
                    providerCommand,
                    cliError,
                    rawOutput,
                    code,
                    (s, text) => this.messageHandler.appendSystemMessage(s, text),
                ),
        };

        const executorCallbacks: ExecutorCallbacks = {
            onExecutionStart: (session) => {
                this.updateSession(session);
            },
            onExecutionComplete: (session, thought, content, segments) => {
                const updated = this.messageHandler.appendAssistantMessage(session, thought, content, segments);
                this.updateSession(updated);

                if (this.titleGenerator.shouldAutoGenerateSessionTitle(updated)) {
                    const workspaceDir = getWorkspaceDir();
                    void this.titleGenerator.maybeAutoGenerateSessionTitle(updated, workspaceDir).then(result => {
                        if (result) {
                            this.updateSession(result);
                        }
                    });
                }

                return updated;
            },
            onExecutionError: (session, error) => {
                const updated = this.messageHandler.appendSystemMessage(session, error);
                if (updated) {
                    this.updateSession(updated);
                }
                return updated ?? session;
            },
        };

        this.executor = new Executor(executorDeps, executorCallbacks);
    }

    private updateSession(session: ChatSession): void {
        const index = this._sessions.findIndex(s => s.id === session.id);
        if (index !== -1) {
            this._sessions[index] = session;
        } else {
            this._sessions.push(session);
        }
        this.persistSessionStore();
        this.publishSessionState();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };

        webviewView.webview.html = getWebviewHtml(webviewView.webview, this._extensionUri);

        webviewView.webview.onDidReceiveMessage(async data => {
            if (!data || typeof data !== 'object') {
                return;
            }

            if (data.type === 'userInput') {
                const normalized = this.normalizeUserInput(data.value);
                if (!normalized) {
                    return;
                }
                await this.executePrompt(normalized);
                return;
            }

            if (data.type === 'pickAttachments') {
                await this.attachmentManager.pickAttachments((type, value) => this.postToWebview(type, value));
                return;
            }

            if (data.type === 'cancel') {
                this.executor.cancelExecution();
                return;
            }

            if (data.type === 'session-list-request') {
                this.publishSessionState();
                return;
            }

            if (data.type === 'session-create') {
                const result = this.sessionManager.handleCreateSession(
                    this._sessions,
                    data.value,
                    Config.normalizeProvider,
                );
                this._sessions = result.newSessions;
                this._activeSessionId = result.newActiveSessionId;
                this.persistSessionStore();
                this.publishSessionState();
                return;
            }

            if (data.type === 'session-switch') {
                const result = this.sessionManager.handleSwitchSession(
                    this._sessions,
                    this._activeSessionId,
                    data.value,
                );
                if (result.newActiveSessionId !== null) {
                    this.executor.cancelExecution();
                    this._activeSessionId = result.newActiveSessionId;
                    this.persistSessionStore();
                    this.publishSessionState();
                }
                return;
            }

            if (data.type === 'session-provider-update') {
                this._sessions = this.sessionManager.handleSessionProviderUpdate(
                    this._sessions,
                    data.value,
                    Config.normalizeProvider,
                    createId,
                );
                this.persistSessionStore();
                this.publishSessionState();
                return;
            }

            if (data.type === 'session-rename') {
                this._sessions = this.sessionManager.handleRenameSession(this._sessions, data.value);
                this.persistSessionStore();
                this.publishSessionState();
                return;
            }

            if (data.type === 'session-rename-request') {
                const result = await this.sessionManager.handleRenameSessionRequest(this._sessions, data.value);
                if (result) {
                    this._sessions = result;
                    this.persistSessionStore();
                    this.publishSessionState();
                }
                return;
            }

            if (data.type === 'session-delete') {
                const activeSession = this.getActiveSession();
                const result = this.sessionManager.handleDeleteSession(
                    this._sessions,
                    this._activeSessionId,
                    activeSession?.provider ?? 'codex',
                    data.value,
                );
                if (result.newActiveSessionId !== this._activeSessionId) {
                    this.executor.cancelExecution();
                }
                this._sessions = result.newSessions;
                this._activeSessionId = result.newActiveSessionId;
                this.persistSessionStore();
                this.publishSessionState();
                return;
            }

            if (data.type === 'session-delete-request') {
                const activeSession = this.getActiveSession();
                const result = await this.sessionManager.handleDeleteSessionRequest(
                    this._sessions,
                    this._activeSessionId,
                    activeSession?.provider ?? 'codex',
                    data.value,
                );
                if (result) {
                    if (result.newActiveSessionId !== this._activeSessionId) {
                        this.executor.cancelExecution();
                    }
                    this._sessions = result.newSessions;
                    this._activeSessionId = result.newActiveSessionId;
                    this.persistSessionStore();
                    this.publishSessionState();
                }
                return;
            }

            if (data.type === 'session-export') {
                await this.sessionManager.handleExportSession(this._sessions, data.value);
                return;
            }

            if (data.type === 'session-multi-delete') {
                const activeSession = this.getActiveSession();
                const result = await this.sessionManager.handleMultiDeleteSession(
                    this._sessions,
                    this._activeSessionId,
                    activeSession?.provider ?? 'codex',
                    data.value,
                );
                if (result && result.newActiveSessionId !== this._activeSessionId) {
                    this.executor.cancelExecution();
                }
                if (result) {
                    this._sessions = result.newSessions;
                    this._activeSessionId = result.newActiveSessionId;
                    this.persistSessionStore();
                    this.publishSessionState();
                }
                return;
            }

            if (data.type === 'session-multi-export') {
                await this.sessionManager.handleMultiExportSession(this._sessions, data.value);
                return;
            }

            if (data.type === 'settings-request') {
                this.postToWebview('settings-data', {
                    showToolUsageIndicator: Config.shouldShowToolUsageIndicator(),
                    codexThinkingNoiseFilterEnabled: Config.shouldEnableCodexThinkingNoiseFilter(),
                    codexHideThinking: Config.shouldHideCodexThinking(),
                    codexAutoResumeSession: Config.shouldAutoResumeCodexSession(),
                    claudeAutoResumeSession: Config.shouldAutoResumeClaudeSession(),
                    claudeDisableThinking: Config.shouldDisableClaudeThinking(),
                    piAutoResumeSession: Config.shouldAutoResumePiSession(),
                    piDisableThinking: Config.shouldDisablePiThinking(),
                    titleGenerationMode: Config.getTitleGenerationMode(),
                    titleFixedProvider: Config.getTitleFixedProvider(),
                    language: Config.getLanguage(),
                });
                return;
            }

            if (data.type === 'settings-update') {
                const { key, value } = data.value || {};
                if (key && value !== undefined) {
                    await this.updateSetting(key, value);
                    if (key === 'language') {
                        const lang = normalizeLanguage(value);
                        const translations = getTranslations(lang);
                        this.postToWebview('translations-update', { language: lang, translations });
                    }
                }
                return;
            }
        });

        this.postToWebview('provider-init', {
            provider: this.getActiveSession()?.provider ?? 'codex',
            showToolUsageIndicator: Config.shouldShowToolUsageIndicator(),
            codexThinkingNoiseFilterEnabled: Config.shouldEnableCodexThinkingNoiseFilter(),
        });

        this.publishSessionState();
    }

    public async restoreLatestCheckpoint(): Promise<void> {
        await vscode.window.showInformationMessage('Checkpoint restore is temporarily unavailable in this build.');
    }

    public async restoreCheckpointInteractive(): Promise<void> {
        await vscode.window.showInformationMessage('Checkpoint restore is temporarily unavailable in this build.');
    }

    private postToWebview(type: string, value: unknown) {
        this._view?.webview.postMessage({ type, value });
    }

    private async updateSetting(key: string, value: unknown): Promise<void> {
        const config = vscode.workspace.getConfiguration('codexSidebar');
        try {
            await config.update(key, value, vscode.ConfigurationTarget.Global);
        } catch {
            // Ignore errors
        }
    }

    private normalizeUserInput(value: unknown): NormalizedInput | null {
        if (typeof value === 'string') {
            const prompt = value.trim();
            if (!prompt) {
                return null;
            }
            return {
                prompt,
                provider: this.getActiveSession()?.provider ?? 'codex',
                attachments: [],
                sessionId: this._activeSessionId || undefined,
            };
        }

        if (!value || typeof value !== 'object') {
            return null;
        }

        const payload = value as {
            prompt?: unknown;
            provider?: unknown;
            attachments?: unknown;
            sessionId?: unknown;
            startFromHome?: unknown;
        };

        if (typeof payload.prompt !== 'string') {
            return null;
        }

        const prompt = payload.prompt.trim();
        if (!prompt) {
            return null;
        }

        const sessionId = typeof payload.sessionId === 'string' && payload.sessionId.trim()
            ? payload.sessionId.trim()
            : undefined;

        return {
            prompt,
            provider: Config.normalizeProvider(payload.provider),
            attachments: this.attachmentManager.normalizeAttachments(payload.attachments),
            sessionId,
            startFromHome: payload.startFromHome === true,
        };
    }

    private cancelExecution(): void {
        this.executor.cancelExecution();
    }

    private async executePrompt(input: NormalizedInput) {
        const result = this.sessionManager.resolveTargetSession(
            this._sessions,
            this._activeSessionId,
            input.sessionId,
            input.provider,
            input.startFromHome === true,
        );

        let session = result.session;
        const newActiveSessionId = result.newActiveSessionId;

        if (newActiveSessionId !== this._activeSessionId) {
            this._sessions.push(session);
            this._activeSessionId = newActiveSessionId;
            this.persistSessionStore();
            this.publishSessionState();
        }

        const updatedSession = this.messageHandler.appendUserMessage(session, input.prompt, input.attachments);
        this.updateSession(updatedSession);

        const workspaceDir = getWorkspaceDir();
        const finalSession = await this.executor.executePrompt(updatedSession, input);

        if (this.titleGenerator.shouldAutoGenerateSessionTitle(finalSession)) {
            const titleUpdated = await this.titleGenerator.maybeAutoGenerateSessionTitle(finalSession, workspaceDir);
            if (titleUpdated) {
                this.updateSession(titleUpdated);
            }
        }
    }

    private publishSessionState() {
        const showHome = this._shouldShowHome;
        if (this._shouldShowHome) {
            this._shouldShowHome = false;
        }
        this.sessionManager.publishSessionState(this._sessions, this._activeSessionId, showHome);
    }

    private persistSessionStore() {
        this.sessionStorage.save(this._sessions, this._activeSessionId);
    }

    private getActiveSession(): ChatSession | undefined {
        if (!this._activeSessionId) {
            return undefined;
        }

        return this._sessions.find(item => item.id === this._activeSessionId);
    }
}
