import * as assert from 'assert';
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

function invokePrivate(target: unknown, method: string): unknown {
    return (target as Record<string, (...args: never[]) => unknown>)[method]();
}
