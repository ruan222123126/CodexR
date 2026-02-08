import * as assert from 'assert';
import { extractCodexSessionId, parseCodexOutput } from '../codexOutputParser';

suite('codexOutputParser', () => {
    test('extractCodexSessionId 应解析内联 session id', () => {
        const raw = 'provider: openai\nsession id: 123e4567-e89b-12d3-a456-426614174000\n';
        const sessionId = extractCodexSessionId(raw);
        assert.strictEqual(sessionId, '123e4567-e89b-12d3-a456-426614174000');
    });

    test('extractCodexSessionId 应解析跨行 session id', () => {
        const raw = 'session id:\n123e4567-e89b-12d3-a456-426614174abc\n';
        const sessionId = extractCodexSessionId(raw);
        assert.strictEqual(sessionId, '123e4567-e89b-12d3-a456-426614174abc');
    });

    test('extractCodexSessionId 无效内容应返回 undefined', () => {
        const raw = 'session id: not-a-valid-id\n';
        const sessionId = extractCodexSessionId(raw);
        assert.strictEqual(sessionId, undefined);
    });

    test('parseCodexOutput 应保留包含 exec 关键词的答案文本', () => {
        const raw = [
            'Thinking',
            '先分析',
            'codex',
            '这个回答会提到 exec succeeded apply_patch 但它是正文',
        ].join('\n');

        const parsed = parseCodexOutput(raw);
        assert.ok(parsed.content.includes('exec succeeded apply_patch'));
    });

    test('parseCodexOutput 不应因 tokens used 误截断正文', () => {
        const raw = [
            'Thinking',
            '先分析',
            'codex',
            '这里是答案，包含短语 tokens used 但是正文的一部分',
        ].join('\n');

        const parsed = parseCodexOutput(raw);
        assert.ok(parsed.content.includes('tokens used'));
    });

    test('parseCodexOutput 应保留方括号整行文本', () => {
        const raw = [
            'Thinking',
            '准备',
            'codex',
            '[INFO] keep this line',
            '[1] item',
        ].join('\n');

        const parsed = parseCodexOutput(raw);
        assert.ok(parsed.content.includes('[INFO] keep this line'));
        assert.ok(parsed.content.includes('[1] item'));
    });

    test('parseCodexOutput 应输出结构化 exec segment', () => {
        const raw = [
            'Thinking',
            'exec bash -c "echo hello"',
            'hello',
            'bash -c "echo hello" succeeded in 30ms:',
            'codex',
            'done',
        ].join('\n');

        const parsed = parseCodexOutput(raw);
        const execSegments = parsed.segments.filter(segment => segment.type === 'exec');
        assert.strictEqual(execSegments.length, 1);

        const exec = execSegments[0];
        if (exec.type !== 'exec') {
            assert.fail('exec segment expected');
        }

        assert.strictEqual(exec.value.command, 'echo hello');
        assert.strictEqual(exec.value.status, 'succeeded');
        assert.strictEqual(exec.value.duration, '30ms');
    });

    test('parseCodexOutput 应输出增强 patch 统计', () => {
        const raw = [
            'Thinking',
            '*** Begin Patch',
            '*** Update File: src/a.ts',
            '*** Move to: src/b.ts',
            '@@',
            '-old',
            '+new',
            '*** End Patch',
            'codex',
            'ok',
        ].join('\n');

        const parsed = parseCodexOutput(raw);
        const patchSegments = parsed.segments.filter(segment => segment.type === 'patch');
        assert.strictEqual(patchSegments.length, 1);

        const patch = patchSegments[0];
        if (patch.type !== 'patch') {
            assert.fail('patch segment expected');
        }

        assert.strictEqual(patch.value.updated, 1);
        assert.strictEqual(patch.value.moved, 1);
        assert.strictEqual(patch.value.hunks, 1);
        assert.strictEqual(patch.value.additions, 1);
        assert.strictEqual(patch.value.deletions, 1);
    });
});
