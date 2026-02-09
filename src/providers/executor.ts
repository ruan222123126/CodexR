import * as cp from 'child_process';
import * as os from 'os';
import {
    extractCodexSessionId,
    parseCodexOutput,
} from '../codexOutputParser';
import {
    consumeClaudeStreamChunk,
    createClaudeStreamAccumulator,
    finalizeClaudeStream,
    type TokenUsage,
} from '../claudeOutputParser';
import {
    consumePiStreamChunk,
    createPiStreamAccumulator,
    finalizePiStream,
} from '../piOutputParser';
import {
    buildAnswerTextFromSegments,
    buildThoughtTextFromSegments,
    type StreamSegment,
} from '../streamTypes';
import type {
    ChatSession,
    ProviderCommand,
    ProviderType,
    ParserMode,
    NormalizedInput,
    AttachmentItem,
} from './types';

const REQUEST_TIMEOUT_MS = 8 * 60 * 1000;

export interface ExecutorDeps {
    postToWebview: (type: string, value: unknown) => void;
    buildProviderCommand: (session: ChatSession) => ProviderCommand;
    isCommandAvailable: (command: string, versionArgs: string[], cwd: string) => boolean;
    buildPromptWithAttachments: (prompt: string, attachments: AttachmentItem[]) => string;
    shouldInjectRecentContext: (session: ChatSession, usesNativeSession: boolean) => boolean;
    injectRecentConversationContext: (session: ChatSession, currentPrompt: string) => string;
    injectCodexCheckpointPolicy: (prompt: string) => string;
    getParserMode: () => ParserMode;
    shouldEnableCodexThinkingNoiseFilter: () => boolean;
    markNativeSessionFallbackIfNeeded: (
        session: ChatSession,
        providerCommand: ProviderCommand,
        cliError: string,
        rawOutput: string,
        code: number,
    ) => ChatSession | null;
}

export interface ExecutorCallbacks {
    onExecutionStart: (session: ChatSession) => void;
    onExecutionComplete: (
        session: ChatSession,
        thought: string,
        content: string,
        segments: StreamSegment[],
    ) => ChatSession;
    onExecutionError: (session: ChatSession, error: string) => ChatSession;
}

export class Executor {
    private _activeRequestId = 0;
    private _activeChild?: cp.ChildProcess;

    constructor(
        private readonly deps: ExecutorDeps,
        private readonly callbacks: ExecutorCallbacks,
    ) {}

    cancelExecution(): void {
        if (this._activeChild && !this._activeChild.killed) {
            const previousRequestId = this._activeRequestId;
            this._activeChild.kill();
            this.deps.postToWebview('stream-end', {
                requestId: previousRequestId,
                canceled: true,
            });
            this._activeChild = undefined;
        }
    }

