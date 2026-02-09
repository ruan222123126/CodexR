import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
    ChatSession,
    ChatMessage,
    SessionSummary,
    ProviderType,
    AttachmentItem,
    NormalizedInput,
} from './types';
import type { StreamSegment } from '../streamTypes';

export class SessionManager {
    constructor(
        private readonly defaultProvider: () => ProviderType,
        private readonly createId: () => string,
        private readonly postToWebview: (type: string, value: unknown) => void,
        private readonly persistSessionStore: () => void,
        private readonly cancelExecution: () => void,
    ) {}

    createSession(provider: ProviderType, createId: () => string): ChatSession {
        const now = Date.now();
        return {
            id: createId(),
            title: this.makeDefaultSessionTitle(),
            provider,
            backendSessionId: provider === 'claude' ? createId() : (provider === 'pi' ? createId() : undefined),
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

    resolveTargetSession(
        sessions: ChatSession[],
        activeSessionId: string,
        sessionId: string | undefined,
        fallbackProvider: ProviderType,
        startFromHome = false,
    ): { session: ChatSession; newActiveSessionId: string } {
        if (startFromHome) {
            const created = this.createSession(fallbackProvider, this.createId);
            return { session: created, newActiveSessionId: created.id };
        }

        if (sessionId) {
            const found = sessions.find(item => item.id === sessionId);
            if (found) {
                return { session: found, newActiveSessionId: found.id };
            }
        }

        const active = sessions.find(item => item.id === activeSessionId);
        if (active) {
            return { session: active, newActiveSessionId: activeSessionId };
        }

        if (sessions.length === 0) {
            const created = this.createSession(fallbackProvider, this.createId);
            return { session: created, newActiveSessionId: created.id };
        }

        return { session: sessions[0], newActiveSessionId: sessions[0].id };
    }

    handleCreateSession(
        sessions: ChatSession[],
        value: unknown,
        normalizeProvider: (value: unknown) => ProviderType,
    ): { newSessions: ChatSession[]; newActiveSessionId: string } {
        const payload = this.asRecord(value);
        const provider = normalizeProvider(payload?.provider);

        const created = this.createSession(provider, this.createId);
        const newSessions = [...sessions, created];

        return { newSessions, newActiveSessionId: created.id };
    }

    handleSwitchSession(
        sessions: ChatSession[],
        activeSessionId: string,
        value: unknown,
    ): { newActiveSessionId: string | null } {
        const payload = this.asRecord(value);
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        if (!sessionId) {
            return { newActiveSessionId: null };
        }

        const exists = sessions.some(item => item.id === sessionId);
        if (!exists) {
            this.emitSessionError('Session not found.');
            return { newActiveSessionId: null };
        }

        if (activeSessionId === sessionId) {
            return { newActiveSessionId: activeSessionId };
        }

        return { newActiveSessionId: sessionId };
    }

    handleSessionProviderUpdate(
        sessions: ChatSession[],
        value: unknown,
        normalizeProvider: (value: unknown) => ProviderType,
        createId: () => string,
    ): ChatSession[] {
        const payload = this.asRecord(value);
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        if (!sessionId) {
            return sessions;
        }

        const sessionIndex = sessions.findIndex(item => item.id === sessionId);
        if (sessionIndex === -1) {
            this.emitSessionError('Session not found.');
            return sessions;
        }

        const session = sessions[sessionIndex];
        const provider = normalizeProvider(payload?.provider);
        if (session.provider === provider) {
            return sessions;
        }

        const updatedSession = this.applySessionProvider(session, provider, createId);
        const newSessions = [...sessions];
        newSessions[sessionIndex] = updatedSession;

        return newSessions;
    }

    private applySessionProvider(session: ChatSession, provider: ProviderType, createId: () => string): ChatSession {
        const updated = { ...session };
        updated.provider = provider;
        updated.updatedAt = Date.now();
        updated.needsBootstrapContext = true;

        if (provider === 'codex') {
            updated.backendSessionId = undefined;
            return updated;
        }

        updated.backendSessionId = createId();
        return updated;
    }

    handleRenameSession(
        sessions: ChatSession[],
        value: unknown,
    ): ChatSession[] {
        const payload = this.asRecord(value);
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        const title = typeof payload?.title === 'string' ? payload.title.trim() : '';

        if (!sessionId || !title) {
            this.emitSessionError('Session title cannot be empty.');
            return sessions;
        }

        const sessionIndex = sessions.findIndex(item => item.id === sessionId);
        if (sessionIndex === -1) {
            this.emitSessionError('Session not found.');
            return sessions;
        }

        const newSessions = [...sessions];
        newSessions[sessionIndex] = {
            ...newSessions[sessionIndex],
            title,
            updatedAt: Date.now(),
        };

        return newSessions;
    }

    async handleRenameSessionRequest(sessions: ChatSession[], value: unknown): Promise<ChatSession[] | null> {
        const payload = this.asRecord(value);
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        if (!sessionId) {
            return null;
        }

        const sessionIndex = sessions.findIndex(item => item.id === sessionId);
        if (sessionIndex === -1) {
            this.emitSessionError('Session not found.');
            return null;
        }

        const session = sessions[sessionIndex];
        const currentTitle = typeof payload?.currentTitle === 'string' ? payload.currentTitle.trim() : '';
        const nextTitle = await vscode.window.showInputBox({
            title: 'Rename Session',
            prompt: 'Enter a new title for this session',
            value: currentTitle || session.title,
            ignoreFocusOut: true,
            validateInput: input => input.trim() ? undefined : 'Session title cannot be empty.',
        });

        if (typeof nextTitle !== 'string') {
            return null;
        }

        const newSessions = [...sessions];
        newSessions[sessionIndex] = {
            ...newSessions[sessionIndex],
            title: nextTitle,
            updatedAt: Date.now(),
        };

        return newSessions;
    }

    handleDeleteSession(
        sessions: ChatSession[],
        activeSessionId: string,
        defaultProvider: () => ProviderType,
        value: unknown,
    ): { newSessions: ChatSession[]; newActiveSessionId: string } {
        const payload = this.asRecord(value);
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        if (!sessionId) {
            return { newSessions: sessions, newActiveSessionId: activeSessionId };
        }

        const index = sessions.findIndex(item => item.id === sessionId);
        if (index === -1) {
            this.emitSessionError('Session not found.');
            return { newSessions: sessions, newActiveSessionId: activeSessionId };
        }

        const newSessions = sessions.filter((_, i) => i !== index);

        if (newSessions.length === 0) {
            const created = this.createSession(defaultProvider(), this.createId);
            return { newSessions: [created], newActiveSessionId: created.id };
        }

        if (!newSessions.some(item => item.id === activeSessionId)) {
            const fallback = newSessions[Math.max(index - 1, 0)] ?? newSessions[0];
            return { newSessions, newActiveSessionId: fallback.id };
        }

        return { newSessions, newActiveSessionId: activeSessionId };
    }

    async handleDeleteSessionRequest(
        sessions: ChatSession[],
        activeSessionId: string,
        defaultProvider: () => ProviderType,
        value: unknown,
    ): Promise<{ newSessions: ChatSession[]; newActiveSessionId: string } | null> {
        const payload = this.asRecord(value);
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        if (!sessionId) {
            return null;
        }

        const session = sessions.find(item => item.id === sessionId);
        if (!session) {
            this.emitSessionError('Session not found.');
            return null;
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
            return null;
        }

        return this.handleDeleteSession(sessions, activeSessionId, defaultProvider, { sessionId });
    }

    async handleExportSession(sessions: ChatSession[], value: unknown): Promise<void> {
        const payload = this.asRecord(value);
        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        if (!sessionId) {
            return;
        }

        const session = sessions.find(item => item.id === sessionId);
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

    async handleMultiDeleteSession(
        sessions: ChatSession[],
        activeSessionId: string,
        defaultProvider: () => ProviderType,
        value: unknown,
    ): Promise<{ newSessions: ChatSession[]; newActiveSessionId: string } | null> {
        const payload = this.asRecord(value);
        const sessionIds = Array.isArray(payload?.sessionIds) ? payload.sessionIds : [];

        if (sessionIds.length === 0) {
            return null;
        }

        const validSessionIds = sessionIds
            .filter(id => typeof id === 'string' && id.trim())
            .map(id => id.trim());

        if (validSessionIds.length === 0) {
            return null;
        }

        const confirmed = await vscode.window.showWarningMessage(
            `Delete ${validSessionIds.length} session${validSessionIds.length > 1 ? 's' : ''}?`,
            { modal: true },
            'Delete',
        );

        if (confirmed !== 'Delete') {
            return null;
        }

        const newSessions = sessions.filter(item => !validSessionIds.includes(item.id));

        if (newSessions.length === 0) {
            const created = this.createSession(defaultProvider(), this.createId);
            return { newSessions: [created], newActiveSessionId: created.id };
        }

        if (!newSessions.some(item => item.id === activeSessionId)) {
            return { newSessions, newActiveSessionId: newSessions[0].id };
        }

        return { newSessions, newActiveSessionId: activeSessionId };
    }

    async handleMultiExportSession(sessions: ChatSession[], value: unknown): Promise<void> {
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

        const sessionsToExport = sessions.filter(item => validSessionIds.includes(item.id));

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

    public publishSessionState(sessions: ChatSession[], activeSessionId: string): void {
        const summaries = this.buildSessionSummaries(sessions);

        this.postToWebview('session-list', {
            activeSessionId,
            sessions: summaries,
        });

        const active = sessions.find(item => item.id === activeSessionId);
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

    private buildSessionSummaries(sessions: ChatSession[]): SessionSummary[] {
        return sessions
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

    private emitSessionError(message: string): void {
        this.postToWebview('session-error', { message });
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

    private asRecord(value: unknown): Record<string, unknown> | undefined {
        if (!value || typeof value !== 'object') {
            return undefined;
        }
        return value as Record<string, unknown>;
    }
}
