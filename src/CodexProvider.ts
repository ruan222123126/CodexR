import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as os from 'os';
import { parseCodexOutput } from './codexOutputParser';
import {
    consumeClaudeStreamChunk,
    createClaudeStreamAccumulator,
    finalizeClaudeStream,
} from './claudeOutputParser';
import { getWebviewHtml } from './webviewHtml';

type ProviderType = 'codex' | 'claude';

type NormalizedInput = {
    prompt: string;
    provider: ProviderType;
};

type ProviderCommand = {
    command: string;
    args: string[];
    promptViaStdin: boolean;
    versionArgs: string[];
};

export class CodexProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codex.chatView';
    private static readonly REQUEST_TIMEOUT_MS = 8 * 60 * 1000;
    private _view?: vscode.WebviewView;
    private _activeChild?: cp.ChildProcess;
    private _activeRequestId = 0;

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

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };
        const defaultProvider = this.getDefaultProvider();
        webviewView.webview.html = getWebviewHtml(webviewView.webview, defaultProvider);

        webviewView.webview.onDidReceiveMessage(data => {
            if (data.type === 'userInput') {
                const normalized = this.normalizeUserInput(data.value);
                if (!normalized) {
                    return;
                }
                this.executePrompt(normalized.prompt, normalized.provider);
            } else if (data.type === 'cancel') {
                this.cancelExecution();
            }
        });

        webviewView.webview.postMessage({
            type: 'provider-init',
            value: { provider: defaultProvider },
        });
    }

    private getDefaultProvider(): ProviderType {
        const configured = vscode.workspace.getConfiguration('codexSidebar').get<string>('defaultProvider', 'codex');
        return configured === 'claude' ? 'claude' : 'codex';
    }

    private normalizeProvider(value: unknown): ProviderType {
        return value === 'claude' ? 'claude' : 'codex';
    }

    private normalizeUserInput(value: unknown): NormalizedInput | null {
        if (typeof value === 'string') {
            const prompt = value.trim();
            if (!prompt) {
                return null;
            }
            return { prompt, provider: this.getDefaultProvider() };
        }

        if (!value || typeof value !== 'object') {
            return null;
        }

        const payload = value as { prompt?: unknown; provider?: unknown };
        if (typeof payload.prompt !== 'string') {
            return null;
        }

        const prompt = payload.prompt.trim();
        if (!prompt) {
            return null;
        }

        return {
            prompt,
            provider: this.normalizeProvider(payload.provider),
        };
    }

    private cancelExecution() {
        if (this._activeChild && !this._activeChild.killed) {
            const previousRequestId = this._activeRequestId;
            this._activeChild.kill();
            this._view?.webview.postMessage({
                type: 'stream-end',
                value: { requestId: previousRequestId, canceled: true },
            });
            this._activeChild = undefined;
        }
    }

    private executePrompt(prompt: string, provider: ProviderType) {
        this.postMessageToWebview('user', prompt);

        if (this._activeChild && !this._activeChild.killed) {
            const previousRequestId = this._activeRequestId;
            this._activeChild.kill();
            this._view?.webview.postMessage({
                type: 'stream-end',
                value: { requestId: previousRequestId, canceled: true },
            });
        }

        const requestId = ++this._activeRequestId;
        this._view?.webview.postMessage({
            type: 'stream-start',
            value: { requestId },
        });
        this.postMessageToWebview('system', provider === 'claude' ? 'Thinking with Claude...' : 'Thinking with Codex...');

        let workspaceDir = os.homedir();
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            workspaceDir = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }

        const providerCommand = this.buildProviderCommand(provider, prompt);
        if (!this.isCommandAvailable(providerCommand.command, providerCommand.versionArgs, workspaceDir)) {
            const installHint = provider === 'claude'
                ? 'Claude CLI not found. Install Claude Code and ensure `claude` is in your PATH.'
                : 'Codex CLI not found. Install Codex CLI and ensure `codex` is in your PATH.';

            this._view?.webview.postMessage({
                type: 'stream-end',
                value: { requestId, failed: true, error: installHint },
            });
            this.postMessageToWebview('done', '');
            return;
        }

        const child = cp.spawn(providerCommand.command, providerCommand.args, {
            shell: true,
            cwd: workspaceDir,
            env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
        });

        this._activeChild = child;

        if (providerCommand.promptViaStdin && child.stdin) {
            child.stdin.write(prompt + '\n');
            child.stdin.end();
        }

        let outputBuffer = '';
        let lastThought = '';
        let lastContent = '';
        let flushTimer: NodeJS.Timeout | undefined;
        let endedByTimeout = false;
        const claudeAccumulator = createClaudeStreamAccumulator();
        let claudeLastError = '';
        let claudeRawOutput = '';

        const emitStreamUpdate = (thought: string, content: string) => {
            this._view?.webview.postMessage({
                type: 'stream-update',
                value: {
                    requestId,
                    thought,
                    content,
                    stage: content ? 'answering' : 'thinking',
                },
            });
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
                if (parsed.content === lastContent) {
                    return;
                }

                lastContent = parsed.content;
                lastThought = '';
                emitStreamUpdate('', parsed.content);
                return;
            }

            const parsed = this.normalizeStreamResult(parseCodexOutput(outputBuffer, { strictRoleSplit: true }));
            if (parsed.thought === lastThought && parsed.content === lastContent) {
                return;
            }

            lastThought = parsed.thought;
            lastContent = parsed.content;

            emitStreamUpdate(parsed.thought, parsed.content);
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

            this._view?.webview.postMessage({
                type: 'stream-end',
                value: { requestId, timedOut: true },
            });

            this.postMessageToWebview('done', '');
        }, CodexProvider.REQUEST_TIMEOUT_MS);

        const onChildOutput = (chunk: any) => {
            const text = chunk.toString();
            if (provider === 'claude') {
                claudeRawOutput += text;
                const parsed = consumeClaudeStreamChunk(claudeAccumulator, text);
                if (parsed.error) {
                    claudeLastError = parsed.error;
                }
            } else {
                outputBuffer += text;
            }
            scheduleStreamUpdate();
        };

        child.stdout?.on('data', onChildOutput);
        child.stderr?.on('data', onChildOutput);

        child.on('error', (error: Error) => {
            clearTimeout(timeoutTimer);
            if (flushTimer) {
                clearTimeout(flushTimer);
                flushTimer = undefined;
            }

            if (requestId !== this._activeRequestId) {
                return;
            }

            this._view?.webview.postMessage({
                type: 'stream-end',
                value: { requestId, failed: true, error: error.message },
            });
            this.postMessageToWebview('done', '');
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

            if (provider === 'claude') {
                const finalClaude = finalizeClaudeStream(claudeAccumulator);
                if (finalClaude.error) {
                    claudeLastError = finalClaude.error;
                }
                if (finalClaude.content !== lastContent) {
                    lastContent = finalClaude.content;
                    lastThought = '';
                    emitStreamUpdate('', finalClaude.content);
                }

                if (!finalClaude.content) {
                    const fallbackError = this.pickClaudeFailureMessage(code, claudeLastError, claudeRawOutput);
                    this._view?.webview.postMessage({
                        type: 'stream-end',
                        value: { requestId, failed: true, error: fallbackError },
                    });
                    this.postMessageToWebview('done', '');
                    return;
                }
            } else {
                const streamResult = this.normalizeStreamResult(parseCodexOutput(outputBuffer, { strictRoleSplit: true }));
                const result = streamResult.content
                    ? streamResult
                    : this.normalizeStreamResult(parseCodexOutput(outputBuffer));

                if (result.thought !== lastThought || result.content !== lastContent) {
                    lastThought = result.thought;
                    lastContent = result.content;
                    emitStreamUpdate(result.thought, result.content);
                }

                if (!result.content && !result.thought) {
                    if (code !== 0) {
                        this._view?.webview.postMessage({
                            type: 'stream-end',
                            value: { requestId, failed: true, error: `Process failed (code ${code})` },
                        });
                    } else {
                        this._view?.webview.postMessage({
                            type: 'stream-end',
                            value: { requestId, failed: true, error: 'No response.' },
                        });
                    }
                    this.postMessageToWebview('done', '');
                    return;
                }
            }

            this._view?.webview.postMessage({
                type: 'stream-end',
                value: { requestId, finished: true },
            });

            this.postMessageToWebview('done', '');
        });
    }

    private postMessageToWebview(type: string, value: string) {
        this._view?.webview.postMessage({ type, value });
    }

    private buildProviderCommand(provider: ProviderType, prompt: string): ProviderCommand {
        if (provider === 'claude') {
            return {
                command: 'claude',
                args: [
                    '-p',
                    '--verbose',
                    '--output-format',
                    'stream-json',
                    '--no-session-persistence',
                    '--dangerously-skip-permissions',
                ],
                promptViaStdin: true,
                versionArgs: ['--version'],
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
        };
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
}
