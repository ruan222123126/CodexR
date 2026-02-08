import * as assert from 'assert';
import * as vm from 'vm';
import { WEBVIEW_SCRIPT_PARSE } from '../webviewScriptParse';

type ExecPart = {
    type: 'exec';
    value: {
        runnerLabel: string;
        command: string;
        cwd?: string;
        status: string;
        duration: string;
        exitCode?: string;
        output: string;
    };
};

type PatchPart = {
    type: 'patch';
    value: {
        added: number;
        updated: number;
        deleted: number;
        moved: number;
        hunks: number;
        additions: number;
        deletions: number;
        files: string[];
    };
};

type TextPart = {
    type: 'text';
    value: string;
};

type ThinkingPart = ExecPart | PatchPart | TextPart;

type ParseThinkingPartsFn = (thoughtText: string) => ThinkingPart[];

function loadParseThinkingParts(): ParseThinkingPartsFn {
    const context: Record<string, unknown> = {};
    vm.runInNewContext(WEBVIEW_SCRIPT_PARSE, context);

    const parseThinkingParts = context.parseThinkingParts;
    assert.strictEqual(typeof parseThinkingParts, 'function');

    return parseThinkingParts as ParseThinkingPartsFn;
}

suite('webviewScriptParse', () => {
    test('parseThinkingParts 应解析纯文本块', () => {
        const parseThinkingParts = loadParseThinkingParts();
        const parts = parseThinkingParts('Thinking\n先分析一下\n再输出结论');

        assert.strictEqual(parts.length, 1);
        assert.strictEqual(parts[0].type, 'text');
        assert.strictEqual(parts[0].value, 'Thinking\n先分析一下\n再输出结论');
    });

    test('parseThinkingParts 应解析 exec 块', () => {
        const parseThinkingParts = loadParseThinkingParts();
        const thought = [
            'exec bash -c "echo hello"',
            'hello',
            'world',
            'bash -c "echo hello" succeeded in 120ms:',
        ].join('\n');

        const parts = parseThinkingParts(thought);

        assert.strictEqual(parts.length, 1);
        assert.strictEqual(parts[0].type, 'exec');

        const execPart = parts[0] as ExecPart;
        assert.strictEqual(execPart.value.command, 'echo hello');
        assert.strictEqual(execPart.value.status, 'succeeded');
        assert.strictEqual(execPart.value.duration, '120ms');
        assert.strictEqual(execPart.value.output, 'hello\nworld');
    });

    test('parseThinkingParts 在 exec 缺少 summary 时应保留命令并留空状态', () => {
        const parseThinkingParts = loadParseThinkingParts();
        const thought = 'exec bash -c "echo hello"';

        const parts = parseThinkingParts(thought);

        assert.strictEqual(parts.length, 1);
        assert.strictEqual(parts[0].type, 'exec');

        const execPart = parts[0] as ExecPart;
        assert.strictEqual(execPart.value.command, 'echo hello');
        assert.strictEqual(execPart.value.status, '');
        assert.strictEqual(execPart.value.duration, '');
        assert.strictEqual(execPart.value.output, '');
    });

    test('parseThinkingParts 应解析 patch 块', () => {
        const parseThinkingParts = loadParseThinkingParts();
        const thought = [
            '*** Begin Patch',
            '*** Add File: docs/a.txt',
            '+hello',
            '*** Update File: src/app.ts',
            '@@',
            '-old',
            '+new',
            '*** Delete File: old.txt',
            '*** End Patch',
        ].join('\n');

        const parts = parseThinkingParts(thought);

        assert.strictEqual(parts.length, 1);
        assert.strictEqual(parts[0].type, 'patch');

        const patchPart = parts[0] as PatchPart;
        assert.strictEqual(patchPart.value.added, 1);
        assert.strictEqual(patchPart.value.updated, 1);
        assert.strictEqual(patchPart.value.deleted, 1);
        assert.strictEqual(patchPart.value.moved, 0);
        assert.strictEqual(patchPart.value.hunks, 1);
        assert.strictEqual(patchPart.value.additions, 2);
        assert.strictEqual(patchPart.value.deletions, 1);
        const localFiles = Array.from(patchPart.value.files);
        assert.deepStrictEqual(localFiles, ['+ docs/a.txt', '~ src/app.ts', '- old.txt']);
    });

    test('parseThinkingParts 应按顺序解析 text/exec/patch/text 混合块', () => {
        const parseThinkingParts = loadParseThinkingParts();
        const thought = [
            '先做准备工作',
            'exec bash -c "echo hello"',
            'hello',
            'bash -c "echo hello" succeeded in 25ms:',
            '*** Begin Patch',
            '*** Update File: src/main.ts',
            '*** End Patch',
            '最后收尾说明',
        ].join('\n');

        const parts = parseThinkingParts(thought);

        assert.strictEqual(parts.length, 4);

        assert.strictEqual(parts[0].type, 'text');
        assert.strictEqual(parts[0].value, '先做准备工作');

        assert.strictEqual(parts[1].type, 'exec');
        const execPart = parts[1] as ExecPart;
        assert.strictEqual(execPart.value.command, 'echo hello');
        assert.strictEqual(execPart.value.status, 'succeeded');
        assert.strictEqual(execPart.value.duration, '25ms');
        assert.strictEqual(execPart.value.output, 'hello');

        assert.strictEqual(parts[2].type, 'patch');
        const patchPart = parts[2] as PatchPart;
        assert.strictEqual(patchPart.value.added, 0);
        assert.strictEqual(patchPart.value.updated, 1);
        assert.strictEqual(patchPart.value.deleted, 0);
        assert.strictEqual(patchPart.value.moved, 0);
        assert.deepStrictEqual(Array.from(patchPart.value.files), ['~ src/main.ts']);

        assert.strictEqual(parts[3].type, 'text');
        assert.strictEqual(parts[3].value, '最后收尾说明');
    });

    test('parseThinkingParts 在 patch 缺少 End 标记时应回退为一次更新', () => {
        const parseThinkingParts = loadParseThinkingParts();
        const thought = [
            '*** Begin Patch',
            '@@',
            '-old line',
            '+new line',
        ].join('\n');

        const parts = parseThinkingParts(thought);

        assert.strictEqual(parts.length, 1);
        assert.strictEqual(parts[0].type, 'patch');

        const patchPart = parts[0] as PatchPart;
        assert.strictEqual(patchPart.value.added, 0);
        assert.strictEqual(patchPart.value.updated, 1);
        assert.strictEqual(patchPart.value.deleted, 0);
        assert.strictEqual(patchPart.value.moved, 0);
        assert.deepStrictEqual(Array.from(patchPart.value.files), []);
    });

    test('parseThinkingParts 应识别 zsh/sh/python/node runner', () => {
        const parseThinkingParts = loadParseThinkingParts();

        const cases = [
            { line: 'exec zsh -c "echo z"', expectedRunner: 'Zsh', expectedCommand: 'echo z' },
            { line: 'exec sh -c "echo s"', expectedRunner: 'Shell', expectedCommand: 'echo s' },
            { line: 'exec python -c "print(1)"', expectedRunner: 'Python', expectedCommand: 'print(1)' },
            { line: 'exec node -e "console.log(1)"', expectedRunner: 'Node', expectedCommand: 'console.log(1)' },
        ];

        for (const item of cases) {
            const parts = parseThinkingParts(item.line);
            assert.strictEqual(parts.length, 1);
            assert.strictEqual(parts[0].type, 'exec');
            const execPart = parts[0] as ExecPart;
            assert.strictEqual(execPart.value.runnerLabel, item.expectedRunner);
            assert.strictEqual(execPart.value.command, item.expectedCommand);
        }
    });

    test('parseStreamSegments 应优先消费结构化 thinking segments', () => {
        const context: Record<string, unknown> = {};
        vm.runInNewContext(WEBVIEW_SCRIPT_PARSE, context);
        const parseStreamSegments = context.parseStreamSegments as ((segments: unknown[], fallback: string) => ThinkingPart[]);

        const segments = [
            { type: 'text', phase: 'thinking', value: '分析步骤一' },
            {
                type: 'exec',
                phase: 'thinking',
                value: {
                    runnerLabel: 'Bash',
                    command: 'echo hello',
                    cwd: '',
                    status: 'succeeded',
                    duration: '20ms',
                    exitCode: '',
                    output: 'hello',
                },
            },
            {
                type: 'patch',
                phase: 'thinking',
                value: {
                    added: 0,
                    updated: 1,
                    deleted: 0,
                    moved: 1,
                    hunks: 2,
                    additions: 4,
                    deletions: 1,
                    files: ['~ a.ts', '> b.ts'],
                },
            },
            { type: 'text', phase: 'answer', value: '最终答案' },
        ];

        const parts = parseStreamSegments(segments, 'fallback text');
        assert.strictEqual(parts.length, 3);
        assert.strictEqual(parts[0].type, 'text');
        assert.strictEqual(parts[1].type, 'exec');
        assert.strictEqual(parts[2].type, 'patch');
    });
});
