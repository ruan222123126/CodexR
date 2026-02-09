import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { extractCodexSessionId, parseCodexOutput } from './codexOutputParser';
import {
    consumeClaudeStreamChunk,
    createClaudeStreamAccumulator,
    finalizeClaudeStream,
} from './claudeOutputParser';
import {
    consumePiStreamChunk,
    createPiStreamAccumulator,
    finalizePiStream,
} from './piOutputParser';
import {
    buildAnswerTextFromSegments,
    buildThoughtTextFromSegments,
    type StreamSegment,
} from './streamTypes';
import { getWebviewHtml } from './webviewHtml';

type ProviderType = 'codex' | 'claude' | 'pi';
type MessageRole = 'user' | 'assistant' | 'system';

type AttachmentItem = {
    path: string;
    name: string;
    size?: number;
};

type NormalizedInput = {
    prompt: string;
    provider: ProviderType;
    attachments: AttachmentItem[];
    sessionId?: string;
    startFromHome?: boolean;
};

type ChatMessage = {
    id: string;
    role: MessageRole;
    prompt?: string;
    thought?: string;
    content?: string;
    segments?: StreamSegment[];
    attachments?: AttachmentItem[];
    createdAt: number;
};

type ChatSession = {
    id: string;
    title: string;
    provider: ProviderType;
    backendSessionId?: string;
    needsBootstrapContext?: boolean;
    createdAt: number;
    updatedAt: number;
    messages: ChatMessage[];
};

type SessionStoreState = {
    version: number;
    activeSessionId: string;
    sessions: ChatSession[];
};

type ProviderCommand = {
    command: string;
    args: string[];
    promptViaStdin: boolean;
    versionArgs: string[];
    usesNativeSession: boolean;
};

type SessionSummary = {
    id: string;
    title: string;
    provider: ProviderType;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
    workspacePath: string;
    previewText: string;
};

type BackupRecord = {
    failedAt: string;
    reason: string;
    raw: unknown;
};

const SESSION_STORE_VERSION = 1;
type ParserMode = 'v2' | 'legacy';

