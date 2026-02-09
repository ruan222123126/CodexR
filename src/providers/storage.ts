import * as crypto from 'crypto';
import * as vscode from 'vscode';
import type {
    ChatMessage,
    ChatSession,
    SessionStoreState,
    BackupRecord,
    AttachmentItem,
    ProviderType,
} from './types';
import type { StreamSegment } from '../streamTypes';

const SESSION_STORE_VERSION = 1;
const WORKSPACE_VISITED_KEY = 'codexSidebar.workspaceVisited';

export class SessionStorage {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly normalizeProvider: (value: unknown) => ProviderType,
    ) {}

    private buildStorageKey(): string {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? 'global';
        const hash = crypto.createHash('sha1').update(workspacePath).digest('hex').slice(0, 12);
        return `codexSidebar.sessions.v1.${hash}`;
    }

    private getStorageBucket(): vscode.Memento {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            return this.context.workspaceState;
        }
        return this.context.globalState;
    }

    load(createSession: () => ChatSession, parsePersistedState: (raw: unknown) => SessionStoreState | null): { sessions: ChatSession[]; activeSessionId: string; isNewWorkspace: boolean } {
        const bucket = this.getStorageBucket();
        const raw = bucket.get<unknown>(this.buildStorageKey());
        const isNewWorkspace = !this.hasVisitedWorkspace();

        if (raw === undefined) {
            const session = createSession();
            void bucket.update(this.buildStorageKey(), {
                version: SESSION_STORE_VERSION,
                activeSessionId: session.id,
                sessions: [session],
            });
            this.markWorkspaceVisited();
            return { sessions: [session], activeSessionId: session.id, isNewWorkspace: true };
        }

        try {
            const parsed = parsePersistedState(raw);
            if (!parsed) {
                throw new Error('invalid session store shape');
            }

            const sessions = parsed.sessions;
            let activeSessionId = parsed.activeSessionId;

            if (!sessions.some(item => item.id === activeSessionId)) {
                activeSessionId = sessions[0]?.id ?? '';
            }

            if (!activeSessionId || sessions.length === 0) {
                const session = createSession();
                this.markWorkspaceVisited();
                return { sessions: [session], activeSessionId: session.id, isNewWorkspace };
            }

            this.markWorkspaceVisited();
            // If there are existing sessions with messages, don't show home page
            const hasExistingContent = sessions.some(s => s.messages && s.messages.length > 0);
            return { sessions, activeSessionId, isNewWorkspace: isNewWorkspace && !hasExistingContent };
        } catch (error) {
            const backupKey = `codexSidebar.sessions.backup.${Date.now()}`;
            const backup: BackupRecord = {
                failedAt: new Date().toISOString(),
                reason: error instanceof Error ? error.message : String(error),
                raw,
            };
            void bucket.update(backupKey, backup);

            const session = createSession();
            void bucket.update(this.buildStorageKey(), {
                version: SESSION_STORE_VERSION,
                activeSessionId: session.id,
                sessions: [session],
            });
            this.markWorkspaceVisited();
            return { sessions: [session], activeSessionId: session.id, isNewWorkspace: true };
        }
    }

    save(sessions: ChatSession[], activeSessionId: string): void {
        const bucket = this.getStorageBucket();
        void bucket.update(this.buildStorageKey(), {
            version: SESSION_STORE_VERSION,
            activeSessionId,
            sessions,
        });
    }

    parsePersistedState(raw: unknown): SessionStoreState | null {
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

        return { version, activeSessionId, sessions };
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

    private normalizeAttachments(value: unknown): AttachmentItem[] {
        if (!Array.isArray(value)) {
            return [];
        }

        const normalized: AttachmentItem[] = [];
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
                : filePath.split('/').pop() || filePath;

            const size = typeof raw.size === 'number' && Number.isFinite(raw.size) && raw.size >= 0
                ? raw.size
                : undefined;

            normalized.push({ path: filePath, name, size });
        }

        return normalized;
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

    private asRecord(value: unknown): Record<string, unknown> | undefined {
        if (!value || typeof value !== 'object') {
            return undefined;
        }
        return value as Record<string, unknown>;
    }

    private buildWorkspaceVisitedKey(): string {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? 'global';
        const hash = crypto.createHash('sha1').update(workspacePath).digest('hex').slice(0, 12);
        return `${WORKSPACE_VISITED_KEY}.${hash}`;
    }

    private hasVisitedWorkspace(): boolean {
        return this.context.globalState.get<boolean>(this.buildWorkspaceVisitedKey()) === true;
    }

    private markWorkspaceVisited(): void {
        void this.context.globalState.update(this.buildWorkspaceVisitedKey(), true);
    }
}
