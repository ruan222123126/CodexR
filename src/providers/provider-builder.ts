import * as vscode from 'vscode';
import type { ChatSession, ProviderCommand, ProviderType } from './types';

export class ProviderBuilder {
    constructor(
        private readonly createId: () => string,
        private readonly externalShouldAutoResumeCodexSession: () => boolean,
    ) {}

    buildProviderCommand(session: ChatSession): ProviderCommand {
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

        if (!this.externalShouldAutoResumeCodexSession() && session.backendSessionId) {
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

    isCommandAvailable(command: string, versionArgs: string[], cwd: string): boolean {
        const result = require('child_process').spawnSync(command, versionArgs, {
            shell: true,
            cwd,
            env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
            encoding: 'utf8',
        });

        return !result.error && result.status === 0;
    }

    shouldEnforceCodexCheckpoint(): boolean {
        return vscode.workspace
            .getConfiguration('codexSidebar')
            .get<boolean>('codexEnforceCheckpointPolicy', true);
    }

    injectCodexCheckpointPolicy(prompt: string): string {
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

    injectRecentConversationContext(session: ChatSession, currentPrompt: string): string {
        const CONTEXT_RECENT_ROUNDS = 10;

        const history = session.messages.filter(item => item.role === 'user' || item.role === 'assistant');
        if (history.length <= 1) {
            return currentPrompt;
        }

        const previousMessages = history.slice(0, -1);
        const recentMessages = previousMessages.slice(-(CONTEXT_RECENT_ROUNDS * 2));
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

    shouldInjectRecentContext(session: ChatSession, usesNativeSession: boolean): boolean {
        if (!usesNativeSession) {
            return true;
        }

        return Boolean(session.needsBootstrapContext);
    }

    markNativeSessionFallbackIfNeeded(
        session: ChatSession,
        providerCommand: ProviderCommand,
        cliError: string,
        rawOutput: string,
        code: number,
        appendSystemMessage: (session: ChatSession, text: string) => ChatSession | null,
    ): ChatSession | null {
        if (!providerCommand.usesNativeSession) {
            return null;
        }

        if (!this.isLikelyNativeSessionFailure(cliError, rawOutput, code)) {
            return null;
        }

        let updated = session;

        if (session.provider === 'codex') {
            updated = { ...session, backendSessionId: undefined, needsBootstrapContext: true };
            return appendSystemMessage(updated, 'Codex session resume failed. Next turn will use local context fallback.');
        }

        if (session.provider === 'pi') {
            updated = { ...session, needsBootstrapContext: true };
            return appendSystemMessage(updated, 'Pi session continue failed. Next turn will use local context fallback.');
        }

        updated = { ...session, backendSessionId: this.createId(), needsBootstrapContext: true };
        return appendSystemMessage(updated, 'Claude session reset. Next turn will use local context fallback.');
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
}