export class CodexProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codex.chatView';
    private static readonly REQUEST_TIMEOUT_MS = 8 * 60 * 1000;
    private static readonly MAX_ATTACHMENT_COUNT = 8;
    private static readonly MAX_ATTACHMENT_CHARS_PER_FILE = 12_000;
    private static readonly MAX_ATTACHMENT_CHARS_TOTAL = 50_000;
    private static readonly CONTEXT_RECENT_ROUNDS = 10;
    private static readonly TITLE_GENERATION_TIMEOUT_MS = 45_000;

    private _view?: vscode.WebviewView;
    private _activeChild?: cp.ChildProcess;
    private _activeRequestId = 0;

    private readonly _storageKey: string;
    private _sessions: ChatSession[] = [];
    private _activeSessionId = '';

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
    ) {
        this._storageKey = this.buildStorageKey();
        this.loadSessionStore();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };

        const defaultProvider = this.getDefaultProvider();
        webviewView.webview.html = getWebviewHtml(webviewView.webview, this._extensionUri, defaultProvider);

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
                await this.pickAttachments();
                return;
            }

            if (data.type === 'cancel') {
                this.cancelExecution();
                return;
            }

            if (data.type === 'session-list-request') {
                this.publishSessionState();
                return;
            }

            if (data.type === 'session-create') {
                this.handleCreateSession(data.value);
                return;
            }

            if (data.type === 'session-switch') {
                this.handleSwitchSession(data.value);
                return;
            }

            if (data.type === 'session-provider-update') {
                this.handleSessionProviderUpdate(data.value);
                return;
            }

            if (data.type === 'session-rename') {
                this.handleRenameSession(data.value);
                return;
            }

            if (data.type === 'session-rename-request') {
                await this.handleRenameSessionRequest(data.value);
                return;
            }

            if (data.type === 'session-delete') {
                this.handleDeleteSession(data.value);
                return;
            }

            if (data.type === 'session-delete-request') {
                await this.handleDeleteSessionRequest(data.value);
                return;
            }

            if (data.type === 'session-export') {
                await this.handleExportSession(data.value);
            }

            if (data.type === 'session-multi-delete') {
                await this.handleMultiDeleteSession(data.value);
                return;
            }

            if (data.type === 'session-multi-export') {
                await this.handleMultiExportSession(data.value);
                return;
            }
        });

        this.postToWebview('provider-init', {
            provider: this.getActiveSession()?.provider ?? defaultProvider,
            showToolUsageIndicator: this.shouldShowToolUsageIndicator(),
            codexThinkingNoiseFilterEnabled: this.shouldEnableCodexThinkingNoiseFilter(),
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

    private getDefaultProvider(): ProviderType {
        const configured = vscode.workspace.getConfiguration('codexSidebar').get<string>('defaultProvider', 'codex');
        if (configured === 'claude') {
            return 'claude';
        }
        if (configured === 'pi') {
            return 'pi';
        }
        return 'codex';
    }

    private getParserMode(): ParserMode {
        const configured = vscode.workspace.getConfiguration('codexSidebar').get<string>('parserMode', 'v2');
        return configured === 'legacy' ? 'legacy' : 'v2';
    }

    private shouldShowToolUsageIndicator(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('showToolUsageIndicator', true);
    }

    private shouldEnableCodexThinkingNoiseFilter(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('codexThinkingNoiseFilterEnabled', true);
    }

    private normalizeProvider(value: unknown): ProviderType {
        if (value === 'claude') {
            return 'claude';
        }
        if (value === 'pi') {
            return 'pi';
        }
        return 'codex';
    }

    private normalizeUserInput(value: unknown): NormalizedInput | null {
        if (typeof value === 'string') {
            const prompt = value.trim();
            if (!prompt) {
                return null;
            }
            return {
                prompt,
                provider: this.getDefaultProvider(),
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
            provider: this.normalizeProvider(payload.provider),
            attachments: this.normalizeAttachments(payload.attachments),
            sessionId,
            startFromHome: payload.startFromHome === true,
        };
    }

    private normalizeAttachments(value: unknown): AttachmentItem[] {
        if (!Array.isArray(value)) {
            return [];
        }

        const byPath = new Map<string, AttachmentItem>();
        for (const item of value) {
            if (!item || typeof item !== 'object') {
                continue;
            }

            const raw = item as { path?: unknown; name?: unknown; size?: unknown };
            const filePath = typeof raw.path === 'string' ? raw.path.trim() : '';
            if (!filePath) {
                continue;
            }

            const name = typeof raw.name === 'string' && raw.name.trim()
                ? raw.name.trim()
                : path.basename(filePath);

            const size = typeof raw.size === 'number' && Number.isFinite(raw.size) && raw.size >= 0
                ? raw.size
                : undefined;

            byPath.set(filePath, { path: filePath, name, size });
            if (byPath.size >= CodexProvider.MAX_ATTACHMENT_COUNT) {
                break;
            }
        }

        return Array.from(byPath.values());
    }

    private async pickAttachments() {
        const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        const selected = await vscode.window.showOpenDialog({
            canSelectMany: true,
            canSelectFiles: true,
            canSelectFolders: false,
            defaultUri: workspaceUri,
            openLabel: 'Attach',
        });

        if (!selected || selected.length === 0) {
            return;
        }

        const attachments: AttachmentItem[] = [];
        for (const uri of selected) {
            try {
                const stat = await vscode.workspace.fs.stat(uri);
                attachments.push({
                    path: uri.fsPath,
                    name: path.basename(uri.fsPath),
                    size: stat.size,
                });
            } catch {
                attachments.push({
                    path: uri.fsPath,
                    name: path.basename(uri.fsPath),
                });
            }
        }

        this.postToWebview('attachments-update', { attachments });
    }

    private cancelExecution() {
        if (this._activeChild && !this._activeChild.killed) {
            const previousRequestId = this._activeRequestId;
            this._activeChild.kill();
            this.postToWebview('stream-end', {
                requestId: previousRequestId,
                canceled: true,
            });
            this._activeChild = undefined;
        }
    }

    private async executePrompt(input: NormalizedInput) {
        const session = this.resolveTargetSession(input.sessionId, input.provider, input.startFromHome === true);
        if (!session) {
            this.emitSessionError('No active session available.');
            return;
        }

        const provider = session.provider;

        this.appendUserMessage(session, input.prompt, input.attachments);
        this.persistSessionStore();
        this.publishSessionState();

        if (this._activeChild && !this._activeChild.killed) {
            const previousRequestId = this._activeRequestId;
            this._activeChild.kill();
            this.postToWebview('stream-end', {
                requestId: previousRequestId,
                canceled: true,
            });
        }

        const requestId = ++this._activeRequestId;

        this.postToWebview('stream-start', {
            requestId,
            sessionId: session.id,
        });

        if (provider === 'claude') {
            this.postToWebview('system', 'Thinking with Claude...');
        } else if (provider === 'pi') {
            this.postToWebview('system', 'Thinking with Pi...');
        } else if (session.backendSessionId) {
            this.postToWebview('system', 'Resuming Codex session...');
        } else {
            this.postToWebview('system', 'Thinking with Codex...');
        }

        let workspaceDir = os.homedir();
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            workspaceDir = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }

        const providerCommand = this.buildProviderCommand(session);
        if (!this.isCommandAvailable(providerCommand.command, providerCommand.versionArgs, workspaceDir)) {
            const installHint = provider === 'claude'
                ? 'Claude CLI not found. Install Claude Code and ensure `claude` is in your PATH.'
                : (provider === 'pi'
                    ? 'Pi CLI not found. Install Pi CLI and ensure `pi` is in your PATH.'
                    : 'Codex CLI not found. Install Codex CLI and ensure `codex` is in your PATH.');

            this.postToWebview('stream-end', {
                requestId,
                failed: true,
                error: installHint,
                sessionId: session.id,
            });
            this.postToWebview('done', '');

            this.appendSystemMessage(session, installHint);
            this.persistSessionStore();
            this.publishSessionState();
            return;
        }

        let promptWithContext = this.buildPromptWithAttachments(input.prompt, input.attachments);

        if (this.shouldInjectRecentContext(session, providerCommand.usesNativeSession)) {
            promptWithContext = this.injectRecentConversationContext(session, promptWithContext);
        }

        if (provider === 'codex') {
            promptWithContext = this.injectCodexCheckpointPolicy(promptWithContext);
        }

        const child = cp.spawn(providerCommand.command, providerCommand.args, {
            shell: true,
            cwd: workspaceDir,
            env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
        });

        this._activeChild = child;

        if (providerCommand.promptViaStdin && child.stdin) {
            child.stdin.write(promptWithContext + '\n');
            child.stdin.end();
        }

        let stdoutBuffer = '';
        let stderrBuffer = '';
        let lastThought = '';
        let lastContent = '';
        let finalSegments: StreamSegment[] = [];
        let lastSegmentsSnapshot = '';
        let flushTimer: NodeJS.Timeout | undefined;
        let endedByTimeout = false;
        const parserMode = this.getParserMode();
        const codexThinkingNoiseFilterEnabled = this.shouldEnableCodexThinkingNoiseFilter();

        const parseCodex = (text: string, strictRoleSplit = false) => parseCodexOutput(text, {
            strictRoleSplit,
            filterThinkingNoise: codexThinkingNoiseFilterEnabled,
        });

        const claudeAccumulator = createClaudeStreamAccumulator();
        let claudeLastError = '';
        let claudeRawOutput = '';

        const piAccumulator = createPiStreamAccumulator();
        let piLastError = '';

        const emitStreamUpdate = (thought: string, content: string, segments: StreamSegment[]) => {
            finalSegments = segments;
            this.postToWebview('stream-update', {
                requestId,
                sessionId: session.id,
                thought,
                content,
                stage: content ? 'answering' : 'thinking',
                segments,
            });
        };

        const emitLegacyCodexUpdate = (bufferText: string) => {
            const strictParsed = this.normalizeStreamResult(parseCodex(bufferText, true));
            const parsed = strictParsed.content ? strictParsed : this.normalizeStreamResult(parseCodex(bufferText));

            if (parsed.thought === lastThought && parsed.content === lastContent) {
                return;
            }

            lastThought = parsed.thought;
            lastContent = parsed.content;
            emitStreamUpdate(parsed.thought, parsed.content, this.createLegacySegments(parsed.thought, parsed.content));
        };

        const emitSegmentedCodexUpdate = () => {
            const strictParsed = parseCodex(stdoutBuffer, true);
            const parsed = strictParsed.content ? strictParsed : parseCodex(stdoutBuffer);
            const stdoutSegments = parsed.segments.map(segment => ({ ...segment, source: 'stdout' as const }));
            const stderrSegments = this.parseStderrOutput(stderrBuffer, provider, codexThinkingNoiseFilterEnabled);
            const mergedSegments = this.mergeSegments(stdoutSegments, stderrSegments);
            const thought = buildThoughtTextFromSegments(mergedSegments);
            const content = buildAnswerTextFromSegments(mergedSegments);
            const snapshot = JSON.stringify(mergedSegments);

            if (snapshot === lastSegmentsSnapshot && thought === lastThought && content === lastContent) {
                return;
            }

            lastSegmentsSnapshot = snapshot;
            lastThought = thought;
            lastContent = content;
            emitStreamUpdate(thought, content, mergedSegments);
        };

        const pushStreamUpdate = () => {
            if (requestId !== this._activeRequestId) {
                return;
            }

            if (provider === 'claude') {
                const parsed = consumeClaudeStreamChunk(claudeAccumulator, '');
                if (parsed.error) {
                    claudeLastError = parsed.error;
                }

                const mergedSegments = this.mergeSegments(
                    parsed.segments,
                    this.parseStderrOutput(stderrBuffer, provider, codexThinkingNoiseFilterEnabled),
                );
                const thought = buildThoughtTextFromSegments(mergedSegments);
                const content = buildAnswerTextFromSegments(mergedSegments) || parsed.content;
                const snapshot = JSON.stringify(mergedSegments);

                if (snapshot === lastSegmentsSnapshot && thought === lastThought && content === lastContent) {
                    return;
                }

                lastSegmentsSnapshot = snapshot;
                lastThought = thought;
                lastContent = content;
                emitStreamUpdate(thought, content, mergedSegments);
                return;
            }

            if (provider === 'pi') {
                const parsed = consumePiStreamChunk(piAccumulator, '');
                if (parsed.error) {
                    piLastError = parsed.error;
                }

                const mergedSegments = this.mergeSegments(
                    parsed.segments,
                    this.parseStderrOutput(stderrBuffer, provider, codexThinkingNoiseFilterEnabled),
                );
                const thought = buildThoughtTextFromSegments(mergedSegments);
                const content = buildAnswerTextFromSegments(mergedSegments) || parsed.content;
                const snapshot = JSON.stringify(mergedSegments);

                if (snapshot === lastSegmentsSnapshot && thought === lastThought && content === lastContent) {
                    return;
                }

                lastSegmentsSnapshot = snapshot;
                lastThought = thought;
                lastContent = content;
                emitStreamUpdate(thought, content, mergedSegments);
                return;
            }

            if (parserMode === 'legacy') {
                emitLegacyCodexUpdate(stdoutBuffer + stderrBuffer);
            } else {
                emitSegmentedCodexUpdate();
            }
        };

        const scheduleStreamUpdate = () => {
            if (flushTimer) {
                return;
            }
            flushTimer = setTimeout(() => {
                flushTimer = undefined;
                pushStreamUpdate();
            }, 20);
        };

        const timeoutTimer = setTimeout(() => {
            if (requestId !== this._activeRequestId || child.killed) {
                return;
            }

            endedByTimeout = true;
            child.kill();

            this.postToWebview('stream-end', {
                requestId,
                timedOut: true,
                sessionId: session.id,
            });
            this.postToWebview('done', '');

            this.appendSystemMessage(session, 'Request timed out.');
            this.persistSessionStore();
            this.publishSessionState();
        }, CodexProvider.REQUEST_TIMEOUT_MS);

        const onChildOutput = (source: 'stdout' | 'stderr', chunk: unknown) => {
            const text = String(chunk ?? '');
            if (!text) {
                return;
            }

            if (source === 'stdout') {
                stdoutBuffer += text;
            } else {
                stderrBuffer += text;
            }

            if (provider === 'claude') {
                claudeRawOutput += text;
                if (source === 'stdout') {
                    const parsed = consumeClaudeStreamChunk(claudeAccumulator, text);
                    if (parsed.error) {
                        claudeLastError = parsed.error;
                    }
                }
            }

            if (provider === 'pi' && source === 'stdout') {
                const parsed = consumePiStreamChunk(piAccumulator, text);
                if (parsed.error) {
                    piLastError = parsed.error;
                }
            }

            scheduleStreamUpdate();
        };

        child.stdout?.on('data', chunk => onChildOutput('stdout', chunk));
        child.stderr?.on('data', chunk => onChildOutput('stderr', chunk));

        child.on('error', (error: Error) => {
            clearTimeout(timeoutTimer);
            if (flushTimer) {
                clearTimeout(flushTimer);
                flushTimer = undefined;
            }

            if (requestId !== this._activeRequestId) {
                return;
            }

            this.postToWebview('stream-end', {
                requestId,
                failed: true,
                error: error.message,
                sessionId: session.id,
            });
            this.postToWebview('done', '');

            this.markNativeSessionFallbackIfNeeded(
                session,
                providerCommand,
                error.message,
                provider === 'claude' ? `${claudeRawOutput}\n${stderrBuffer}` : `${stdoutBuffer}\n${stderrBuffer}`,
                1,
            );
            this.appendSystemMessage(session, error.message);
            this.persistSessionStore();
            this.publishSessionState();
        });

        child.on('close', (code: number) => {
            clearTimeout(timeoutTimer);
            if (flushTimer) {
                clearTimeout(flushTimer);
                flushTimer = undefined;
            }

            if (this._activeChild === child) {
                this._activeChild = undefined;
            }

            if (requestId !== this._activeRequestId || endedByTimeout) {
                return;
            }

            pushStreamUpdate();

            let finalThought = lastThought;
            let finalContent = lastContent;

            if (provider === 'claude') {
                const finalClaude = finalizeClaudeStream(claudeAccumulator);
                if (finalClaude.error) {
                    claudeLastError = finalClaude.error;
                }

                if (finalClaude.content !== lastContent) {
                    const mergedSegments = this.mergeSegments(
                        finalClaude.segments,
                        this.parseStderrOutput(stderrBuffer, provider, codexThinkingNoiseFilterEnabled),
                    );
                    finalThought = buildThoughtTextFromSegments(mergedSegments);
                    finalContent = buildAnswerTextFromSegments(mergedSegments) || finalClaude.content;
                    emitStreamUpdate(finalThought, finalContent, mergedSegments);
                }

                if (!finalClaude.content) {
                    const fallbackError = this.pickClaudeFailureMessage(code, claudeLastError, claudeRawOutput);
                    this.postToWebview('stream-end', {
                        requestId,
                        failed: true,
                        error: fallbackError,
                        sessionId: session.id,
                    });
                    this.postToWebview('done', '');

                    this.markNativeSessionFallbackIfNeeded(
                        session,
                        providerCommand,
                        fallbackError,
                        `${claudeRawOutput}\n${stderrBuffer}`,
                        code,
                    );
                    this.appendSystemMessage(session, fallbackError);
                    this.persistSessionStore();
                    this.publishSessionState();
                    return;
                }
            } else if (provider === 'pi') {
                const finalPi = finalizePiStream(piAccumulator);
                if (finalPi.error) {
                    piLastError = finalPi.error;
                }

                const mergedSegments = this.mergeSegments(
                    finalPi.segments,
                    this.parseStderrOutput(stderrBuffer, provider, codexThinkingNoiseFilterEnabled),
                );
                const thought = buildThoughtTextFromSegments(mergedSegments);
                const content = buildAnswerTextFromSegments(mergedSegments) || finalPi.content;

                if (thought !== lastThought || content !== lastContent) {
                    finalThought = thought;
                    finalContent = content;
                    emitStreamUpdate(thought, content, mergedSegments);
                }

                if (!content && !thought) {
                    const errorText = this.pickPiFailureMessage(code, piLastError, stderrBuffer);
                    this.postToWebview('stream-end', {
                        requestId,
                        failed: true,
                        error: errorText,
                        sessionId: session.id,
                    });
                    this.postToWebview('done', '');

                    this.markNativeSessionFallbackIfNeeded(
                        session,
                        providerCommand,
                        errorText,
                        `${stdoutBuffer}\n${stderrBuffer}`,
                        code,
                    );
                    this.appendSystemMessage(session, errorText);
                    this.persistSessionStore();
                    this.publishSessionState();
                    return;
                }
            } else {
                if (parserMode === 'legacy') {
                    const legacyBuffer = `${stdoutBuffer}\n${stderrBuffer}`;
                    const strictParsed = this.normalizeStreamResult(parseCodex(legacyBuffer, true));
                    const parsed = strictParsed.content ? strictParsed : this.normalizeStreamResult(parseCodex(legacyBuffer));

                    if (parsed.thought !== lastThought || parsed.content !== lastContent) {
                        finalThought = parsed.thought;
                        finalContent = parsed.content;
                        emitStreamUpdate(parsed.thought, parsed.content, this.createLegacySegments(parsed.thought, parsed.content));
                    }

                    if (!parsed.content && !parsed.thought) {
                        const errorText = code !== 0
                            ? `Process failed (code ${code})`
                            : 'No response.';

                        this.postToWebview('stream-end', {
                            requestId,
                            failed: true,
                            error: errorText,
                            sessionId: session.id,
                        });
                        this.postToWebview('done', '');

                        this.markNativeSessionFallbackIfNeeded(session, providerCommand, errorText, legacyBuffer, code);
                        this.appendSystemMessage(session, errorText);
                        this.persistSessionStore();
                        this.publishSessionState();
                        return;
                    }
                } else {
                    const strictParsed = parseCodex(stdoutBuffer, true);
                    const parsed = strictParsed.content ? strictParsed : parseCodex(stdoutBuffer);
                    const mergedSegments = this.mergeSegments(
                        parsed.segments.map(segment => ({ ...segment, source: 'stdout' as const })),
                        this.parseStderrOutput(stderrBuffer, provider, codexThinkingNoiseFilterEnabled),
                    );
                    const thought = buildThoughtTextFromSegments(mergedSegments);
                    const content = buildAnswerTextFromSegments(mergedSegments);

                    if (thought !== lastThought || content !== lastContent) {
                        finalThought = thought;
                        finalContent = content;
                        emitStreamUpdate(thought, content, mergedSegments);
                    }

                    if (!content && !thought) {
                        const errorText = code !== 0
                            ? `Process failed (code ${code})`
                            : 'No response.';

                        this.postToWebview('stream-end', {
                            requestId,
                            failed: true,
                            error: errorText,
                            sessionId: session.id,
                        });
                        this.postToWebview('done', '');

                        this.markNativeSessionFallbackIfNeeded(
                            session,
                            providerCommand,
                            errorText,
                            `${stdoutBuffer}\n${stderrBuffer}`,
                            code,
                        );
                        this.appendSystemMessage(session, errorText);
                        this.persistSessionStore();
                        this.publishSessionState();
                        return;
                    }
                }
            }

            if (provider === 'codex' && !session.backendSessionId) {
                const sessionId = extractCodexSessionId(stdoutBuffer);
                if (sessionId) {
                    session.backendSessionId = sessionId;
                }
            }

            session.needsBootstrapContext = false;
            this.appendAssistantMessage(session, finalThought, finalContent, finalSegments);
            this.persistSessionStore();

            this.postToWebview('stream-end', {
                requestId,
                finished: true,
                sessionId: session.id,
            });
            this.postToWebview('done', '');
            this.publishSessionState();

            if (this.shouldAutoGenerateSessionTitle(session)) {
                void this.maybeAutoGenerateSessionTitle(session, workspaceDir);
            }
        });
    }

    private shouldInjectRecentContext(session: ChatSession, usesNativeSession: boolean): boolean {
        if (!usesNativeSession) {
            return true;
        }

        return Boolean(session.needsBootstrapContext);
    }

    private parseStderrOutput(stderrText: string, provider: ProviderType, filterThinkingNoise: boolean): StreamSegment[] {
        const cleaned = stderrText
            .replace(/\x1b\[[0-9;]*m/g, '')
            .replace(/\r/g, '')
            .trim();

        if (!cleaned) {
            return [];
        }

        return cleaned
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .filter(line => !(provider === 'codex' && filterThinkingNoise && this.isCodexThinkingNoiseLine(line)))
            .map((line, index) => {
                const lower = line.toLowerCase();
                const isError =
                    lower.startsWith('error:') ||
                    lower.includes(' failed ') ||
                    lower.includes('exception') ||
                    lower.includes('traceback') ||
                    lower.includes('exited ');

                if (isError) {
                    return {
                        type: 'error' as const,
                        value: line,
                        phase: 'answer' as const,
                        source: 'stderr' as const,
                        seq: index,
                    };
                }

                return {
                    type: 'text' as const,
                    value: line,
                    phase: 'thinking' as const,
                    source: 'stderr' as const,
                    seq: index,
                };
            });
    }

    private isCodexThinkingNoiseLine(line: string): boolean {
        const trimmed = line.trim();
        if (!trimmed) {
            return false;
        }

        const lower = trimmed.toLowerCase();
        if (lower === 'thinking') {
            return true;
        }

        const isWrapped = trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4;
        const normalized = (isWrapped ? trimmed.slice(2, -2).trim() : trimmed).toLowerCase();

        const prefixes = [
            'planning',
            'preparing',
            'gathering',
            'assessing',
            'reviewing',
            'identifying',
            'locating',
            'verifying',
            'optimizing',
            'crafting',
        ];

        return prefixes.some(prefix => normalized === prefix || normalized.startsWith(prefix + ' '));
    }

    private mergeSegments(primary: StreamSegment[], secondary: StreamSegment[]): StreamSegment[] {
        return [...primary, ...secondary]
            .filter(segment => {
                if (segment.type === 'text' || segment.type === 'error') {
                    return Boolean(segment.value && segment.value.trim());
                }

                return true;
            })
            .map((segment, index) => ({ ...segment, seq: index }));
    }

    private createLegacySegments(thought: string, content: string): StreamSegment[] {
        const segments: StreamSegment[] = [];
        let seq = 0;

        if (thought.trim()) {
            segments.push({
                type: 'text',
                value: thought.trim(),
                phase: 'thinking',
                source: 'mixed',
                seq: seq++,
            });
        }

        if (content.trim()) {
            segments.push({
                type: 'text',
                value: content.trim(),
                phase: 'answer',
                source: 'mixed',
                seq,
            });
        }

        return segments;
    }

    private resolveTargetSession(
        sessionId: string | undefined,
        fallbackProvider: ProviderType,
        startFromHome = false,
    ): ChatSession | undefined {
        if (startFromHome) {
            const created = this.createSession(fallbackProvider);
            this._sessions.push(created);
            this._activeSessionId = created.id;
            this.persistSessionStore();
            return created;
        }

        if (sessionId) {
            const found = this._sessions.find(item => item.id === sessionId);
            if (found) {
                this._activeSessionId = found.id;
                return found;
            }
        }

        const active = this.getActiveSession();
        if (active) {
            return active;
        }

        if (this._sessions.length === 0) {
            const created = this.createSession(fallbackProvider);
            this._sessions.push(created);
            this._activeSessionId = created.id;
            this.persistSessionStore();
            return created;
        }

        this._activeSessionId = this._sessions[0].id;
        return this._sessions[0];
    }

    private handleCreateSession(value: unknown) {
        const payload = this.asRecord(value);
        const provider = this.normalizeProvider(payload?.provider);

        const created = this.createSession(provider);
        this._sessions.push(created);
        this._activeSessionId = created.id;

        this.persistSessionStore();
        this.publishSessionState();
    }

    private handleSwitchSession(value: unknown) {
        const payload = this.asRecord(value);
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        if (!sessionId) {
            return;
        }

        const exists = this._sessions.some(item => item.id === sessionId);
        if (!exists) {
            this.emitSessionError('Session not found.');
            return;
        }

        if (this._activeSessionId === sessionId) {
            return;
        }

        this.cancelExecution();
        this._activeSessionId = sessionId;
        this.persistSessionStore();
        this.publishSessionState();
    }

    private handleSessionProviderUpdate(value: unknown) {
        const payload = this.asRecord(value);
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        if (!sessionId) {
            return;
        }

        const session = this._sessions.find(item => item.id === sessionId);
        if (!session) {
            this.emitSessionError('Session not found.');
            return;
        }

        const provider = this.normalizeProvider(payload?.provider);
        if (session.provider === provider) {
            return;
        }

        this.applySessionProvider(session, provider);
        this.persistSessionStore();
        this.publishSessionState();
    }

    private applySessionProvider(session: ChatSession, provider: ProviderType) {
        session.provider = provider;
        session.updatedAt = Date.now();
        session.needsBootstrapContext = true;

        if (provider === 'codex') {
            session.backendSessionId = undefined;
            return;
        }

        session.backendSessionId = this.createId();
    }

    private handleRenameSession(value: unknown) {
        const payload = this.asRecord(value);
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        const title = typeof payload?.title === 'string' ? payload.title.trim() : '';

        if (!sessionId || !title) {
            this.emitSessionError('Session title cannot be empty.');
            return;
        }

        const session = this._sessions.find(item => item.id === sessionId);
        if (!session) {
            this.emitSessionError('Session not found.');
            return;
        }

        session.title = title;
        session.updatedAt = Date.now();

        this.persistSessionStore();
        this.publishSessionState();
    }

    private async handleRenameSessionRequest(value: unknown): Promise<void> {
        const payload = this.asRecord(value);
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        if (!sessionId) {
            return;
        }

        const session = this._sessions.find(item => item.id === sessionId);
        if (!session) {
            this.emitSessionError('Session not found.');
            return;
        }

        const currentTitle = typeof payload?.currentTitle === 'string' ? payload.currentTitle.trim() : '';
        const nextTitle = await vscode.window.showInputBox({
            title: 'Rename Session',
            prompt: 'Enter a new title for this session',
            value: currentTitle || session.title,
            ignoreFocusOut: true,
            validateInput: input => input.trim() ? undefined : 'Session title cannot be empty.',
        });

        if (typeof nextTitle !== 'string') {
            return;
        }

        this.handleRenameSession({
            sessionId,
            title: nextTitle,
        });
    }

    private handleDeleteSession(value: unknown) {
        const payload = this.asRecord(value);
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        if (!sessionId) {
            return;
        }

        const index = this._sessions.findIndex(item => item.id === sessionId);
        if (index === -1) {
            this.emitSessionError('Session not found.');
            return;
        }

        if (this._activeSessionId === sessionId) {
            this.cancelExecution();
        }

        this._sessions.splice(index, 1);

        if (this._sessions.length === 0) {
            const created = this.createSession(this.getDefaultProvider());
            this._sessions.push(created);
            this._activeSessionId = created.id;
        } else if (!this._sessions.some(item => item.id === this._activeSessionId)) {
            const fallback = this._sessions[Math.max(index - 1, 0)] ?? this._sessions[0];
            this._activeSessionId = fallback.id;
        }

        this.persistSessionStore();
        this.publishSessionState();
    }

    private async handleDeleteSessionRequest(value: unknown): Promise<void> {
        const payload = this.asRecord(value);
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        if (!sessionId) {
            return;
        }

        const session = this._sessions.find(item => item.id === sessionId);
        if (!session) {
            this.emitSessionError('Session not found.');
            return;
        }

        const title = (typeof payload?.title === 'string' && payload.title.trim())
            ? payload.title.trim()
            : session.title;

        const confirmed = await vscode.window.showWarningMessage(
            `Delete session "${title}"?`,
            { modal: true },
            'Delete',
        );

        if (confirmed !== 'Delete') {
            return;
        }

        this.handleDeleteSession({ sessionId });
    }

    private async handleExportSession(value: unknown) {
        const payload = this.asRecord(value);
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        if (!sessionId) {
            return;
        }

        const session = this._sessions.find(item => item.id === sessionId);
        if (!session) {
            this.emitSessionError('Session not found.');
            return;
        }

        const suggestedFileName = `${this.sanitizeFileName(session.title || 'session')}-${this.buildTimestampLabel()}.json`;
        const defaultUri = vscode.workspace.workspaceFolders?.[0]
            ? vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, suggestedFileName)
            : vscode.Uri.file(path.join(os.homedir(), suggestedFileName));

        const targetUri = await vscode.window.showSaveDialog({
            title: 'Export Session',
            defaultUri,
            filters: {
                'JSON': ['json'],
            },
        });

        if (!targetUri) {
            return;
        }

        const payloadText = JSON.stringify({
            version: 1,
            exportedAt: new Date().toISOString(),
            session,
        }, null, 2);

        try {
            await fs.promises.writeFile(targetUri.fsPath, payloadText, 'utf8');
            void vscode.window.showInformationMessage('Session exported successfully.');
        } catch {
            this.emitSessionError('Failed to export session.');
        }
    }

    private async handleMultiDeleteSession(value: unknown) {
        const payload = this.asRecord(value);
        const sessionIds = Array.isArray(payload?.sessionIds) ? payload.sessionIds : [];

        if (sessionIds.length === 0) {
            return;
        }

        const validSessionIds = sessionIds
            .filter(id => typeof id === 'string' && id.trim())
            .map(id => id.trim());

        if (validSessionIds.length === 0) {
            return;
        }

        const confirmed = await vscode.window.showWarningMessage(
            `Delete ${validSessionIds.length} session${validSessionIds.length > 1 ? 's' : ''}?`,
            { modal: true },
            'Delete',
        );

        if (confirmed !== 'Delete') {
            return;
        }

        // Cancel execution if any selected session is active
        if (validSessionIds.includes(this._activeSessionId)) {
            this.cancelExecution();
        }

        // Remove all selected sessions
        this._sessions = this._sessions.filter(item => !validSessionIds.includes(item.id));

        // Handle empty sessions or active session removal
        if (this._sessions.length === 0) {
            const created = this.createSession(this.getDefaultProvider());
            this._sessions.push(created);
            this._activeSessionId = created.id;
        } else if (!this._sessions.some(item => item.id === this._activeSessionId)) {
            this._activeSessionId = this._sessions[0].id;
        }

        this.persistSessionStore();
        this.publishSessionState();
        void vscode.window.showInformationMessage(`${validSessionIds.length} session${validSessionIds.length > 1 ? 's' : ''} deleted.`);
    }

    private async handleMultiExportSession(value: unknown) {
        const payload = this.asRecord(value);
        const sessionIds = Array.isArray(payload?.sessionIds) ? payload.sessionIds : [];

        if (sessionIds.length === 0) {
            return;
        }

        const validSessionIds = sessionIds
            .filter(id => typeof id === 'string' && id.trim())
            .map(id => id.trim());

        if (validSessionIds.length === 0) {
            return;
        }

        const sessionsToExport = this._sessions.filter(item => validSessionIds.includes(item.id));

        if (sessionsToExport.length === 0) {
            this.emitSessionError('No sessions found to export.');
            return;
        }

        const defaultFileName = sessionsToExport.length === 1
            ? `${this.sanitizeFileName(sessionsToExport[0].title || 'session')}-${this.buildTimestampLabel()}.json`
            : `sessions-export-${this.buildTimestampLabel()}.json`;

        const defaultUri = vscode.workspace.workspaceFolders?.[0]
            ? vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, defaultFileName)
            : vscode.Uri.file(path.join(os.homedir(), defaultFileName));

        const targetUri = await vscode.window.showSaveDialog({
            title: sessionsToExport.length === 1 ? 'Export Session' : 'Export Sessions',
            defaultUri,
            filters: {
                'JSON': ['json'],
            },
        });

        if (!targetUri) {
            return;
        }

        const payloadText = JSON.stringify({
            version: 1,
            exportedAt: new Date().toISOString(),
            count: sessionsToExport.length,
            sessions: sessionsToExport,
        }, null, 2);

        try {
            await fs.promises.writeFile(targetUri.fsPath, payloadText, 'utf8');
            void vscode.window.showInformationMessage(`${sessionsToExport.length} session${sessionsToExport.length > 1 ? 's' : ''} exported successfully.`);
        } catch {
            this.emitSessionError('Failed to export sessions.');
        }
    }

    private emitSessionError(message: string) {
        this.postToWebview('session-error', { message });
    }

    private appendUserMessage(session: ChatSession, prompt: string, attachments: AttachmentItem[]) {
        const message: ChatMessage = {
            id: this.createId(),
            role: 'user',
            prompt,
            attachments: attachments.length > 0 ? attachments : undefined,
            createdAt: Date.now(),
        };

        session.messages.push(message);
        session.updatedAt = Date.now();
    }

    private appendAssistantMessage(session: ChatSession, thought: string, content: string, segments?: StreamSegment[]) {
        const message: ChatMessage = {
            id: this.createId(),
            role: 'assistant',
            thought: thought || undefined,
            content: content || undefined,
            segments: Array.isArray(segments) && segments.length > 0 ? segments : undefined,
            createdAt: Date.now(),
        };

        session.messages.push(message);
        session.updatedAt = Date.now();
    }

    private appendSystemMessage(session: ChatSession, content: string) {
        const text = content.trim();
        if (!text) {
            return;
        }

        const message: ChatMessage = {
            id: this.createId(),
            role: 'system',
            content: text,
            createdAt: Date.now(),
        };

        session.messages.push(message);
        session.updatedAt = Date.now();
    }

    private getActiveSession(): ChatSession | undefined {
        if (!this._activeSessionId) {
            return undefined;
        }

        return this._sessions.find(item => item.id === this._activeSessionId);
    }

    private createSession(provider: ProviderType): ChatSession {
        const now = Date.now();
        return {
            id: this.createId(),
            title: this.makeDefaultSessionTitle(),
            provider,
            backendSessionId: provider === 'claude' ? this.createId() : (provider === 'pi' ? this.createId() : undefined),
            needsBootstrapContext: false,
            createdAt: now,
            updatedAt: now,
            messages: [],
        };
    }

    private makeDefaultSessionTitle(): string {
        const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
        return `新会话 ${stamp}`;
    }

    private publishSessionState() {
        const summaries: SessionSummary[] = this._sessions
            .map(session => ({
                id: session.id,
                title: session.title,
                provider: session.provider,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                messageCount: session.messages.length,
                workspacePath: this.buildSessionWorkspacePath(session),
                previewText: this.buildSessionPreviewText(session),
            }))
            .sort((left, right) => right.updatedAt - left.updatedAt);

        this.postToWebview('session-list', {
            activeSessionId: this._activeSessionId,
            sessions: summaries,
        });

        const active = this.getActiveSession();
        this.postToWebview('session-active', {
            session: active
                ? {
                    id: active.id,
                    title: active.title,
                    provider: active.provider,
                    createdAt: active.createdAt,
                    updatedAt: active.updatedAt,
                    messages: active.messages,
                }
                : null,
        });
    }

    private buildSessionWorkspacePath(session: ChatSession): string {
        for (let index = session.messages.length - 1; index >= 0; index -= 1) {
            const message = session.messages[index];
            if (!message || !Array.isArray(message.attachments)) {
                continue;
            }

            const attachment = message.attachments.find(item => typeof item?.path === 'string' && item.path.trim());
            if (attachment?.path) {
                return attachment.path;
            }
        }

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        return workspacePath ?? '';
    }

    private buildSessionPreviewText(session: ChatSession): string {
        for (let index = session.messages.length - 1; index >= 0; index -= 1) {
            const message = session.messages[index];
            if (!message) {
                continue;
            }

            if (message.role === 'user' && message.prompt) {
                const prompt = message.prompt.trim();
                if (prompt) {
                    return prompt;
                }
            }

            if (message.role === 'assistant' && message.content) {
                const content = message.content.trim();
                if (content) {
                    return content;
                }
            }
        }

        return '';
    }

    private normalizeStreamResult(result: { thought: string; content: string }): { thought: string; content: string } {
        if (!result.content) {
            return result;
        }

        if (this.looksLikeThinkingLog(result.content)) {
            const mergedThought = [result.thought, result.content].filter(Boolean).join('\n').trim();
            return { thought: mergedThought, content: '' };
        }

        return result;
    }

    private looksLikeThinkingLog(text: string): boolean {
        const normalized = text.replace(/\r/g, '').trim();
        if (!normalized) {
            return false;
        }

        const lower = normalized.toLowerCase();

        if (lower.startsWith('exec') || lower.includes('\nexec\n')) {
            return true;
        }

        if (
            lower.includes(' succeeded in ') ||
            lower.includes(' failed in ') ||
            lower.includes(' exited ') ||
            lower.includes('powershell.exe') ||
            lower.includes('cmd.exe') ||
            lower.includes('apply_patch')
        ) {
            return true;
        }

        return false;
    }

    private buildProviderCommand(session: ChatSession): ProviderCommand {
        if (session.provider === 'claude') {
            if (!session.backendSessionId) {
                session.backendSessionId = this.createId();
                session.needsBootstrapContext = true;
            }

            return {
                command: 'claude',
                args: [
                    '-p',
                    '--verbose',
                    '--output-format',
                    'stream-json',
                    '--dangerously-skip-permissions',
                    '--session-id',
                    session.backendSessionId,
                ],
                promptViaStdin: true,
                versionArgs: ['--version'],
                usesNativeSession: true,
            };
        }

        if (session.provider === 'pi') {
            return {
                command: 'pi',
                args: [
                    '-p',
                    '--mode',
                    'json',
                    '--continue',
                ],
                promptViaStdin: true,
                versionArgs: ['--version'],
                usesNativeSession: true,
            };
        }

        if (!this.shouldAutoResumeCodexSession() && session.backendSessionId) {
            session.backendSessionId = undefined;
            session.needsBootstrapContext = true;
        }

        if (session.backendSessionId) {
            return {
                command: 'codex',
                args: [
                    'exec',
                    'resume',
                    session.backendSessionId,
                    '--dangerously-bypass-approvals-and-sandbox',
                    '--skip-git-repo-check',
                    '-',
                ],
                promptViaStdin: true,
                versionArgs: ['--version'],
                usesNativeSession: true,
            };
        }

        return {
            command: 'codex',
            args: [
                'exec',
                '--dangerously-bypass-approvals-and-sandbox',
                '--skip-git-repo-check',
            ],
            promptViaStdin: true,
            versionArgs: ['--version'],
            usesNativeSession: false,
        };
    }

    private markNativeSessionFallbackIfNeeded(
        session: ChatSession,
        providerCommand: ProviderCommand,
        cliError: string,
        rawOutput: string,
        code: number,
    ) {
        if (!providerCommand.usesNativeSession) {
            return;
        }

        if (!this.isLikelyNativeSessionFailure(cliError, rawOutput, code)) {
            return;
        }

        if (session.provider === 'codex') {
            session.backendSessionId = undefined;
            session.needsBootstrapContext = true;
            this.appendSystemMessage(session, 'Codex session resume failed. Next turn will use local context fallback.');
            return;
        }

        if (session.provider === 'pi') {
            session.needsBootstrapContext = true;
            this.appendSystemMessage(session, 'Pi session continue failed. Next turn will use local context fallback.');
            return;
        }

        session.backendSessionId = this.createId();
        session.needsBootstrapContext = true;
        this.appendSystemMessage(session, 'Claude session reset. Next turn will use local context fallback.');
    }

    private isLikelyNativeSessionFailure(cliError: string, rawOutput: string, code: number): boolean {
        if (code === 0) {
            return false;
        }

        const lower = `${cliError}\n${rawOutput}`.toLowerCase();
        if (!lower.includes('session')) {
            return false;
        }

        return [
            'not found',
            'cannot',
            'invalid',
            'resume',
            'unknown',
            'expired',
        ].some(marker => lower.includes(marker));
    }

    private shouldEnforceCodexCheckpoint(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('codexEnforceCheckpointPolicy', true);
    }

    private shouldAutoResumeCodexSession(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('codexAutoResumeSession', true);
    }

    private injectCodexCheckpointPolicy(prompt: string): string {
        if (!this.shouldEnforceCodexCheckpoint()) {
            return prompt;
        }

        return [
            'System policy from VS Code extension:',
            '- Before you edit or create any file, create a checkpoint first so work can be resumed safely.',
            '- If this request is read-only, do not create a checkpoint.',
            '',
            'User request:',
            prompt,
        ].join('\n');
    }

    private injectRecentConversationContext(session: ChatSession, currentPrompt: string): string {
        const history = session.messages.filter(item => item.role === 'user' || item.role === 'assistant');
        if (history.length <= 1) {
            return currentPrompt;
        }

        const previousMessages = history.slice(0, -1);
        const recentMessages = previousMessages.slice(-(CodexProvider.CONTEXT_RECENT_ROUNDS * 2));
        if (recentMessages.length === 0) {
            return currentPrompt;
        }

        const historyLines: string[] = [];
        for (const message of recentMessages) {
            if (message.role === 'user') {
                const attachmentHint = message.attachments && message.attachments.length > 0
                    ? `\n[Attached files: ${message.attachments.map(item => item.name).join(', ')}]`
                    : '';
                historyLines.push(`User:\n${message.prompt ?? ''}${attachmentHint}`.trim());
                continue;
            }

            const assistantText = message.content ?? message.thought ?? '';
            historyLines.push(`Assistant:\n${assistantText}`.trim());
        }

        if (historyLines.length === 0) {
            return currentPrompt;
        }

        return [
            'Conversation context from recent turns:',
            historyLines.join('\n\n'),
            '',
            'Current user message:',
            currentPrompt,
        ].join('\n');
    }

    private buildPromptWithAttachments(prompt: string, attachments: AttachmentItem[]): string {
        if (attachments.length === 0) {
            return prompt;
        }

        let totalChars = 0;
        const chunks: string[] = [];

        for (const attachment of attachments.slice(0, CodexProvider.MAX_ATTACHMENT_COUNT)) {
            const remain = CodexProvider.MAX_ATTACHMENT_CHARS_TOTAL - totalChars;
            if (remain <= 0) {
                break;
            }

            const perFileBudget = Math.min(CodexProvider.MAX_ATTACHMENT_CHARS_PER_FILE, remain);
            const contentResult = this.readAttachmentContent(attachment.path, perFileBudget);
            const languageHint = this.detectLanguageFromPath(attachment.path);
            const text = contentResult.text;
            const truncated = contentResult.truncated;

            totalChars += text.length;

            const truncatedHint = truncated ? '\n[Attachment content truncated]' : '';
            chunks.push([
                `### ${attachment.name}`,
                `Path: ${attachment.path}`,
                '',
                '```' + languageHint,
                text,
                '```',
                truncatedHint,
            ].join('\n'));
        }

        if (chunks.length === 0) {
            return prompt;
        }

        return [
            prompt,
            '',
            'Attached file context:',
            chunks.join('\n\n'),
            '',
            'Please use these attachments as additional context when answering.',
        ].join('\n');
    }

    private readAttachmentContent(filePath: string, maxChars: number): { text: string; truncated: boolean } {
        const safeMaxChars = Number.isFinite(maxChars) ? Math.floor(maxChars) : 0;
        if (safeMaxChars <= 0) {
            return { text: '', truncated: true };
        }

        let fd: number | undefined;
        try {
            fd = fs.openSync(filePath, 'r');

            const sampleBuffer = Buffer.alloc(4096);
            const sampleBytes = fs.readSync(fd, sampleBuffer, 0, sampleBuffer.length, 0);
            if (sampleBytes <= 0) {
                return { text: '[Empty file]', truncated: false };
            }

            const sample = sampleBytes === sampleBuffer.length
                ? sampleBuffer
                : sampleBuffer.subarray(0, sampleBytes);
            if (this.isProbablyBinary(sample)) {
                return { text: '[Binary file omitted]', truncated: false };
            }

            const byteLimit = Math.max(4, safeMaxChars * 4 + 4);
            const initialBytes = Math.min(sample.length, byteLimit);
            const chunks: Buffer[] = [sample.subarray(0, initialBytes)];
            let keptBytes = initialBytes;
            let position = sample.length;

            while (keptBytes < byteLimit) {
                const readSize = Math.min(8192, byteLimit - keptBytes);
                const chunk = Buffer.alloc(readSize);
                const bytesRead = fs.readSync(fd, chunk, 0, readSize, position);
                if (bytesRead <= 0) {
                    break;
                }

                chunks.push(bytesRead === readSize ? chunk : chunk.subarray(0, bytesRead));
                keptBytes += bytesRead;
                position += bytesRead;
            }

            const rawText = Buffer.concat(chunks, keptBytes).toString('utf8');
            const fileSize = fs.fstatSync(fd).size;
            const truncatedByByteLimit = fileSize > keptBytes;

            if (rawText.length > safeMaxChars) {
                return {
                    text: rawText.slice(0, safeMaxChars),
                    truncated: true,
                };
            }

            return {
                text: rawText,
                truncated: truncatedByByteLimit,
            };
        } catch {
            return { text: '[Failed to read file]', truncated: false };
        } finally {
            if (fd !== undefined) {
                try {
                    fs.closeSync(fd);
                } catch {
                }
            }
        }
    }

    private isProbablyBinary(buffer: Buffer): boolean {
        const sample = buffer.subarray(0, 4096);
        for (const byte of sample) {
            if (byte === 0) {
                return true;
            }
        }
        return false;
    }

    private detectLanguageFromPath(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        if (!ext) {
            return '';
        }

        const map: Record<string, string> = {
            '.ts': 'ts',
            '.tsx': 'tsx',
            '.js': 'js',
            '.jsx': 'jsx',
            '.json': 'json',
            '.md': 'markdown',
            '.py': 'python',
            '.go': 'go',
            '.java': 'java',
            '.rs': 'rust',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.css': 'css',
            '.html': 'html',
            '.yml': 'yaml',
            '.yaml': 'yaml',
            '.xml': 'xml',
            '.sh': 'bash',
            '.sql': 'sql',
        };

        return map[ext] ?? ext.slice(1);
    }

    private isCommandAvailable(command: string, versionArgs: string[], cwd: string): boolean {
        const result = cp.spawnSync(command, versionArgs, {
            shell: true,
            cwd,
            env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
            encoding: 'utf8',
        });

        return !result.error && result.status === 0;
    }

    private pickClaudeFailureMessage(code: number, cliError: string, rawOutput: string): string {
        if (cliError) {
            return cliError;
        }

        const cleaned = rawOutput
            .replace(/\x1b\[[0-9;]*m/g, '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .slice(-4)
            .join('\n');

        if (cleaned) {
            return cleaned;
        }

        if (code !== 0) {
            return `Claude process failed (code ${code})`;
        }

        return 'No response from Claude.';
    }

    private pickPiFailureMessage(code: number, parserError: string, stderrText: string): string {
        if (parserError) {
            return parserError;
        }

        const cleaned = stderrText
            .replace(/\x1b\[[0-9;]*m/g, '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .slice(-4)
            .join('\n');

        if (cleaned) {
            return cleaned;
        }

        if (code !== 0) {
            return `Pi process failed (code ${code})`;
        }

        return 'No response from Pi.';
    }

    private shouldAutoGenerateSessionTitle(session: ChatSession): boolean {
        if (!this.isDefaultSessionTitle(session.title)) {
            return false;
        }

        const dialog = session.messages.filter(item => item.role === 'user' || item.role === 'assistant');
        if (dialog.length !== 2) {
            return false;
        }

        return dialog[0]?.role === 'user' && dialog[1]?.role === 'assistant';
    }

    private isDefaultSessionTitle(title: string): boolean {
        return /^新会话\s\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(String(title || '').trim());
    }

    private async maybeAutoGenerateSessionTitle(session: ChatSession, cwd: string): Promise<void> {
        if (!this.shouldAutoGenerateSessionTitle(session)) {
            return;
        }

        const firstRound = this.getFirstRoundDialog(session);
        if (!firstRound) {
            return;
        }

        const generatedTitle = await this.generateTitleWithCodex(firstRound.userPrompt, firstRound.assistantText, cwd);
        if (!generatedTitle) {
            return;
        }

        if (!this.shouldAutoGenerateSessionTitle(session)) {
            return;
        }

        session.title = generatedTitle;
        session.updatedAt = Date.now();
        this.persistSessionStore();
        this.publishSessionState();
    }

    private getFirstRoundDialog(session: ChatSession): { userPrompt: string; assistantText: string } | null {
        const dialog = session.messages.filter(item => item.role === 'user' || item.role === 'assistant');
        if (dialog.length < 2) {
            return null;
        }

        const user = dialog.find(item => item.role === 'user');
        const assistant = dialog.find(item => item.role === 'assistant');
        if (!user || !assistant) {
            return null;
        }

        const userPrompt = String(user.prompt || '').trim();
        const assistantText = String(assistant.content || assistant.thought || '').trim();
        if (!userPrompt || !assistantText) {
            return null;
        }

        return { userPrompt, assistantText };
    }

    private async generateTitleWithCodex(userPrompt: string, assistantText: string, cwd: string): Promise<string | undefined> {
        if (!this.isCommandAvailable('codex', ['--version'], cwd)) {
            return undefined;
        }

        const prompt = [
            'You generate concise chat session titles.',
            'Return only one short title line.',
            'Rules:',
            '- No markdown, no quotes, no prefix labels.',
            '- Prefer <= 24 characters.',
            '- Keep language aligned with the user request.',
            '',
            'User message:',
            userPrompt,
            '',
            'Assistant reply:',
            assistantText.slice(0, 1200),
        ].join('\n');

        const raw = await this.runCommandWithStdin(
            'codex',
            [
                'exec',
                '--dangerously-bypass-approvals-and-sandbox',
                '--skip-git-repo-check',
            ],
            prompt,
            cwd,
            CodexProvider.TITLE_GENERATION_TIMEOUT_MS,
        );

        if (!raw) {
            return undefined;
        }

        const parsed = parseCodexOutput(raw);
        const fromParsed = this.normalizeGeneratedTitle(parsed.content);
        if (fromParsed) {
            return fromParsed;
        }

        return this.normalizeGeneratedTitle(raw);
    }

    private normalizeGeneratedTitle(raw: string): string | undefined {
        const lines = String(raw || '')
            .replace(/\x1b\[[0-9;]*m/g, '')
            .replace(/\r/g, '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .filter(line => !/^session\s+id\s*:/i.test(line))
            .filter(line => !/^workdir\s*:/i.test(line))
            .filter(line => !/^model\s*:/i.test(line))
            .filter(line => !/^approval\s*:/i.test(line))
            .filter(line => !/^sandbox\s*:/i.test(line));

        if (lines.length === 0) {
            return undefined;
        }

        const firstLine = lines[0]
            .replace(/^[-*\d.\s]+/, '')
            .replace(/^['"`]+/, '')
            .replace(/['"`]+$/, '')
            .trim();

        if (!firstLine) {
            return undefined;
        }

        const compact = firstLine.replace(/\s+/g, ' ');
        return compact.slice(0, 48);
    }

    private runCommandWithStdin(
        command: string,
        args: string[],
        stdinText: string,
        cwd: string,
        timeoutMs: number,
    ): Promise<string | undefined> {
        return new Promise(resolve => {
            const child = cp.spawn(command, args, {
                shell: true,
                cwd,
                env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
            });

            let stdout = '';
            let stderr = '';
            let resolved = false;

            const finish = (value: string | undefined) => {
                if (resolved) {
                    return;
                }
                resolved = true;
                resolve(value);
            };

            const timer = setTimeout(() => {
                child.kill();
                finish(undefined);
            }, timeoutMs);

            child.stdout?.on('data', chunk => {
                stdout += String(chunk ?? '');
            });

            child.stderr?.on('data', chunk => {
                stderr += String(chunk ?? '');
            });

            child.on('error', () => {
                clearTimeout(timer);
                finish(undefined);
            });

            child.on('close', code => {
                clearTimeout(timer);
                if (code !== 0) {
                    finish(undefined);
                    return;
                }

                const merged = `${stdout}\n${stderr}`.trim();
                finish(merged || undefined);
            });

            if (child.stdin) {
                child.stdin.write(stdinText + '\n');
                child.stdin.end();
            }
        });
    }

    private buildStorageKey(): string {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? 'global';
        const hash = crypto.createHash('sha1').update(workspacePath).digest('hex').slice(0, 12);
        return `codexSidebar.sessions.v1.${hash}`;
    }

    private getStorageBucket(): vscode.Memento {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            return this._context.workspaceState;
        }

        return this._context.globalState;
    }

    private loadSessionStore() {
        const bucket = this.getStorageBucket();
        const raw = bucket.get<unknown>(this._storageKey);
        const fallbackProvider = this.getDefaultProvider();

        if (raw === undefined) {
            const session = this.createSession(fallbackProvider);
            this._sessions = [session];
            this._activeSessionId = session.id;
            void bucket.update(this._storageKey, this.toPersistedState());
            return;
        }

        try {
            const parsed = this.parsePersistedState(raw);
            if (!parsed) {
                throw new Error('invalid session store shape');
            }

            this._sessions = parsed.sessions;
            this._activeSessionId = parsed.activeSessionId;

            if (!this._sessions.some(item => item.id === this._activeSessionId)) {
                this._activeSessionId = this._sessions[0]?.id ?? '';
            }

            if (!this._activeSessionId || this._sessions.length === 0) {
                const session = this.createSession(fallbackProvider);
                this._sessions = [session];
                this._activeSessionId = session.id;
            }
        } catch (error) {
            const backupKey = `codexSidebar.sessions.backup.${Date.now()}`;
            const backup: BackupRecord = {
                failedAt: new Date().toISOString(),
                reason: error instanceof Error ? error.message : String(error),
                raw,
            };
            void bucket.update(backupKey, backup);

            const session = this.createSession(fallbackProvider);
            this._sessions = [session];
            this._activeSessionId = session.id;
            void bucket.update(this._storageKey, this.toPersistedState());
        }
    }

    private parsePersistedState(raw: unknown): SessionStoreState | null {
        const root = this.asRecord(raw);
        if (!root) {
            return null;
        }

        const version = typeof root.version === 'number' ? root.version : NaN;
        if (version !== SESSION_STORE_VERSION) {
            return null;
        }

        const activeSessionId = typeof root.activeSessionId === 'string' ? root.activeSessionId : '';
        const sessionsRaw = Array.isArray(root.sessions) ? root.sessions : [];

        const sessions: ChatSession[] = [];
        for (const item of sessionsRaw) {
            const parsed = this.parsePersistedSession(item);
            if (parsed) {
                sessions.push(parsed);
            }
        }

        if (sessions.length === 0) {
            return null;
        }

        return {
            version,
            activeSessionId,
            sessions,
        };
    }

    private parsePersistedSession(raw: unknown): ChatSession | null {
        const value = this.asRecord(raw);
        if (!value) {
            return null;
        }

        const id = typeof value.id === 'string' ? value.id : '';
        const title = typeof value.title === 'string' ? value.title : '';
        const provider = this.normalizeProvider(value.provider);
        const createdAt = typeof value.createdAt === 'number' ? value.createdAt : Date.now();
        const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : createdAt;
        const backendSessionId = typeof value.backendSessionId === 'string' && value.backendSessionId.trim()
            ? value.backendSessionId.trim()
            : undefined;
        const needsBootstrapContext = Boolean(value.needsBootstrapContext);

        if (!id || !title) {
            return null;
        }

        const messagesRaw = Array.isArray(value.messages) ? value.messages : [];
        const messages: ChatMessage[] = [];
        for (const entry of messagesRaw) {
            const parsed = this.parsePersistedMessage(entry);
            if (parsed) {
                messages.push(parsed);
            }
        }

        return {
            id,
            title,
            provider,
            backendSessionId,
            needsBootstrapContext,
            createdAt,
            updatedAt,
            messages,
        };
    }

    private parsePersistedMessage(raw: unknown): ChatMessage | null {
        const value = this.asRecord(raw);
        if (!value) {
            return null;
        }

        const id = typeof value.id === 'string' ? value.id : '';
        const role = value.role === 'user' || value.role === 'assistant' || value.role === 'system'
            ? value.role
            : undefined;
        const createdAt = typeof value.createdAt === 'number' ? value.createdAt : Date.now();

        if (!id || !role) {
            return null;
        }

        const attachments = this.normalizeAttachments(value.attachments);

        return {
            id,
            role,
            prompt: typeof value.prompt === 'string' ? value.prompt : undefined,
            thought: typeof value.thought === 'string' ? value.thought : undefined,
            content: typeof value.content === 'string' ? value.content : undefined,
            segments: this.normalizeMessageSegments(value.segments),
            attachments: attachments.length > 0 ? attachments : undefined,
            createdAt,
        };
    }

    private normalizeMessageSegments(raw: unknown): StreamSegment[] | undefined {
        if (!Array.isArray(raw)) {
            return undefined;
        }

        const segments = raw
            .map(item => this.normalizeStreamSegment(item))
            .filter((item): item is StreamSegment => Boolean(item));

        return segments.length > 0 ? segments : undefined;
    }

    private normalizeStreamSegment(raw: unknown): StreamSegment | null {
        const value = this.asRecord(raw);
        if (!value) {
            return null;
        }

        const seq = typeof value.seq === 'number' ? value.seq : 0;
        const phase = value.phase === 'thinking' || value.phase === 'answer' ? value.phase : undefined;
        const source = value.source === 'stdout' || value.source === 'stderr' || value.source === 'mixed'
            ? value.source
            : undefined;
        const type = value.type === 'text' || value.type === 'error' || value.type === 'exec' || value.type === 'patch'
            ? value.type
            : undefined;

        if (!phase || !source || !type) {
            return null;
        }

        if (type === 'text' || type === 'error') {
            if (typeof value.value !== 'string') {
                return null;
            }

            return {
                type,
                value: value.value,
                phase,
                source,
                seq,
            };
        }

        if (type === 'exec') {
            const execValue = this.asRecord(value.value);
            if (!execValue) {
                return null;
            }

            return {
                type,
                value: {
                    runnerLabel: typeof execValue.runnerLabel === 'string' ? execValue.runnerLabel : 'Command',
                    command: typeof execValue.command === 'string' ? execValue.command : '(empty command)',
                    cwd: typeof execValue.cwd === 'string' ? execValue.cwd : '',
                    status: typeof execValue.status === 'string' ? execValue.status : '',
                    duration: typeof execValue.duration === 'string' ? execValue.duration : '',
                    exitCode: typeof execValue.exitCode === 'string' ? execValue.exitCode : '',
                    output: typeof execValue.output === 'string' ? execValue.output : '',
                },
                phase,
                source,
                seq,
            };
        }

        const patchValue = this.asRecord(value.value);
        if (!patchValue) {
            return null;
        }

        return {
            type,
            value: {
                added: typeof patchValue.added === 'number' ? patchValue.added : 0,
                updated: typeof patchValue.updated === 'number' ? patchValue.updated : 0,
                deleted: typeof patchValue.deleted === 'number' ? patchValue.deleted : 0,
                moved: typeof patchValue.moved === 'number' ? patchValue.moved : 0,
                hunks: typeof patchValue.hunks === 'number' ? patchValue.hunks : 0,
                additions: typeof patchValue.additions === 'number' ? patchValue.additions : 0,
                deletions: typeof patchValue.deletions === 'number' ? patchValue.deletions : 0,
                files: Array.isArray(patchValue.files)
                    ? patchValue.files.map(item => String(item))
                    : [],
            },
            phase,
            source,
            seq,
        };
    }

    private toPersistedState(): SessionStoreState {
        return {
            version: SESSION_STORE_VERSION,
            activeSessionId: this._activeSessionId,
            sessions: this._sessions,
        };
    }

    private persistSessionStore() {
        const bucket = this.getStorageBucket();
        void bucket.update(this._storageKey, this.toPersistedState());
    }

    private asRecord(value: unknown): Record<string, unknown> | undefined {
        if (!value || typeof value !== 'object') {
            return undefined;
        }

        return value as Record<string, unknown>;
    }

    private sanitizeFileName(raw: string): string {
        const normalized = String(raw || '').trim() || 'session';
        return normalized
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .slice(0, 64) || 'session';
    }

    private buildTimestampLabel(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${year}${month}${day}-${hours}${minutes}`;
    }

    private createId(): string {
        try {
            return crypto.randomUUID();
        } catch {
            return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }
    }
}
