import * as assert from 'assert';
import {
    consumeClaudeStreamChunk,
    createClaudeStreamAccumulator,
    finalizeClaudeStream,
} from '../claudeOutputParser';

suite('claudeOutputParser', () => {
    test('应忽略 system/init 事件并提取文本增量', () => {
        const state = createClaudeStreamAccumulator();

        consumeClaudeStreamChunk(state, '{"type":"system","subtype":"init","version":"1.0"}\n');
        consumeClaudeStreamChunk(state, '{"type":"init","message":"boot"}\n');

        consumeClaudeStreamChunk(state, '{"type":"content_block_start","index":0,"content_block":{"type":"text","text":"你好"}}\n');
        const result = consumeClaudeStreamChunk(state, '{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"，世界！"}}\n');

        assert.strictEqual(result.content, '你好，世界！');
        assert.strictEqual(result.error, '');
    });

    test('应支持 data: 前缀并按 index 顺序拼接', () => {
        const state = createClaudeStreamAccumulator();

        consumeClaudeStreamChunk(state, 'data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":"世界"}}\n');
        consumeClaudeStreamChunk(state, 'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":"你好，"}}\n');
        const result = consumeClaudeStreamChunk(state, 'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"！"}}\n');

        assert.strictEqual(result.content, '你好，世界！');
        assert.strictEqual(result.error, '');
    });

    test('应解析 error 事件并保留已生成内容', () => {
        const state = createClaudeStreamAccumulator();

        consumeClaudeStreamChunk(state, '{"type":"content_block_start","index":0,"content_block":{"type":"text","text":"前半段"}}\n');
        const result = consumeClaudeStreamChunk(state, '{"type":"error","error":{"type":"rate_limit_error","message":"Too many requests"}}\n');

        assert.strictEqual(result.content, '前半段');
        assert.strictEqual(result.error, 'Too many requests');
    });

    test('应容错非法 JSON 行并继续解析后续事件', () => {
        const state = createClaudeStreamAccumulator();

        consumeClaudeStreamChunk(state, '{"type":"content_block_start","index":0,"content_block":{"type":"text","text":"Hello"}}\n');
        consumeClaudeStreamChunk(state, 'this is not json\n');
        const result = consumeClaudeStreamChunk(state, '{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" Claude!"}}\n');

        assert.strictEqual(result.content, 'Hello Claude!');
        assert.strictEqual(result.error, '');
    });

    test('应支持分块输入并在 finalize 时处理残留行', () => {
        const state = createClaudeStreamAccumulator();

        consumeClaudeStreamChunk(state, '{"type":"content_block_start","index":0,"content_block":{"type":"text","text":"Hel');
        const mid = consumeClaudeStreamChunk(state, 'lo"}}\n{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}');

        assert.strictEqual(mid.content, 'Hello');
        assert.strictEqual(mid.error, '');

        const done = finalizeClaudeStream(state);
        assert.strictEqual(done.content, 'Hello World');
        assert.strictEqual(done.error, '');
    });

    test('无增量时应回退到 message 快照文本', () => {
        const state = createClaudeStreamAccumulator();

        const result = consumeClaudeStreamChunk(
            state,
            '{"type":"message","message":{"role":"assistant","content":[{"type":"text","text":"最终答案"}]}}\n',
        );

        assert.strictEqual(result.content, '最终答案');
        assert.strictEqual(result.error, '');
    });
});
