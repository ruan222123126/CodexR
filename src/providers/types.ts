import type { StreamSegment } from '../streamTypes';

export type ProviderType = 'codex' | 'claude' | 'pi';
export type MessageRole = 'user' | 'assistant' | 'system';
export type ParserMode = 'v2' | 'legacy';

export interface AttachmentItem {
    path: string;
    name: string;
    size?: number;
}

export interface NormalizedInput {
    prompt: string;
    provider: ProviderType;
    attachments: AttachmentItem[];
    sessionId?: string;
    startFromHome?: boolean;
}

export interface ChatMessage {
    id: string;
    role: MessageRole;
    prompt?: string;
    thought?: string;
    content?: string;
    segments?: StreamSegment[];
    attachments?: AttachmentItem[];
    createdAt: number;
}

export interface ChatSession {
    id: string;
    title: string;
    provider: ProviderType;
    backendSessionId?: string;
    needsBootstrapContext?: boolean;
    createdAt: number;
    updatedAt: number;
    messages: ChatMessage[];
}

export interface SessionStoreState {
    version: number;
    activeSessionId: string;
    sessions: ChatSession[];
}

export interface ProviderCommand {
    command: string;
    args: string[];
    promptViaStdin: boolean;
    versionArgs: string[];
    usesNativeSession: boolean;
}

export interface SessionSummary {
    id: string;
    title: string;
    provider: ProviderType;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
    workspacePath: string;
    previewText: string;
}

export interface BackupRecord {
    failedAt: string;
    reason: string;
    raw: unknown;
}
