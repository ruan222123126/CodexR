import * as assert from 'assert';
import {
    consumePiStreamChunk,
    createPiStreamAccumulator,
    finalizePiStream,
} from '../piOutputParser';

suite('piOutputParser', () => {
    test('应解析 message_update 文本增量', () => {
        const state = createPiStreamAccumulator();

        consumePiStreamChunk(
            state,
            '{"type":"message_update","assistantMessageEvent":{"type":"text_start","partial":{"content":[{"type":"text","text":"你"}]}}}\n',
        );
        const result = consumePiStreamChunk(
            state,
            '{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"好"}}\n',
        );

        assert.strictEqual(result.content, '你好');
        assert.strictEqual(result.error, '');
    });

    test('应支持分块输入并在 finalize 时处理残留内容', () => {
        const state = createPiStreamAccumulator();

        consumePiStreamChunk(
            state,
            '{"type":"message_update","assistantMessageEvent":{"type":"text_start","partial":{"content":[{"type":"text","text":"Hel',
        );

        const mid = consumePiStreamChunk(
            state,
            'lo"}]}}}\n{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":" World"}}',
        );

        assert.strictEqual(mid.content, 'Hello');

        const done = finalizePiStream(state);
        assert.strictEqual(done.content, 'Hello World');
    });

    test('应容错非法 JSON 行并继续解析后续事件', () => {
        const state = createPiStreamAccumulator();

        consumePiStreamChunk(
            state,
            '{"type":"message_update","assistantMessageEvent":{"type":"text_start","partial":{"content":[{"type":"text","text":"Hi"}]}}}\n',
        );
        consumePiStreamChunk(state, 'not json\n');

        const result = consumePiStreamChunk(
            state,
            '{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":" there"}}\n',
        );

        assert.strictEqual(result.content, 'Hi there');
        assert.strictEqual(result.error, '');
    });

    test('无增量时应回退到 message_end 快照文本', () => {
        const state = createPiStreamAccumulator();

        const result = consumePiStreamChunk(
            state,
            '{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"最终答案"}]}}\n',
        );

        assert.strictEqual(result.content, '最终答案');
    });

    test('应解析 error 事件', () => {
        const state = createPiStreamAccumulator();

        const result = consumePiStreamChunk(
            state,
            '{"type":"error","error":{"message":"rate limited"}}\n',
        );

        assert.strictEqual(result.error, 'rate limited');
    });
});

