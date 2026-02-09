import * as cp from 'child_process';
import { parseCodexOutput } from '../codexOutputParser';
import type { ChatSession } from './types';

const TITLE_GENERATION_TIMEOUT_MS = 45_000;

export class TitleGenerator {
    constructor(
        private readonly createId: () => string,
        private readonly persistSessionStore: () => void,
        private readonly publishSessionState: () => void,
    ) {}

    shouldAutoGenerateSessionTitle(session: ChatSession): boolean {
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

    async maybeAutoGenerateSessionTitle(session: ChatSession, cwd: string): Promise<ChatSession | null> {
        if (!this.shouldAutoGenerateSessionTitle(session)) {
            return null;
        }

        const firstRound = this.getFirstRoundDialog(session);
        if (!firstRound) {
            return null;
        }

        const generatedTitle = await this.generateTitleWithCodex(firstRound.userPrompt, firstRound.assistantText, cwd);
        if (!generatedTitle) {
            return null;
        }

        if (!this.shouldAutoGenerateSessionTitle(session)) {
            return null;
        }

        const updated = {
            ...session,
            title: generatedTitle,
            updatedAt: Date.now(),
        };

        return updated;
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
            TITLE_GENERATION_TIMEOUT_MS,
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

    private isCommandAvailable(command: string, versionArgs: string[], cwd: string): boolean {
        const result = cp.spawnSync(command, versionArgs, {
            shell: true,
            cwd,
            env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
            encoding: 'utf8',
        });

        return !result.error && result.status === 0;
    }
}