    async executePrompt(
        session: ChatSession,
        input: NormalizedInput,
    ): Promise<ChatSession> {
        let currentSession = session;
        const provider = session.provider;

        this.callbacks.onExecutionStart(currentSession);

        if (this._activeChild && !this._activeChild.killed) {
            const previousRequestId = this._activeRequestId;
            this._activeChild.kill();
            this.deps.postToWebview('stream-end', {
                requestId: previousRequestId,
                canceled: true,
            });
        }

        const requestId = ++this._activeRequestId;

        this.deps.postToWebview('stream-start', {
            requestId,
            sessionId: session.id,
        });

        if (provider === 'claude') {
            this.deps.postToWebview('system', 'Thinking with Claude...');
        } else if (provider === 'pi') {
            this.deps.postToWebview('system', 'Thinking with Pi...');
        } else if (session.backendSessionId) {
            this.deps.postToWebview('system', 'Resuming Codex session...');
        } else {
            this.deps.postToWebview('system', 'Thinking with Codex...');
        }

        let workspaceDir = os.homedir();
        if (require('vscode').workspace.workspaceFolders && require('vscode').workspace.workspaceFolders.length > 0) {
            workspaceDir = require('vscode').workspace.workspaceFolders[0].uri.fsPath;
        }

        const providerCommand = this.deps.buildProviderCommand(session);
        if (!this.deps.isCommandAvailable(providerCommand.command, providerCommand.versionArgs, workspaceDir)) {
            const installHint = provider === 'claude'
                ? 'Claude CLI not found. Install Claude Code and ensure `claude` is in your PATH.'
                : (provider === 'pi'
                    ? 'Pi CLI not found. Install Pi CLI and ensure `pi` is in your PATH.'
                    : 'Codex CLI not found. Install Codex CLI and ensure `codex` is in your PATH.');

            this.deps.postToWebview('stream-end', {
                requestId,
                failed: true,
                error: installHint,
                sessionId: session.id,
            });
            this.deps.postToWebview('done', '');

            currentSession = this.callbacks.onExecutionError(currentSession, installHint);
            return currentSession;
        }

        let promptWithContext = this.deps.buildPromptWithAttachments(input.prompt, input.attachments);

        if (this.deps.shouldInjectRecentContext(session, providerCommand.usesNativeSession)) {
            promptWithContext = this.deps.injectRecentConversationContext(session, promptWithContext);
        }

        if (provider === 'codex') {
            promptWithContext = this.deps.injectCodexCheckpointPolicy(promptWithContext);
        }

        const result = await this.runCommand(
            provider,
            providerCommand,
            promptWithContext,
            workspaceDir,
            requestId,
            session.id,
        );

        if (result.error) {
            // Check if this is a native session failure and mark for fallback
            const fallbackSession = this.deps.markNativeSessionFallbackIfNeeded(
                currentSession,
                providerCommand,
                result.error,
                result.rawOutput,
                result.exitCode ?? -1,
            );
            if (fallbackSession) {
                currentSession = fallbackSession;
            }
            currentSession = this.callbacks.onExecutionError(currentSession, result.error);
        } else {
            if (provider === 'codex' && !session.backendSessionId) {
                const sessionId = extractCodexSessionId(result.rawOutput);
                if (sessionId) {
                    currentSession = { ...currentSession, backendSessionId: sessionId };
                }
            }

            currentSession = { ...currentSession, needsBootstrapContext: false };
            currentSession = this.callbacks.onExecutionComplete(
                currentSession,
                result.thought,
                result.content,
                result.segments,
            );
        }

        return currentSession;
    }

