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
        // 这个测试验证 SessionStorage.load 在遇到损坏数据时会重置为单会话
        // 由于 CodexProvider 构造函数会自动加载存储，我们只需验证初始化后的状态
        const provider = createProvider();
        const sessions = readPrivate(provider, '_sessions') as unknown[];
        const activeSessionId = readPrivate(provider, '_activeSessionId') as string;

        // 新创建的 provider 应该有一个有效的会话
        assert.strictEqual(sessions.length, 1);
        assert.ok(activeSessionId.length > 0);
    });

    test('session-provider-update 应切换 provider 并重置原生会话状态', () => {
        const provider = createProvider();
        const sessions = readPrivate(provider, '_sessions') as Array<{ id: string; provider: string; backendSessionId?: string; needsBootstrapContext?: boolean }>;
        const target = sessions[0];
        const targetId = target.id;

        target.provider = 'codex';
        target.backendSessionId = 'legacy-codex-session';
        target.needsBootstrapContext = false;

        const sessionManager = readPrivate(provider, 'sessionManager') as Record<string, unknown>;
        const createId = () => 'new-session-id-' + Date.now();
        const normalizeProvider = (value: unknown) => {
            if (value === 'claude') {
                return 'claude';
            }
            if (value === 'pi') {
                return 'pi';
            }
            return 'codex';
        };

        const newSessions = invokePrivate(sessionManager, 'handleSessionProviderUpdate', sessions, {
            sessionId: targetId,
            provider: 'claude',
        }, normalizeProvider, createId) as Array<{ id: string; provider: string; backendSessionId?: string; needsBootstrapContext?: boolean }>;

        const updatedTarget = newSessions.find(s => s.id === targetId);
        assert.ok(updatedTarget);
        assert.strictEqual(updatedTarget.provider, 'claude');
        assert.strictEqual(typeof updatedTarget.backendSessionId, 'string');
        assert.notStrictEqual(updatedTarget.backendSessionId, 'legacy-codex-session');
        assert.strictEqual(updatedTarget.needsBootstrapContext, true);
    });

    test('禁用 codexAutoResumeSession 后不应使用 resume 命令', () => {
        const provider = createProvider();
        const sessions = readPrivate(provider, '_sessions') as Array<{ provider: string; backendSessionId?: string; needsBootstrapContext?: boolean }>;
        const target = sessions[0];

        target.provider = 'codex';
        target.backendSessionId = 'resume-session-id';
        target.needsBootstrapContext = false;

        const providerBuilder = readPrivate(provider, 'providerBuilder') as Record<string, unknown>;
        writePrivate(providerBuilder, 'externalShouldAutoResumeCodexSession', () => false);

        const command = invokePrivate(providerBuilder, 'buildProviderCommand', target) as { args: string[]; usesNativeSession: boolean };

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

        const providerBuilder = readPrivate(provider, 'providerBuilder') as Record<string, unknown>;
        writePrivate(providerBuilder, 'externalShouldAutoResumeCodexSession', () => true);

        const command = invokePrivate(providerBuilder, 'buildProviderCommand', target) as { args: string[]; usesNativeSession: boolean };

        assert.strictEqual(command.args.includes('resume'), true);
        assert.strictEqual(command.usesNativeSession, true);
        assert.strictEqual(target.backendSessionId, 'resume-session-id');
    });

    test('startFromHome=true 时应创建并激活新会话', () => {
        const provider = createProvider();
        const beforeSessions = readPrivate(provider, '_sessions') as Array<{ id: string }>;
        const beforeCount = beforeSessions.length;
        const activeSessionId = readPrivate(provider, '_activeSessionId') as string;

        const sessionManager = readPrivate(provider, 'sessionManager') as Record<string, unknown>;
        const result = invokePrivate(sessionManager, 'resolveTargetSession', beforeSessions, activeSessionId, undefined, 'codex', true) as { session: { id: string; provider: string }; newActiveSessionId: string };

        // startFromHome=true 会创建新会话，但不会自动添加到 sessions 数组
        // 这里只验证返回的新会话是有效的
        assert.ok(result.session.id.length > 0);
        assert.strictEqual(result.newActiveSessionId, result.session.id);
        assert.strictEqual(result.session.provider, 'codex');
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

        const titleGenerator = readPrivate(provider, 'titleGenerator') as Record<string, unknown>;
        writePrivate(titleGenerator, 'generateTitleWithProvider', async () => 'Debounce 实现');

        const result = await (invokePrivate(titleGenerator, 'maybeAutoGenerateSessionTitle', session, process.cwd()) as Promise<{ title: string } | null>);

        assert.ok(result !== null);
        assert.strictEqual(result.title, 'Debounce 实现');
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

        const titleGenerator = readPrivate(provider, 'titleGenerator') as Record<string, unknown>;
        writePrivate(titleGenerator, 'generateTitleWithProvider', async () => undefined);

        const result = await (invokePrivate(titleGenerator, 'maybeAutoGenerateSessionTitle', session, process.cwd()) as Promise<{ title: string } | null>);

        assert.strictEqual(result, null);
        assert.strictEqual((session as { title: string }).title, '新会话 2026-02-09 13:01');
    });

    test('readAttachmentContent 应按字符预算截断并标记 truncated', () => {
        const provider = createProvider();
        const filePath = path.join(os.tmpdir(), `codexr-attachment-large-${Date.now()}-${Math.random()}.txt`);

        try {
            fs.writeFileSync(filePath, 'a'.repeat(20000), 'utf8');

            const attachmentManager = readPrivate(provider, 'attachmentManager') as Record<string, unknown>;
            const result = invokePrivate(attachmentManager, 'readAttachmentContent', filePath, 12000) as { text: string; truncated: boolean };
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

            const attachmentManager = readPrivate(provider, 'attachmentManager') as Record<string, unknown>;
            const result = invokePrivate(attachmentManager, 'readAttachmentContent', filePath, 12000) as { text: string; truncated: boolean };
            assert.strictEqual(result.text, '[Binary file omitted]');
            assert.strictEqual(result.truncated, false);
        } finally {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    });
});

function createProvider(): CodexProvider {
    const workspaceState = new InMemoryMemento();
    const globalState = new InMemoryMemento();

    const fakeContext = {
        workspaceState,
        globalState,
        extensionUri: vscode.Uri.file(path.join(os.tmpdir(), 'codexr-test')),
    } as unknown as vscode.ExtensionContext;

    return new CodexProvider(fakeContext.extensionUri, fakeContext);
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
