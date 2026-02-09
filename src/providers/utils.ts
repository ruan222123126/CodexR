import * as vscode from 'vscode';
import * as crypto from 'crypto';
import type { ChatSession, ProviderType } from './types';

export function createId(): string {
    try {
        return crypto.randomUUID();
    } catch {
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
}

export function makeDefaultSessionTitle(): string {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    return `新会话 ${stamp}`;
}

export function createSession(provider: ProviderType): ChatSession {
    const now = Date.now();
    return {
        id: createId(),
        title: makeDefaultSessionTitle(),
        provider,
        backendSessionId: provider === 'claude' ? createId() : (provider === 'pi' ? createId() : undefined),
        needsBootstrapContext: false,
        createdAt: now,
        updatedAt: now,
        messages: [],
    };
}

export function getWorkspaceDir(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : require('os').homedir();
}