    private async runCommand(
        provider: ProviderType,
        providerCommand: ProviderCommand,
        prompt: string,
        cwd: string,
        requestId: number,
        sessionId: string,
    ): Promise<{
        thought: string;
        content: string;
        segments: StreamSegment[];
        error?: string;
        rawOutput: string;
        exitCode?: number;
    }> {
        const child = cp.spawn(providerCommand.command, providerCommand.args, {
            shell: true,
            cwd,
            env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
        });

        this._activeChild = child;

        if (providerCommand.promptViaStdin && child.stdin) {
            child.stdin.write(prompt + '\n');
            child.stdin.end();
        }

        const parserMode = this.deps.getParserMode();
        const codexThinkingNoiseFilterEnabled = this.deps.shouldEnableCodexThinkingNoiseFilter();

        const parseCodex = (text: string, strictRoleSplit = false) => parseCodexOutput(text, {
            strictRoleSplit,
            filterThinkingNoise: codexThinkingNoiseFilterEnabled,
        });

        const claudeAccumulator = createClaudeStreamAccumulator();
        let claudeLastError = '';
        let claudeRawOutput = '';

        const piAccumulator = createPiStreamAccumulator();
        let piLastError = '';

        let stdoutBuffer = '';
        let stderrBuffer = '';
        let lastThought = '';
        let lastContent = '';
        let finalSegments: StreamSegment[] = [];
        let lastSegmentsSnapshot = '';
        let flushTimer: NodeJS.Timeout | undefined;
        let endedByTimeout = false;

        const emitStreamUpdate = (thought: string, content: string, segments: StreamSegment[], usage?: TokenUsage | null) => {
            finalSegments = segments;
            this.deps.postToWebview('stream-update', {
                requestId,
                sessionId,
                thought,
                content,
                stage: content ? 'answering' : 'thinking',
                segments,
                usage: usage || undefined,
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
                emitStreamUpdate(thought, content, mergedSegments, parsed.usage);
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

        return new Promise((resolve) => {
            const timeoutTimer = setTimeout(() => {
                if (requestId !== this._activeRequestId || child.killed) {
                    return;
                }

                endedByTimeout = true;
                if (flushTimer) {
                    clearTimeout(flushTimer);
                    flushTimer = undefined;
                }
                child.kill();

                this.deps.postToWebview('stream-end', {
                    requestId,
                    timedOut: true,
                    sessionId,
                });
                this.deps.postToWebview('done', '');

                resolve({
                    thought: lastThought,
                    content: lastContent,
                    segments: finalSegments,
                    error: 'Request timed out.',
                    rawOutput: stdoutBuffer,
                    exitCode: -1,
                });
            }, REQUEST_TIMEOUT_MS);

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

                this.deps.postToWebview('stream-end', {
                    requestId,
                    failed: true,
                    error: error.message,
                    sessionId,
                });
                this.deps.postToWebview('done', '');

                resolve({
                    thought: lastThought,
                    content: lastContent,
                    segments: finalSegments,
                    error: error.message,
                    rawOutput: stdoutBuffer,
                    exitCode: -1,
                });
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
                    resolve({
                        thought: lastThought,
                        content: lastContent,
                        segments: finalSegments,
                        rawOutput: stdoutBuffer,
                        exitCode: code,
                    });
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
                        emitStreamUpdate(finalThought, finalContent, mergedSegments, finalClaude.usage);
                    }

                    if (!finalClaude.content) {
                        const fallbackError = this.pickClaudeFailureMessage(code, claudeLastError, claudeRawOutput);
                        this.deps.postToWebview('stream-end', {
                            requestId,
                            failed: true,
                            error: fallbackError,
                            sessionId,
                        });
                        this.deps.postToWebview('done', '');

                        resolve({
                            thought: lastThought,
                            content: lastContent,
                            segments: finalSegments,
                            error: fallbackError,
                            rawOutput: claudeRawOutput + '\n' + stderrBuffer,
                            exitCode: code,
                        });
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
                        this.deps.postToWebview('stream-end', {
                            requestId,
                            failed: true,
                            error: errorText,
                            sessionId,
                        });
                        this.deps.postToWebview('done', '');

                        resolve({
                            thought: lastThought,
                            content: lastContent,
                            segments: finalSegments,
                            error: errorText,
                            rawOutput: stdoutBuffer + '\n' + stderrBuffer,
                            exitCode: code,
                        });
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

                            this.deps.postToWebview('stream-end', {
                                requestId,
                                failed: true,
                                error: errorText,
                                sessionId,
                            });
                            this.deps.postToWebview('done', '');

                            resolve({
                                thought: lastThought,
                                content: lastContent,
                                segments: finalSegments,
                                error: errorText,
                                rawOutput: legacyBuffer,
                                exitCode: code,
                            });
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

                            this.deps.postToWebview('stream-end', {
                                requestId,
                                failed: true,
                                error: errorText,
                                sessionId,
                            });
                            this.deps.postToWebview('done', '');

                            resolve({
                                thought: lastThought,
                                content: lastContent,
                                segments: finalSegments,
                                error: errorText,
                                rawOutput: stdoutBuffer + '\n' + stderrBuffer,
                                exitCode: code,
                            });
                            return;
                        }
                    }
                }

                this.deps.postToWebview('stream-end', {
                    requestId,
                    finished: true,
                    sessionId,
                });
                this.deps.postToWebview('done', '');

                resolve({
                    thought: finalThought,
                    content: finalContent,
                    segments: finalSegments,
                    rawOutput: stdoutBuffer,
                    exitCode: code,
                });
            });
        });
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
}
