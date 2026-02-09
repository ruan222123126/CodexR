import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { CodexProvider } from '../CodexProvider';

type MementoLike = {
    get<T>(key: string): T | undefined;
    update(key: string, value: unknown): Promise<void>;
};

class InMemoryMemento implements MementoLike {
    private readonly store = new Map<string, unknown>();

    public get<T>(key: string): T | undefined {
        return this.store.get(key) as T | undefined;
    }

    public async update(key: string, value: unknown): Promise<void> {
        this.store.set(key, value);
    }

    public setSync(key: string, value: unknown): void {
        this.store.set(key, value);
    }
}

suite('session store', () => {
    test('应在空存储时初始化默认会话', () => {
        const provider = createProvider();
        const sessions = readPrivate(provider, '_sessions') as unknown[];
        const activeSessionId = readPrivate(provider, '_activeSessionId') as string;

        assert.strictEqual(sessions.length, 1);
        assert.ok(activeSessionId.length > 0);
    });

    test('损坏存储应重置为单会话', () => {
        const workspaceState = new InMemoryMemento();
        workspaceState.setSync('codexSidebar.sessions.v1.testhash', { broken: true });

        const provider = createProvider({ workspaceState, forceStorageKey: 'codexSidebar.sessions.v1.testhash' });
        const sessions = readPrivate(provider, '_sessions') as unknown[];
        const activeSessionId = readPrivate(provider, '_activeSessionId') as string;

        assert.strictEqual(sessions.length, 1);
        assert.ok(activeSessionId.length > 0);
    });

    test('session-provider-update 应切换 provider 并重置原生会话状态', () => {
        const provider = createProvider();
        const sessions = readPrivate(provider, '_sessions') as Array<{ id: string; provider: string; backendSessionId?: string; needsBootstrapContext?: boolean }>;
        const target = sessions[0];

        target.provider = 'codex';
        target.backendSessionId = 'legacy-codex-session';
        target.needsBootstrapContext = false;

        invokePrivate(provider, 'handleSessionProviderUpdate', {
            sessionId: target.id,
            provider: 'claude',
        });

        assert.strictEqual(target.provider, 'claude');
        assert.strictEqual(typeof target.backendSessionId, 'string');
        assert.notStrictEqual(target.backendSessionId, 'legacy-codex-session');
        assert.strictEqual(target.needsBootstrapContext, true);
    });

    test('禁用 codexAutoResumeSession 后不应使用 resume 命令', () => {
        const provider = createProvider();
        const sessions = readPrivate(provider, '_sessions') as Array<{ provider: string; backendSessionId?: string; needsBootstrapContext?: boolean }>;
        const target = sessions[0];

        target.provider = 'codex';
        target.backendSessionId = 'resume-session-id';
        target.needsBootstrapContext = false;

        writePrivate(provider, 'shouldAutoResumeCodexSession', () => false);

        const command = invokePrivate(provider, 'buildProviderCommand', target) as { args: string[]; usesNativeSession: boolean };

        assert.strictEqual(command.args.includes('resume'), false);
        assert.strictEqual(command.usesNativeSession, false);
        assert.strictEqual(target.backendSessionId, undefined);
        assert.strictEqual(target.needsBootstrapContext, true);
    });

    test('启用 codexAutoResumeSession 且有会话 id 时应使用 resume 命令', () => {
        const provider = createProvider();
        const sessions = readPrivate(provider, '_sessions') as Array<{ provider: string; backendSessionId?: string; needsBootstrapContext?: boolean }>;
        const target = sessions[0];

        target.provider = 'codex';
        target.backendSessionId = 'resume-session-id';
        target.needsBootstrapContext = false;

        writePrivate(provider, 'shouldAutoResumeCodexSession', () => true);

        const command = invokePrivate(provider, 'buildProviderCommand', target) as { args: string[]; usesNativeSession: boolean };

        assert.strictEqual(command.args.includes('resume'), true);
        assert.strictEqual(command.usesNativeSession, true);
        assert.strictEqual(target.backendSessionId, 'resume-session-id');
    });

    test('startFromHome=true 时应创建并激活新会话', () => {
        const provider = createProvider();
        const beforeSessions = readPrivate(provider, '_sessions') as Array<{ id: string }>;
        const beforeCount = beforeSessions.length;

        const created = invokePrivate(provider, 'resolveTargetSession', undefined, 'codex', true) as { id: string; provider: string };
        const afterSessions = readPrivate(provider, '_sessions') as Array<{ id: string; provider: string }>;
        const activeSessionId = readPrivate(provider, '_activeSessionId') as string;

        assert.strictEqual(afterSessions.length, beforeCount + 1);
        assert.strictEqual(activeSessionId, created.id);
        assert.strictEqual(created.provider, 'codex');
    });

    test('默认标题且首轮对话完成时应触发自动标题', async () => {
        const provider = createProvider();
        const session = {
            id: 'session-1',
            title: '新会话 2026-02-09 13:00',
            provider: 'codex',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [
                { id: 'u1', role: 'user', prompt: '帮我写一个 debounce', createdAt: Date.now() },
                { id: 'a1', role: 'assistant', content: '可以这样实现...', createdAt: Date.now() },
            ],
        } as unknown;

        writePrivate(provider, 'generateTitleWithCodex', async () => 'Debounce 实现');
        let persistCalled = false;
        let publishCalled = false;
        writePrivate(provider, 'persistSessionStore', () => {
            persistCalled = true;
        });
        writePrivate(provider, 'publishSessionState', () => {
            publishCalled = true;
        });

        await (invokePrivate(provider, 'maybeAutoGenerateSessionTitle', session, process.cwd()) as Promise<void>);

        assert.strictEqual((session as { title: string }).title, 'Debounce 实现');
        assert.strictEqual(persistCalled, true);
        assert.strictEqual(publishCalled, true);
    });

    test('自动标题失败时应保留默认标题', async () => {
        const provider = createProvider();
        const session = {
            id: 'session-2',
            title: '新会话 2026-02-09 13:01',
            provider: 'codex',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [
                { id: 'u1', role: 'user', prompt: '解释什么是闭包', createdAt: Date.now() },
                { id: 'a1', role: 'assistant', content: '闭包是...', createdAt: Date.now() },
            ],
        } as unknown;

        writePrivate(provider, 'generateTitleWithCodex', async () => undefined);
        let persistCalled = false;
        writePrivate(provider, 'persistSessionStore', () => {
            persistCalled = true;
        });

        await (invokePrivate(provider, 'maybeAutoGenerateSessionTitle', session, process.cwd()) as Promise<void>);

        assert.strictEqual((session as { title: string }).title, '新会话 2026-02-09 13:01');
        assert.strictEqual(persistCalled, false);
    });

    test('readAttachmentContent 应按字符预算截断并标记 truncated', () => {
        const provider = createProvider();
        const filePath = path.join(os.tmpdir(), `codexr-attachment-large-${Date.now()}-${Math.random()}.txt`);

        try {
            fs.writeFileSync(filePath, 'a'.repeat(20000), 'utf8');

            const result = invokePrivate(provider, 'readAttachmentContent', filePath, 12000) as { text: string; truncated: boolean };
            assert.strictEqual(result.text.length, 12000);
            assert.strictEqual(result.truncated, true);
        } finally {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    });

    test('readAttachmentContent 应识别二进制文件并省略内容', () => {
        const provider = createProvider();
        const filePath = path.join(os.tmpdir(), `codexr-attachment-binary-${Date.now()}-${Math.random()}.bin`);

        try {
            fs.writeFileSync(filePath, Buffer.from([0x00, 0x01, 0x02, 0x03]));

            const result = invokePrivate(provider, 'readAttachmentContent', filePath, 12000) as { text: string; truncated: boolean };
            assert.strictEqual(result.text, '[Binary file omitted]');
            assert.strictEqual(result.truncated, false);
        } finally {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    });
});

function createProvider(options?: {
    workspaceState?: InMemoryMemento;
    forceStorageKey?: string;
}): CodexProvider {
    const workspaceState = options?.workspaceState ?? new InMemoryMemento();
    const globalState = new InMemoryMemento();

    const fakeContext = {
        workspaceState,
        globalState,
        extensionUri: vscode.Uri.file(path.join(os.tmpdir(), 'codexr-test')),
    } as unknown as vscode.ExtensionContext;

    const provider = new CodexProvider(fakeContext.extensionUri, fakeContext);

    if (options?.forceStorageKey) {
        writePrivate(provider, '_storageKey', options.forceStorageKey);
        invokePrivate(provider, 'loadSessionStore');
    }

    return provider;
}

function readPrivate(target: unknown, key: string): unknown {
    return (target as Record<string, unknown>)[key];
}

function writePrivate(target: unknown, key: string, value: unknown): void {
    (target as Record<string, unknown>)[key] = value;
}

function invokePrivate(target: unknown, method: string, ...args: unknown[]): unknown {
    return (target as Record<string, (...args: unknown[]) => unknown>)[method](...args);
}
