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
};

type ChatMessage = {
    id: string;
    role: MessageRole;
    prompt?: string;
    thought?: string;
    content?: string;
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

            if (data.type === 'session-rename') {
                this.handleRenameSession(data.value);
                return;
            }

            if (data.type === 'session-delete') {
                this.handleDeleteSession(data.value);
            }
        });

        this.postToWebview('provider-init', {
            provider: this.getActiveSession()?.provider ?? defaultProvider,
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
        const session = this.resolveTargetSession(input.sessionId, input.provider);
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
        let lastSegmentsSnapshot = '';
        let flushTimer: NodeJS.Timeout | undefined;
        let endedByTimeout = false;
        const parserMode = this.getParserMode();

        const claudeAccumulator = createClaudeStreamAccumulator();
        let claudeLastError = '';
        let claudeRawOutput = '';

        const piAccumulator = createPiStreamAccumulator();
        let piLastError = '';

        const emitStreamUpdate = (thought: string, content: string, segments: StreamSegment[]) => {
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
            const strictParsed = this.normalizeStreamResult(parseCodexOutput(bufferText, { strictRoleSplit: true }));
            const parsed = strictParsed.content ? strictParsed : this.normalizeStreamResult(parseCodexOutput(bufferText));

            if (parsed.thought === lastThought && parsed.content === lastContent) {
                return;
            }

            lastThought = parsed.thought;
            lastContent = parsed.content;
            emitStreamUpdate(parsed.thought, parsed.content, this.createLegacySegments(parsed.thought, parsed.content));
        };

        const emitSegmentedCodexUpdate = () => {
            const strictParsed = parseCodexOutput(stdoutBuffer, { strictRoleSplit: true });
            const parsed = strictParsed.content ? strictParsed : parseCodexOutput(stdoutBuffer);
            const stdoutSegments = parsed.segments.map(segment => ({ ...segment, source: 'stdout' as const }));
            const stderrSegments = this.parseStderrOutput(stderrBuffer);
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

                const mergedSegments = this.mergeSegments(parsed.segments, this.parseStderrOutput(stderrBuffer));
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

                const mergedSegments = this.mergeSegments(parsed.segments, this.parseStderrOutput(stderrBuffer));
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
                    const mergedSegments = this.mergeSegments(finalClaude.segments, this.parseStderrOutput(stderrBuffer));
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

                const mergedSegments = this.mergeSegments(finalPi.segments, this.parseStderrOutput(stderrBuffer));
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
                    const strictParsed = this.normalizeStreamResult(parseCodexOutput(legacyBuffer, { strictRoleSplit: true }));
                    const parsed = strictParsed.content ? strictParsed : this.normalizeStreamResult(parseCodexOutput(legacyBuffer));

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
                    const strictParsed = parseCodexOutput(stdoutBuffer, { strictRoleSplit: true });
                    const parsed = strictParsed.content ? strictParsed : parseCodexOutput(stdoutBuffer);
                    const mergedSegments = this.mergeSegments(
                        parsed.segments.map(segment => ({ ...segment, source: 'stdout' as const })),
                        this.parseStderrOutput(stderrBuffer),
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
            this.appendAssistantMessage(session, finalThought, finalContent);
            this.persistSessionStore();

            this.postToWebview('stream-end', {
                requestId,
                finished: true,
                sessionId: session.id,
            });
            this.postToWebview('done', '');
            this.publishSessionState();
        });
    }

    private shouldInjectRecentContext(session: ChatSession, usesNativeSession: boolean): boolean {
        if (!usesNativeSession) {
            return true;
        }

        return Boolean(session.needsBootstrapContext);
    }

    private parseStderrOutput(stderrText: string): StreamSegment[] {
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

    private resolveTargetSession(sessionId: string | undefined, fallbackProvider: ProviderType): ChatSession | undefined {
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

    private appendAssistantMessage(session: ChatSession, thought: string, content: string) {
        const message: ChatMessage = {
            id: this.createId(),
            role: 'assistant',
            thought: thought || undefined,
            content: content || undefined,
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
            const fileContent = this.readAttachmentContent(attachment.path);
            const languageHint = this.detectLanguageFromPath(attachment.path);
            let text = fileContent;
            let truncated = false;

            if (text.length > CodexProvider.MAX_ATTACHMENT_CHARS_PER_FILE) {
                text = text.slice(0, CodexProvider.MAX_ATTACHMENT_CHARS_PER_FILE);
                truncated = true;
            }

            const remain = CodexProvider.MAX_ATTACHMENT_CHARS_TOTAL - totalChars;
            if (remain <= 0) {
                break;
            }

            if (text.length > remain) {
                text = text.slice(0, remain);
                truncated = true;
            }

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

    private readAttachmentContent(filePath: string): string {
        try {
            const buffer = fs.readFileSync(filePath);
            if (buffer.length === 0) {
                return '[Empty file]';
            }

            if (this.isProbablyBinary(buffer)) {
                return '[Binary file omitted]';
            }

            return buffer.toString('utf8');
        } catch {
            return '[Failed to read file]';
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
            attachments: attachments.length > 0 ? attachments : undefined,
            createdAt,
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

    private createId(): string {
        try {
            return crypto.randomUUID();
        } catch {
            return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }
    }
}
