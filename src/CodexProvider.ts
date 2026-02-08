import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as os from 'os';

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
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            if (data.type === 'userInput') {
                this.executeCodex(data.value);
            }
        });
    }

    private executeCodex(prompt: string) {
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
        this.postMessageToWebview('system', 'Thinking...');

        let workspaceDir = os.homedir();
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            workspaceDir = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }

        const command = 'codex';
        const args = [
            'exec', 
            '--dangerously-bypass-approvals-and-sandbox', 
            '--skip-git-repo-check'
        ];

        const child = cp.spawn(command, args, {
            shell: true,
            cwd: workspaceDir,
            env: { ...process.env, LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" }
        });

        this._activeChild = child;

        if (child.stdin) {
            child.stdin.write(prompt + "\n");
            child.stdin.end(); 
        }

        let outputBuffer = '';
        let lastThought = '';
        let lastContent = '';
        let flushTimer: NodeJS.Timeout | undefined;
        let endedByTimeout = false;

        const pushStreamUpdate = () => {
            if (requestId !== this._activeRequestId) {
                return;
            }

            const parsed = this.normalizeStreamResult(this.parseCodexOutput(outputBuffer, { strictRoleSplit: true }));
            if (parsed.thought === lastThought && parsed.content === lastContent) {
                return;
            }

            lastThought = parsed.thought;
            lastContent = parsed.content;

            this._view?.webview.postMessage({
                type: 'stream-update',
                value: {
                    requestId,
                    thought: parsed.thought,
                    content: parsed.content,
                    stage: parsed.content ? 'answering' : 'thinking',
                },
            });
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

        child.stdout?.on('data', (data: any) => {
            outputBuffer += data.toString();
            scheduleStreamUpdate();
        });

        child.stderr?.on('data', (data: any) => {
            outputBuffer += data.toString();
            scheduleStreamUpdate();
        });

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
            const streamResult = this.normalizeStreamResult(this.parseCodexOutput(outputBuffer, { strictRoleSplit: true }));
            const result = streamResult.content
                ? streamResult
                : this.normalizeStreamResult(this.parseCodexOutput(outputBuffer));

            if (result.thought !== lastThought || result.content !== lastContent) {
                lastThought = result.thought;
                lastContent = result.content;
                this._view?.webview.postMessage({
                    type: 'stream-update',
                    value: {
                        requestId,
                        thought: result.thought,
                        content: result.content,
                        stage: result.content ? 'answering' : 'thinking',
                    },
                });
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
            }

            this._view?.webview.postMessage({
                type: 'stream-end',
                value: { requestId, finished: true },
            });

            this.postMessageToWebview('done', '');
        });
    }

    /**
     * 🧠 智能切分：分离思考过程和最终回复
     */
    private parseCodexOutput(raw: string, options?: { strictRoleSplit?: boolean }): { thought: string, content: string } {
        // 1. 去除 ANSI 颜色和回车符
        let text = raw.replace(/\x1b\[[0-9;]*m/g, '');

        // 2. ✂️ 关键一步：在 "tokens used" 处一刀切断
        // 这解决了复读机问题，因为重复的内容都在 tokens used 后面
        text = text.split(/tokens used/i)[0];

        // 3. 去除开头垃圾信息
        text = text.replace(/^Reading prompt from stdin\.\.\./gm, '');
        text = text.replace(/mcp startup:.*$/gm, '');
        text = text.replace(/^\s*\[[^\]]+\]\s*$/gm, '');

        // 4. 分离 Thinking 和 Codex 回复
        // 流式模式：只允许在 "thinking" 之后出现的独立 "codex" 行作为回答起点
        let splitIndex = -1;
        let splitLength = 0;
        const lowerText = text.toLowerCase();
        const thinkingAnchor = lowerText.indexOf('thinking');

        const roleRegex = /^\s*codex\s*:?[\t ]*$/gim;
        let roleMatch: RegExpExecArray | null;

        if (options?.strictRoleSplit) {
            if (thinkingAnchor !== -1) {
                while ((roleMatch = roleRegex.exec(text)) !== null) {
                    if (roleMatch.index > thinkingAnchor) {
                        splitIndex = roleMatch.index;
                        splitLength = roleMatch[0].length;
                    }
                }
            }
        } else {
            while ((roleMatch = roleRegex.exec(text)) !== null) {
                splitIndex = roleMatch.index;
                splitLength = roleMatch[0].length;
            }

            // 回退：非流式收尾可用关键词最后一次出现位置
            if (splitIndex === -1) {
                const splitKeyword = 'codex';
                splitIndex = lowerText.lastIndexOf(splitKeyword);
                splitLength = splitKeyword.length;
            }
        }

        let thought = '';
        let content = '';

        if (splitIndex !== -1) {
            thought = text.substring(0, splitIndex).trim();
            content = text.substring(splitIndex + splitLength).trim();
        } else {
            const trimmedText = text.trim();
            const lower = trimmedText.toLowerCase();
            const looksLikeBootstrap =
                lower.includes('provider:') ||
                lower.includes('approval:') ||
                lower.includes('sandbox:') ||
                lower.includes('reasoning effort:') ||
                lower.includes('reasoning summary:') ||
                lower.includes('reasoning summaries:') ||
                lower.includes('session id:') ||
                /(^|\n)\s*user\s*(\n|$)/i.test(trimmedText);

            if (options?.strictRoleSplit || looksLikeBootstrap) {
                thought = trimmedText;
                content = '';
            } else {
                // 如果没找到 codex 标记，就整个当做回复
                content = trimmedText;
            }
        }

        // 5. 清理 Thought 里的 Metadata (版本号、路径等)
        // 我们只保留 "thinking" 之后的内容，或者 "exec" 相关的
        const thinkingStart = thought.toLowerCase().indexOf('thinking');
        if (thinkingStart !== -1) {
            thought = thought.substring(thinkingStart).trim();
        } else {
            // 如果没找到 thinking 关键字，尝试把头部那一堆 workdir/model 删掉
            // 简单粗暴：删掉 user 之前的所有内容
            const userIndex = thought.toLowerCase().indexOf('user ');
            if (userIndex !== -1) {
                thought = thought.substring(userIndex).trim();
            }
        }
        
        // 把 user 重复的那句去掉
        thought = thought.replace(/^user\s+.*$/im, ''); 

        thought = this.stripThoughtMetadata(thought);
        content = this.dedupeFinalContent(content);

        return { thought, content };
    }

    private stripThoughtMetadata(thought: string): string {
        const lines = thought.replace(/\r/g, '').split('\n');
        const result: string[] = [];
        let skippingSessionTail = false;
        let skipNextValueLine = false;

        const metaPrefixes = [
            'openai codex',
            'workdir:',
            'model:',
            'provider:',
            'approval:',
            'sandbox:',
            'reasoning effort:',
            'reasoning summary:',
            'reasoning summaries:',
            'session id:',
        ];

        for (const line of lines) {
            const trimmed = line.trim();
            const lower = trimmed.toLowerCase();

            if (!trimmed) {
                if (skipNextValueLine) {
                    continue;
                }
                result.push(line);
                continue;
            }

            if (skippingSessionTail) {
                if (/^[0-9a-f-]+$/i.test(trimmed) || /^-+$/.test(trimmed)) {
                    continue;
                }
                skippingSessionTail = false;
            }

            if (skipNextValueLine) {
                skipNextValueLine = false;
                continue;
            }

            if (/^-{5,}$/.test(trimmed)) {
                continue;
            }

            if (lower === '(research preview)') {
                continue;
            }

            if (lower === 'user') {
                skipNextValueLine = true;
                continue;
            }

            if (metaPrefixes.some(prefix => lower.startsWith(prefix))) {
                if (lower.startsWith('session id:')) {
                    skippingSessionTail = true;
                }

                const colonIndex = trimmed.indexOf(':');
                const hasInlineValue = colonIndex !== -1 && trimmed.slice(colonIndex + 1).trim().length > 0;
                if (!hasInlineValue && (lower.startsWith('workdir:') || lower.startsWith('session id:'))) {
                    skipNextValueLine = true;
                }

                continue;
            }

            result.push(line);
        }

        return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    private dedupeFinalContent(content: string): string {
        const normalized = content.replace(/\r/g, '').trim();
        if (!normalized) {
            return '';
        }

        const lines = normalized.split('\n');
        const dedupedLines: string[] = [];

        for (const line of lines) {
            const last = dedupedLines[dedupedLines.length - 1] ?? '';
            if (line.trim() && line.trim() === last.trim()) {
                continue;
            }
            dedupedLines.push(line);
        }

        const lineCleaned = dedupedLines.join('\n').trim();

        const halfIndex = Math.floor(dedupedLines.length / 2);
        if (dedupedLines.length >= 4 && dedupedLines.length % 2 === 0) {
            const firstHalf = dedupedLines.slice(0, halfIndex).map(line => line.trimEnd()).join('\n').trim();
            const secondHalf = dedupedLines.slice(halfIndex).map(line => line.trimEnd()).join('\n').trim();
            if (firstHalf && firstHalf === secondHalf) {
                return dedupedLines.slice(0, halfIndex).join('\n').trim();
            }
        }

        const doubledBlock = lineCleaned.match(/^([\s\S]{30,}?)\n{1,}\1$/);
        if (doubledBlock) {
            return doubledBlock[1].trim();
        }

        return lineCleaned;
    }

    private postMessageToWebview(type: string, value: string) {
        this._view?.webview.postMessage({ type, value });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        padding: 0; margin: 0;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        display: flex; flex-direction: column; height: 100vh;
                    }
                    #chat-container {
                        flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px;
                        display: flex; flex-direction: column; gap: 15px;
                    }
                    .message {
                        max-width: 90%;
                        min-width: 0;
                        padding: 12px 16px;
                        border-radius: 8px;
                        font-size: 14px;
                        line-height: 1.6;
                        word-wrap: break-word;
                    }
                    .message.user {
                        align-self: flex-end;
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    .message.bot {
                        align-self: flex-start;
                        background-color: var(--vscode-editor-inactiveSelectionBackground);
                        color: var(--vscode-editor-foreground);
                        padding: 0; /* Bot 消息由内部元素填充 */
                        background-color: transparent; /* 透明背景，依靠内部块着色 */
                    }
                    
                    /* 🧠 思考过程折叠块样式 */
                    details.thinking-block {
                        background-color: var(--vscode-textBlockQuote-background);
                        border: 1px solid var(--vscode-textBlockQuote-border);
                        border-radius: 6px;
                        margin-bottom: 10px;
                        min-width: 0;
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                    }
                    details.thinking-block summary {
                        padding: 8px 12px;
                        cursor: pointer;
                        font-weight: 600;
                        user-select: none;
                        outline: none;
                        list-style: none; /* 隐藏默认三角，下面自定义 */
                    }
                    details.thinking-block summary::-webkit-details-marker { display: none; }
                    details.thinking-block summary::before {
                        content: '▶ ';
                        font-size: 10px;
                        display: inline-block;
                        margin-right: 5px;
                        transition: transform 0.2s;
                    }
                    details[open].thinking-block summary::before {
                        transform: rotate(90deg);
                    }
                    .thinking-content {
                        padding: 10px 12px;
                        border-top: 1px solid var(--vscode-textBlockQuote-border);
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        min-width: 0;
                        max-height: 260px;
                        overflow-x: hidden;
                        overflow-y: auto;
                    }
                    .thinking-text {
                        white-space: pre-wrap;
                        overflow-wrap: anywhere;
                        word-break: break-word;
                        font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
                        font-size: 12px;
                        line-height: 1.5;
                        opacity: 0.9;
                    }
                    .op-card {
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 8px;
                        background: var(--vscode-editorHoverWidget-background, rgba(128, 128, 128, 0.12));
                        padding: 8px 10px;
                        min-width: 0;
                    }
                    .op-card + .op-card {
                        margin-top: 2px;
                    }
                    .op-card-head {
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        margin-bottom: 6px;
                    }
                    .op-head-right {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .op-badge {
                        font-size: 11px;
                        font-weight: 600;
                        letter-spacing: 0.2px;
                        color: var(--vscode-descriptionForeground);
                    }
                    .op-status {
                        font-size: 11px;
                        font-weight: 600;
                    }
                    .op-status.success {
                        color: var(--vscode-testing-iconPassed, #4caf50);
                    }
                    .op-status.failed {
                        color: var(--vscode-errorForeground, #f14c4c);
                    }
                    .op-time {
                        font-size: 10px;
                        color: var(--vscode-descriptionForeground);
                    }
                    .op-command {
                        font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
                        font-size: 12px;
                        line-height: 1.45;
                        white-space: pre-wrap;
                        overflow-wrap: anywhere;
                        word-break: break-word;
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        border-radius: 4px;
                        padding: 6px 8px;
                    }
                    .op-output {
                        margin-top: 6px;
                        font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
                        font-size: 12px;
                        line-height: 1.45;
                        white-space: pre-wrap;
                        overflow-wrap: anywhere;
                        word-break: break-word;
                        background: rgba(0, 0, 0, 0.18);
                        border-radius: 4px;
                        padding: 6px 8px;
                        border: 1px solid var(--vscode-panel-border);
                    }
                    .op-meta {
                        margin-top: 6px;
                        font-size: 11px;
                        overflow-wrap: anywhere;
                        color: var(--vscode-descriptionForeground);
                    }
                    .op-files {
                        margin: 8px 0 0;
                        padding-left: 16px;
                        font-size: 12px;
                    }
                    .op-files li {
                        margin: 2px 0;
                        font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
                    }

                    /* 💬 最终回复样式 */
                    .answer-block {
                        background-color: var(--vscode-editor-inactiveSelectionBackground);
                        padding: 12px 16px;
                        border-radius: 8px;
                    }
                    .answer-block p { margin: 0 0 10px 0; }
                    .answer-block p:last-child { margin-bottom: 0; }
                    .answer-block pre {
                        background: rgba(0,0,0,0.3);
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                    }
                    .stream-placeholder {
                        color: var(--vscode-descriptionForeground);
                        font-size: 12px;
                    }
                    .stream-caret {
                        display: inline-block;
                        margin-left: 2px;
                        animation: blink-caret 1s steps(1, end) infinite;
                    }
                    @keyframes blink-caret {
                        50% { opacity: 0; }
                    }
                    
                    .system-msg {
                        text-align: center; font-size: 12px; opacity: 0.6; margin: 5px 0;
                    }
                    #input-area {
                        padding: 15px;
                        background: var(--vscode-editor-background);
                        border-top: 1px solid var(--vscode-panel-border);
                        display: flex; gap: 10px;
                    }
                    textarea {
                        flex: 1;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 4px;
                        padding: 10px;
                        resize: none;
                        height: 40px;
                    }
                    button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none; border-radius: 4px; padding: 0 20px; cursor: pointer;
                    }
                </style>
            </head>
            <body>
                <div id="chat-container"></div>
                <div id="input-area">
                    <textarea id="input-box" placeholder="Ask Codex..."></textarea>
                    <button id="send-btn">Send</button>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    marked.setOptions({ breaks: true, gfm: true });

                    const container = document.getElementById('chat-container');
                    const inputBox = document.getElementById('input-box');
                    let loadingDiv = null;
                    let activeStreamId = null;
                    let activeStreamElements = null;
                    let activeStreamState = null;

                    function escapeHtml(value) {
                        return String(value ?? '')
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#39;');
                    }

                    function trimWrapper(line) {
                        return line.trim()
                            .replace(/^[([{]+/, '')
                            .replace(/[)\]}]+$/, '')
                            .trim();
                    }

                    function isExecStart(line) {
                        const normalized = trimWrapper(line).toLowerCase();
                        return normalized === 'exec' || normalized.startsWith('exec ');
                    }

                    function isPatchStart(line) {
                        const trimmed = line.trim();
                        return trimmed.includes('apply_patch') || trimmed.startsWith('*** Begin Patch');
                    }

                    function isBoundary(line) {
                        const trimmed = line.trim();
                        if (!trimmed) {
                            return false;
                        }
                        return isExecStart(trimmed) || isPatchStart(trimmed);
                    }

                    function isThoughtStepLine(line) {
                        const trimmed = line.trim();
                        if (!trimmed) {
                            return false;
                        }
                        if (trimmed.toLowerCase() === 'thinking') {
                            return true;
                        }
                        return trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4;
                    }

                    function looksLikeThinkingOnly(text) {
                        const normalized = String(text || '').replaceAll(String.fromCharCode(13), '').trim().toLowerCase();
                        if (!normalized) {
                            return false;
                        }

                        const lineFeed = String.fromCharCode(10);
                        const execBlock = lineFeed + 'exec' + lineFeed;

                        return normalized.startsWith('exec')
                            || normalized.includes(execBlock)
                            || normalized.includes(' succeeded in ')
                            || normalized.includes(' failed in ')
                            || normalized.includes(' exited ')
                            || normalized.includes('powershell.exe')
                            || normalized.includes('cmd.exe')
                            || normalized.includes('apply_patch');
                    }

                    function parseExecSummary(summaryLine) {
                        let cleaned = trimWrapper(summaryLine).trim();
                        if (cleaned.toLowerCase().startsWith('exec ')) {
                            cleaned = cleaned.slice(5).trim();
                        }

                        const lower = cleaned.toLowerCase();
                        let status = '';
                        let marker = '';
                        let exitCode = '';

                        if (lower.includes(' succeeded in ')) {
                            status = 'succeeded';
                            marker = ' succeeded in ';
                        } else if (lower.includes(' failed in ')) {
                            status = 'failed';
                            marker = ' failed in ';
                        } else if (lower.includes(' exited ')) {
                            status = 'failed';
                            marker = ' exited ';
                        }

                        if (marker) {
                            const markerIndex = lower.lastIndexOf(marker);
                            const beforeStatus = cleaned.slice(0, markerIndex).trim();
                            const afterStatus = cleaned.slice(markerIndex + marker.length).trim();

                            let durationRaw = afterStatus;
                            if (marker === ' exited ') {
                                const afterLower = afterStatus.toLowerCase();
                                const inIndex = afterLower.indexOf(' in ');
                                if (inIndex !== -1) {
                                    exitCode = afterStatus.slice(0, inIndex).trim();
                                    durationRaw = afterStatus.slice(inIndex + 4).trim();
                                } else {
                                    exitCode = afterStatus.trim();
                                    durationRaw = '';
                                }
                                if (exitCode === '0') {
                                    status = 'succeeded';
                                }
                            }

                            const duration = durationRaw.endsWith(':') ? durationRaw.slice(0, -1).trim() : durationRaw;

                            const beforeLower = beforeStatus.toLowerCase();
                            const inMarker = ' in ';
                            const inIndex = beforeLower.lastIndexOf(inMarker);

                            let rawCommand = beforeStatus;
                            let cwd = '';
                            if (inIndex > 0) {
                                rawCommand = beforeStatus.slice(0, inIndex).trim();
                                cwd = beforeStatus.slice(inIndex + inMarker.length).trim();
                            }

                            const commandInfo = extractCommandInfo(rawCommand);

                            return {
                                runnerLabel: commandInfo.runnerLabel,
                                command: commandInfo.command,
                                cwd,
                                status,
                                duration,
                                exitCode,
                                output: '',
                            };
                        }

                        const fallbackInfo = extractCommandInfo(cleaned || '(empty command)');
                        return {
                            runnerLabel: fallbackInfo.runnerLabel,
                            command: fallbackInfo.command,
                            cwd: '',
                            status: '',
                            duration: '',
                            exitCode: '',
                            output: '',
                        };
                    }

                    function extractCommandInfo(rawCommand) {
                        const cleaned = String(rawCommand || '').trim();
                        const lower = cleaned.toLowerCase();

                        const stripQuote = (value) => {
                            const text = String(value || '').trim();
                            if (text.length < 2) {
                                return text;
                            }
                            const first = text[0];
                            const last = text[text.length - 1];
                            const isSingleQuoted = first.charCodeAt(0) === 39 && last.charCodeAt(0) === 39;
                            const isDoubleQuoted = first.charCodeAt(0) === 34 && last.charCodeAt(0) === 34;
                            if (isSingleQuoted || isDoubleQuoted) {
                                return text.slice(1, -1).trim();
                            }
                            return text;
                        };

                        const removeRunner = (text) => {
                            const value = String(text || '').trim();
                            const firstSpace = value.indexOf(' ');
                            if (firstSpace === -1) {
                                return '';
                            }
                            return value.slice(firstSpace + 1).trim();
                        };

                        const fromSwitch = (text, switches) => {
                            const value = String(text || '').trim();
                            if (!value) {
                                return value;
                            }
                            const valueLower = value.toLowerCase();

                            for (const sw of switches) {
                                const key = sw.toLowerCase();
                                const patterns = [key + ' ', key + ':'];
                                for (const pattern of patterns) {
                                    const idx = valueLower.indexOf(pattern);
                                    if (idx !== -1) {
                                        return stripQuote(value.slice(idx + pattern.length).trim());
                                    }
                                }
                            }

                            return stripQuote(value);
                        };

                        if (lower.startsWith('powershell.exe') || lower.startsWith('pwsh')) {
                            const rest = removeRunner(cleaned);
                            return {
                                runnerLabel: 'PowerShell',
                                command: fromSwitch(rest, ['-command', '-c']) || cleaned,
                            };
                        }

                        if (lower.startsWith('cmd.exe') || lower.startsWith('cmd ')) {
                            const cmdBody = removeRunner(cleaned);
                            const cmdLower = cmdBody.toLowerCase();
                            let commandText = cmdBody;
                            const cIndex = cmdLower.indexOf('/c ');
                            const kIndex = cmdLower.indexOf('/k ');

                            if (cIndex !== -1) {
                                commandText = cmdBody.slice(cIndex + 3).trim();
                            } else if (kIndex !== -1) {
                                commandText = cmdBody.slice(kIndex + 3).trim();
                            }

                            return {
                                runnerLabel: 'CMD',
                                command: stripQuote(commandText || cmdBody || cleaned),
                            };
                        }

                        if (lower.startsWith('bash') || lower.startsWith('/bin/bash')) {
                            const rest = removeRunner(cleaned);
                            return {
                                runnerLabel: 'Bash',
                                command: fromSwitch(rest, ['-c']) || cleaned,
                            };
                        }

                        return {
                            runnerLabel: 'Command',
                            command: cleaned || '(empty command)',
                        };
                    }

                    function renderExecCard(entry) {
                        const statusLabel = entry.exitCode
                            ? ('Exit ' + escapeHtml(entry.exitCode))
                            : (entry.status
                                ? entry.status.charAt(0).toUpperCase() + entry.status.slice(1)
                                : 'Executed');
                        const statusClass = entry.status === 'failed' ? 'failed' : 'success';
                        const timeLabel = entry.duration ? escapeHtml(entry.duration) : '';

                        return \`<div class="op-card op-exec">
                            <div class="op-card-head">
                                <span class="op-badge">\${escapeHtml(entry.runnerLabel || 'Command')}</span>
                                <div class="op-head-right">
                                    <span class="op-status \${statusClass}">\${statusLabel}</span>
                                    \${timeLabel ? \`<span class="op-time">\${timeLabel}</span>\` : ''}
                                </div>
                            </div>
                            <div class="op-command">\${escapeHtml(entry.command)}</div>
                            \${entry.output ? \`<div class="op-output">\${escapeHtml(entry.output)}</div>\` : ''}
                        </div>\`;
                    }

                    function renderPatchCard(entry) {
                        const summary = \`Add \${entry.added} · Update \${entry.updated} · Delete \${entry.deleted}\`;
                        const filesHtml = entry.files.length > 0
                            ? \`<ul class="op-files">\${entry.files.map(file => \`<li>\${escapeHtml(file)}</li>\`).join('')}</ul>\`
                            : '';

                        return \`<div class="op-card op-patch">
                            <div class="op-card-head">
                                <span class="op-badge">File Change</span>
                                <span class="op-status success">Applied</span>
                            </div>
                            <div class="op-command">\${escapeHtml(summary)}</div>
                            \${filesHtml}
                        </div>\`;
                    }

                    function renderThinkingContent(thoughtText) {
                        const normalizedText = String(thoughtText || '').replaceAll(String.fromCharCode(13), '');
                        const lines = normalizedText.split(String.fromCharCode(10));
                        const parts = [];
                        let textBuffer = [];

                        const flushText = () => {
                            if (textBuffer.length > 0) {
                                const text = textBuffer.join(String.fromCharCode(10)).trim();
                                if (text) {
                                    parts.push({ type: 'text', value: text });
                                }
                                textBuffer = [];
                            }
                        };

                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i];
                            const trimmed = line.trim();

                            if (!trimmed) {
                                textBuffer.push('');
                                continue;
                            }

                            if (isExecStart(trimmed)) {
                                flushText();

                                let summaryLine = trimWrapper(trimmed);
                                if (!summaryLine.toLowerCase().startsWith('exec ')) {
                                    for (let j = i + 1; j < lines.length; j++) {
                                        const candidate = lines[j].trim();
                                        if (!candidate) {
                                            continue;
                                        }
                                        if (isBoundary(candidate)) {
                                            break;
                                        }
                                        summaryLine = candidate;
                                        i = j;
                                        break;
                                    }
                                }

                                const entry = parseExecSummary(summaryLine);
                                const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
                                const nextLower = nextLine.toLowerCase();
                                const statusOnlyPrefix = nextLower.startsWith('succeeded in ')
                                    ? 'succeeded in '
                                    : (nextLower.startsWith('failed in ') ? 'failed in ' : '');

                                if (!entry.status && statusOnlyPrefix) {
                                    entry.status = statusOnlyPrefix.startsWith('succeeded') ? 'succeeded' : 'failed';
                                    const rawDuration = nextLine.slice(statusOnlyPrefix.length).trim();
                                    entry.duration = rawDuration.endsWith(':') ? rawDuration.slice(0, -1).trim() : rawDuration;
                                    i += 1;
                                }

                                if (!entry.status && nextLower.startsWith('exited ')) {
                                    const raw = nextLine.slice('exited '.length).trim();
                                    const rawLower = raw.toLowerCase();
                                    const inIndex = rawLower.indexOf(' in ');
                                    if (inIndex !== -1) {
                                        entry.exitCode = raw.slice(0, inIndex).trim();
                                        const rawDuration = raw.slice(inIndex + 4).trim();
                                        entry.duration = rawDuration.endsWith(':') ? rawDuration.slice(0, -1).trim() : rawDuration;
                                    } else {
                                        entry.exitCode = raw;
                                    }
                                    entry.status = entry.exitCode === '0' ? 'succeeded' : 'failed';
                                    i += 1;
                                }

                                const outputLines = [];
                                for (let j = i + 1; j < lines.length; j++) {
                                    const outputLine = lines[j];
                                    const outputTrimmed = outputLine.trim();
                                    if (!outputTrimmed) {
                                        if (outputLines.length > 0) {
                                            outputLines.push('');
                                        }
                                        continue;
                                    }

                                    if (isBoundary(outputTrimmed)) {
                                        break;
                                    }

                                    if (outputTrimmed.toLowerCase().startsWith('codex')) {
                                        break;
                                    }

                                    if (isThoughtStepLine(outputTrimmed)) {
                                        break;
                                    }

                                    outputLines.push(outputLine);
                                    i = j;
                                }

                                if (outputLines.length > 0) {
                                    entry.output = outputLines.join(String.fromCharCode(10)).trim();
                                }

                                parts.push({ type: 'exec', value: entry });
                                continue;
                            }

                            if (isPatchStart(trimmed)) {
                                flushText();

                                const patchEntry = {
                                    added: 0,
                                    updated: 0,
                                    deleted: 0,
                                    files: [],
                                };

                                let foundEnd = false;

                                for (let j = i; j < lines.length; j++) {
                                    const current = lines[j].trim();

                                    if (current.startsWith('*** Add File:')) {
                                        patchEntry.added += 1;
                                        patchEntry.files.push('+ ' + current.slice('*** Add File:'.length).trim());
                                    }
                                    if (current.startsWith('*** Update File:')) {
                                        patchEntry.updated += 1;
                                        patchEntry.files.push('~ ' + current.slice('*** Update File:'.length).trim());
                                    }
                                    if (current.startsWith('*** Delete File:')) {
                                        patchEntry.deleted += 1;
                                        patchEntry.files.push('- ' + current.slice('*** Delete File:'.length).trim());
                                    }

                                    if (current.startsWith('*** End Patch')) {
                                        i = j;
                                        foundEnd = true;
                                        break;
                                    }

                                    if (j > i && isBoundary(current)) {
                                        i = j - 1;
                                        break;
                                    }

                                    if (j === lines.length - 1) {
                                        i = j;
                                    }
                                }

                                if (!foundEnd && patchEntry.added === 0 && patchEntry.updated === 0 && patchEntry.deleted === 0) {
                                    patchEntry.updated = 1;
                                }

                                parts.push({ type: 'patch', value: patchEntry });
                                continue;
                            }

                            textBuffer.push(line);
                        }

                        flushText();

                        return parts.map(part => {
                            if (part.type === 'exec') {
                                return renderExecCard(part.value);
                            }
                            if (part.type === 'patch') {
                                return renderPatchCard(part.value);
                            }
                            return \`<div class="thinking-text">\${escapeHtml(part.value)}</div>\`;
                        }).join('');
                    }

                    function createStreamMessage(requestId) {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'message bot';
                        wrapper.dataset.streamId = String(requestId);

                        const details = document.createElement('details');
                        details.className = 'thinking-block';
                        details.open = true;

                        const summary = document.createElement('summary');
                        summary.innerText = 'Thinking Process';

                        const thinkingContent = document.createElement('div');
                        thinkingContent.className = 'thinking-content';

                        const answerBlock = document.createElement('div');
                        answerBlock.className = 'answer-block';
                        answerBlock.style.display = 'none';

                        details.appendChild(summary);
                        details.appendChild(thinkingContent);
                        wrapper.appendChild(details);
                        wrapper.appendChild(answerBlock);

                        container.appendChild(wrapper);
                        container.scrollTop = container.scrollHeight;

                        return { wrapper, details, thinkingContent, answerBlock };
                    }

                    function renderStreamPlaceholder(label) {
                        return \`<div class="thinking-text stream-placeholder">\${escapeHtml(label)}<span class="stream-caret">▍</span></div>\`;
                    }

                    function scheduleThinkingTyping() {
                        if (!activeStreamState || activeStreamState.thinkingTimer) {
                            return;
                        }

                        activeStreamState.thinkingTimer = setTimeout(() => {
                            if (!activeStreamState || !activeStreamElements) {
                                return;
                            }

                            activeStreamState.thinkingTimer = null;

                            const target = activeStreamState.targetThought || '';
                            if (!target) {
                                if (activeStreamState.phase !== 'answering') {
                                    activeStreamElements.thinkingContent.innerHTML = renderStreamPlaceholder('Waiting for first output');
                                }
                                return;
                            }

                            if (!target.startsWith(activeStreamState.displayedThought)) {
                                activeStreamState.displayedThought = '';
                            }

                            if (activeStreamState.displayedThought.length < target.length) {
                                const remaining = target.length - activeStreamState.displayedThought.length;
                                const step = Math.max(1, Math.ceil(remaining / 45));
                                const nextLength = Math.min(target.length, activeStreamState.displayedThought.length + step);
                                activeStreamState.displayedThought = target.slice(0, nextLength);
                                activeStreamElements.thinkingContent.innerHTML = renderThinkingContent(activeStreamState.displayedThought);
                                container.scrollTop = container.scrollHeight;
                            }

                            if (activeStreamState.displayedThought.length < target.length) {
                                scheduleThinkingTyping();
                            }
                        }, 14);
                    }

                    function scheduleAnswerTyping() {
                        if (!activeStreamState || activeStreamState.typingTimer) {
                            return;
                        }

                        if (activeStreamElements && activeStreamState.targetContent && !activeStreamState.displayedContent) {
                            activeStreamElements.answerBlock.innerHTML = \`<div class="stream-placeholder">Generating response<span class="stream-caret">▍</span></div>\`;
                        }

                        activeStreamState.typingTimer = setTimeout(() => {
                            if (!activeStreamState) {
                                return;
                            }

                            activeStreamState.typingTimer = null;

                            if (!activeStreamElements) {
                                return;
                            }

                            const target = activeStreamState.targetContent || '';
                            if (!target) {
                                return;
                            }

                            if (!target.startsWith(activeStreamState.displayedContent)) {
                                activeStreamState.displayedContent = '';
                            }

                            if (activeStreamState.displayedContent.length < target.length) {
                                const remaining = target.length - activeStreamState.displayedContent.length;
                                const step = Math.max(1, Math.ceil(remaining / 40));
                                const nextLength = Math.min(target.length, activeStreamState.displayedContent.length + step);
                                activeStreamState.displayedContent = target.slice(0, nextLength);
                                activeStreamElements.answerBlock.innerHTML = marked.parse(activeStreamState.displayedContent);
                                container.scrollTop = container.scrollHeight;
                            }

                            if (activeStreamState.displayedContent.length < target.length) {
                                scheduleAnswerTyping();
                            }
                        }, 18);
                    }

                    function renderStreamUpdate(payload) {
                        if (!activeStreamElements || payload.requestId !== activeStreamId) {
                            return;
                        }

                        if (!activeStreamState) {
                            activeStreamState = {
                                targetContent: '',
                                displayedContent: '',
                                typingTimer: null,
                                targetThought: '',
                                displayedThought: '',
                                thinkingTimer: null,
                                phase: 'thinking',
                            };
                        }

                        const thoughtText = payload.thought || '';
                        let answerText = payload.content || '';

                        if (looksLikeThinkingOnly(answerText)) {
                            answerText = '';
                        }

                        const incomingStage = payload.stage === 'answering' ? 'answering' : 'thinking';
                        if (incomingStage === 'answering' || activeStreamState.phase === 'answering') {
                            activeStreamState.phase = 'answering';
                        }

                        activeStreamState.targetThought = String(thoughtText);

                        if (activeStreamState.phase !== 'answering') {
                            scheduleThinkingTyping();
                        }

                        if (activeStreamState.phase === 'answering') {
                            if (activeStreamState.targetThought && activeStreamState.displayedThought !== activeStreamState.targetThought) {
                                activeStreamState.displayedThought = activeStreamState.targetThought;
                                activeStreamElements.thinkingContent.innerHTML = renderThinkingContent(activeStreamState.displayedThought);
                            }

                            activeStreamElements.answerBlock.style.display = '';
                            activeStreamElements.details.open = false;

                            if (answerText) {
                                activeStreamState.targetContent = String(answerText);
                            }
                            scheduleAnswerTyping();
                        } else {
                            activeStreamElements.answerBlock.style.display = 'none';
                            activeStreamElements.answerBlock.innerHTML = '';
                            activeStreamElements.details.open = true;
                            activeStreamState.targetContent = '';
                            activeStreamState.displayedContent = '';
                        }

                        container.scrollTop = container.scrollHeight;
                    }

                    function addMessage(type, data) {
                        if (loadingDiv) { loadingDiv.remove(); loadingDiv = null; }
                        if (type === 'done') return;

                        if (type === 'stream-start') {
                            activeStreamId = data.requestId;
                            activeStreamElements = createStreamMessage(data.requestId);
                            activeStreamState = {
                                targetContent: '',
                                displayedContent: '',
                                typingTimer: null,
                                targetThought: '',
                                displayedThought: '',
                                thinkingTimer: null,
                                phase: 'thinking',
                            };
                            activeStreamElements.thinkingContent.innerHTML = renderStreamPlaceholder('Waiting for first output');
                            return;
                        }

                        if (type === 'stream-update') {
                            renderStreamUpdate(data);
                            return;
                        }

                        if (type === 'stream-end') {
                            if (activeStreamId === data.requestId && activeStreamElements) {
                                if (activeStreamState?.typingTimer) {
                                    clearTimeout(activeStreamState.typingTimer);
                                    activeStreamState.typingTimer = null;
                                }
                                if (activeStreamState?.thinkingTimer) {
                                    clearTimeout(activeStreamState.thinkingTimer);
                                    activeStreamState.thinkingTimer = null;
                                }

                                if (data.finished && activeStreamState?.targetThought) {
                                    activeStreamState.displayedThought = activeStreamState.targetThought;
                                    activeStreamElements.thinkingContent.innerHTML = renderThinkingContent(activeStreamState.targetThought);
                                }

                                if (data.finished && activeStreamState?.targetContent) {
                                    activeStreamState.displayedContent = activeStreamState.targetContent;
                                    activeStreamElements.answerBlock.style.display = '';
                                    activeStreamElements.answerBlock.innerHTML = marked.parse(activeStreamState.targetContent);
                                }

                                if (data.canceled) {
                                    activeStreamElements.details.open = false;
                                    if (activeStreamElements.answerBlock.style.display === 'none') {
                                        activeStreamElements.answerBlock.style.display = '';
                                        activeStreamElements.answerBlock.innerHTML = marked.parse('Request canceled.');
                                    }
                                }
                                if (data.timedOut && activeStreamElements.answerBlock.style.display === 'none') {
                                    activeStreamElements.answerBlock.style.display = '';
                                    activeStreamElements.answerBlock.innerHTML = marked.parse('Request timed out.');
                                    activeStreamElements.details.open = false;
                                }
                                if (data.error && activeStreamElements.answerBlock.style.display === 'none') {
                                    activeStreamElements.answerBlock.style.display = '';
                                    activeStreamElements.answerBlock.innerHTML = marked.parse(String(data.error));
                                    activeStreamElements.details.open = false;
                                }
                            }
                            if (activeStreamId === data.requestId) {
                                activeStreamId = null;
                                activeStreamElements = null;
                                activeStreamState = null;
                            }
                            return;
                        }

                        if (type === 'system') {
                            loadingDiv = document.createElement('div');
                            loadingDiv.className = 'system-msg';
                            loadingDiv.innerText = data;
                            container.appendChild(loadingDiv);
                            return;
                        }

                        const div = document.createElement('div');
                        
                        if (type === 'user') {
                            div.className = 'message user';
                            div.innerText = data;
                        } 
                        else if (type === 'bot-complex') {
                            // 🔥 处理复杂的 { thought, content } 对象
                            div.className = 'message bot';
                            
                            let html = '';
                            
                            // 1. 如果有思考过程，添加折叠面板
                            if (data.thought && data.thought.length > 5) {
                                const thinkingHtml = renderThinkingContent(data.thought);
                                html += \`<details class="thinking-block">
                                    <summary>Thinking Process</summary>
                                    <div class="thinking-content">\${thinkingHtml}</div>
                                </details>\`;
                            }
                            
                            // 2. 添加最终回答
                            html += \`<div class="answer-block">\${marked.parse(data.content)}</div>\`;
                            
                            div.innerHTML = html;
                        } 
                        else if (type === 'bot') {
                            // 兼容旧的纯文本模式
                            div.className = 'message bot';
                            div.innerHTML = \`<div class="answer-block">\${marked.parse(data)}</div>\`;
                        }
                        else {
                            div.className = 'error-msg';
                            div.innerText = data;
                        }

                        container.appendChild(div);
                        container.scrollTop = container.scrollHeight;
                    }

                    function send() {
                        const text = inputBox.value.trim();
                        if (!text) return;
                        vscode.postMessage({ type: 'userInput', value: text });
                        inputBox.value = '';
                    }

                    document.getElementById('send-btn').addEventListener('click', send);
                    inputBox.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                    });

                    window.addEventListener('message', event => {
                        const msg = event.data;
                        addMessage(msg.type, msg.value);
                    });
                </script>
            </body>
            </html>`;
    }
}
