/**
 * Claude 输出解析器
 *
 * 解析 Claude CLI 的 stream-json 格式输出
 */

import type { StreamSegment } from '../../streamTypes';

type JsonRecord = Record<string, unknown>;

type TextDelta = {
    seq: number;
    index: number;
    text: string;
    phase: 'thinking' | 'answer';
};

type ToolUseBlock = {
    id: string;
    name: string;
    inputJson: string;
};

export type TokenUsage = {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
};

export type ClaudeStreamAccumulator = {
    lineBuffer: string;
    deltas: TextDelta[];
    latestSnapshot: string;
    errors: string[];
    nextSeq: number;
    nextLooseIndex: number;
    /** Track content block types by index */
    blockPhases: Map<number, 'thinking' | 'answer'>;
    /** Track tool_use blocks by index */
    toolUseBlocks: Map<number, ToolUseBlock>;
    /** Track token usage */
    usage: TokenUsage | null;
};

export type ClaudeStreamResult = {
    content: string;
    error: string;
    segments: StreamSegment[];
    usage: TokenUsage | null;
};

export function createClaudeStreamAccumulator(): ClaudeStreamAccumulator {
    return {
        lineBuffer: '',
        deltas: [],
        latestSnapshot: '',
        errors: [],
        nextSeq: 0,
        nextLooseIndex: Number.MAX_SAFE_INTEGER,
        blockPhases: new Map(),
        toolUseBlocks: new Map(),
        usage: null,
    };
}

export function consumeClaudeStreamChunk(
    accumulator: ClaudeStreamAccumulator,
    chunk: string,
): ClaudeStreamResult {
    if (chunk) {
        accumulator.lineBuffer += chunk.replace(/\r/g, '');
    }

    if (!accumulator.lineBuffer.includes('\n')) {
        return buildResult(accumulator);
    }

    const lines = accumulator.lineBuffer.split('\n');
    accumulator.lineBuffer = lines.pop() ?? '';

    for (const lineRaw of lines) {
        processLine(accumulator, lineRaw);
    }

    return buildResult(accumulator);
}

export function finalizeClaudeStream(accumulator: ClaudeStreamAccumulator): ClaudeStreamResult {
    if (accumulator.lineBuffer) {
        processLine(accumulator, accumulator.lineBuffer);
        accumulator.lineBuffer = '';
    }

    return buildResult(accumulator);
}

function processLine(accumulator: ClaudeStreamAccumulator, lineRaw: string): void {
    const parsed = parseJsonLine(lineRaw);
    if (!parsed || shouldIgnoreEvent(parsed)) {
        return;
    }

    const errorMessage = extractErrorMessage(parsed);
    if (errorMessage) {
        accumulator.errors.push(errorMessage);
    }

    // Track content block types (thinking vs text vs tool_use)
    trackContentBlockType(accumulator, parsed);

    // Track tool_use blocks (standard API format)
    trackToolUseBlock(accumulator, parsed);

    // Track tool_use from Claude CLI assistant message format
    trackToolUseFromAssistantMessage(accumulator, parsed);

    // Track token usage
    trackTokenUsage(accumulator, parsed);

    const deltaTexts = extractDeltaTexts(accumulator, parsed);
    for (const item of deltaTexts) {
        accumulator.deltas.push({
            seq: accumulator.nextSeq++,
            index: item.index,
            text: item.text,
            phase: item.phase,
        });
    }

    const snapshotText = extractSnapshotText(parsed);
    if (snapshotText) {
        accumulator.latestSnapshot = snapshotText;
    }
}

function buildResult(accumulator: ClaudeStreamAccumulator): ClaudeStreamResult {
    const uniqueErrors = Array.from(new Set(accumulator.errors.filter(Boolean)));

    // Sort deltas by index then seq
    const sortedDeltas = accumulator.deltas
        .slice()
        .sort((a, b) => {
            if (a.index !== b.index) {
                return a.index - b.index;
            }
            return a.seq - b.seq;
        });

    // Group deltas by phase
    const thinkingDeltas = sortedDeltas.filter(d => d.phase === 'thinking');
    const answerDeltas = sortedDeltas.filter(d => d.phase === 'answer');

    const thinkingText = thinkingDeltas.map(d => d.text).join('');
    const answerText = answerDeltas.map(d => d.text).join('');

    const content = answerText || accumulator.latestSnapshot;

    const segments: StreamSegment[] = [];
    let seq = 0;

    // Add thinking segment first if present
    if (thinkingText) {
        segments.push({
            type: 'text',
            value: thinkingText,
            phase: 'thinking',
            source: 'stdout',
            seq: seq++,
        });
    }

    // Add tool_use segments (as part of thinking/answer phase)
    for (const [, toolBlock] of accumulator.toolUseBlocks) {
        segments.push({
            type: 'tool_use',
            value: {
                id: toolBlock.id,
                name: toolBlock.name,
                input: toolBlock.inputJson,
            },
            phase: 'thinking',
            source: 'stdout',
            seq: seq++,
        });
    }

    // Add answer segment
    if (content) {
        segments.push({
            type: 'text',
            value: content,
            phase: 'answer',
            source: 'stdout',
            seq: seq++,
        });
    }

    if (uniqueErrors.length > 0) {
        for (const message of uniqueErrors) {
            segments.push({
                type: 'error',
                value: message,
                phase: 'answer',
                source: 'stderr',
                seq: seq++,
            });
        }
    }

    return {
        content,
        error: uniqueErrors.join('\n'),
        segments,
        usage: accumulator.usage,
    };
}

function parseJsonLine(lineRaw: string): JsonRecord | undefined {
    const line = lineRaw.trim();
    if (!line) {
        return undefined;
    }

    const payload = line.startsWith('data:') ? line.slice(5).trim() : line;
    if (!payload || payload === '[DONE]') {
        return undefined;
    }

    try {
        const parsed = JSON.parse(payload) as unknown;
        return isRecord(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

function shouldIgnoreEvent(event: JsonRecord): boolean {
    const type = readString(event.type).toLowerCase();
    const subtype = readString(event.subtype).toLowerCase();

    if (type === 'system') {
        return true;
    }

    if (type === 'init' || subtype === 'init') {
        return true;
    }

    return false;
}

/**
 * Track content block types by index.
 * When we see content_block_start, record whether it's a thinking or text block.
 */
function trackContentBlockType(accumulator: ClaudeStreamAccumulator, event: JsonRecord): void {
    const type = readString(event.type).toLowerCase();
    if (type !== 'content_block_start') {
        return;
    }

    const index = readNumber(event.index);
    if (typeof index !== 'number') {
        return;
    }

    const block = readRecord(event.content_block);
    if (!block) {
        return;
    }

    const blockType = readString(block.type).toLowerCase();
    // Claude uses 'thinking' type for extended thinking blocks
    if (blockType === 'thinking') {
        accumulator.blockPhases.set(index, 'thinking');
    } else {
        accumulator.blockPhases.set(index, 'answer');
    }
}

/**
 * Track tool_use from Claude CLI assistant message format.
 * Claude CLI outputs complete tool_use objects in assistant messages like:
 * {"type":"assistant","message":{"content":[{"id":"...","input":{...},"name":"Bash","type":"tool_use"}]}}
 */
function trackToolUseFromAssistantMessage(accumulator: ClaudeStreamAccumulator, event: JsonRecord): void {
    const type = readString(event.type).toLowerCase();
    if (type !== 'assistant') {
        return;
    }

    const message = readRecord(event.message);
    if (!message) {
        return;
    }

    const content = message.content;
    if (!Array.isArray(content)) {
        return;
    }

    for (let i = 0; i < content.length; i++) {
        const block = content[i];
        if (!isRecord(block)) {
            continue;
        }

        const blockType = readString(block.type).toLowerCase();
        if (blockType !== 'tool_use') {
            continue;
        }

        const id = readString(block.id);
        const name = readString(block.name);
        const input = block.input;

        // Skip if we already have this tool_use block (by id)
        let alreadyExists = false;
        for (const [, existing] of accumulator.toolUseBlocks) {
            if (existing.id === id) {
                alreadyExists = true;
                break;
            }
        }
        if (alreadyExists) {
            continue;
        }

        // Convert input object to JSON string
        let inputJson = '';
        if (input !== undefined && input !== null) {
            try {
                inputJson = JSON.stringify(input);
            } catch {
                inputJson = '';
            }
        }

        // Use a unique index for this tool_use block
        const index = accumulator.nextLooseIndex--;
        accumulator.toolUseBlocks.set(index, {
            id,
            name,
            inputJson,
        });
    }
}

/**
 * Track tool_use blocks by index.
 * When we see content_block_start with type tool_use, record the tool info.
 * When we see content_block_delta with input_json_delta, accumulate the input JSON.
 */
function trackToolUseBlock(accumulator: ClaudeStreamAccumulator, event: JsonRecord): void {
    const type = readString(event.type).toLowerCase();
    const index = readNumber(event.index);

    if (typeof index !== 'number') {
        return;
    }

    if (type === 'content_block_start') {
        const block = readRecord(event.content_block);
        if (!block) {
            return;
        }

        const blockType = readString(block.type).toLowerCase();
        // Handle both tool_use and server_tool_use
        if (blockType === 'tool_use' || blockType === 'server_tool_use') {
            const id = readString(block.id);
            const name = readString(block.name);
            accumulator.toolUseBlocks.set(index, {
                id,
                name,
                inputJson: '',
            });
        }
        return;
    }

    if (type === 'content_block_delta') {
        const existingBlock = accumulator.toolUseBlocks.get(index);
        if (!existingBlock) {
            return;
        }

        const delta = readRecord(event.delta);
        const deltaType = readString(delta?.type).toLowerCase();

        if (deltaType === 'input_json_delta') {
            const partialJson = readString(delta?.partial_json);
            if (partialJson) {
                existingBlock.inputJson += partialJson;
            }
        }
    }
}

/**
 * Track token usage from message_start, message_delta, or message_stop events.
 * Claude API returns usage info in these events.
 */
function trackTokenUsage(accumulator: ClaudeStreamAccumulator, event: JsonRecord): void {
    const type = readString(event.type).toLowerCase();

    // Check for usage in message_start event
    if (type === 'message_start') {
        const message = readRecord(event.message);
        const usage = readRecord(message?.usage);
        if (usage) {
            const inputTokens = readNumber(usage.input_tokens) ?? 0;
            const outputTokens = readNumber(usage.output_tokens) ?? 0;
            accumulator.usage = {
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
            };
        }
        return;
    }

    // Check for usage in message_delta event (contains output_tokens)
    if (type === 'message_delta') {
        const usage = readRecord(event.usage);
        if (usage) {
            const outputTokens = readNumber(usage.output_tokens);
            if (typeof outputTokens === 'number' && accumulator.usage) {
                accumulator.usage.outputTokens = outputTokens;
                accumulator.usage.totalTokens = accumulator.usage.inputTokens + outputTokens;
            }
        }
        return;
    }

    // Check for usage in message_stop event
    if (type === 'message_stop' || type === 'message') {
        const usage = readRecord(event.usage);
        if (usage) {
            const inputTokens = readNumber(usage.input_tokens) ?? accumulator.usage?.inputTokens ?? 0;
            const outputTokens = readNumber(usage.output_tokens) ?? accumulator.usage?.outputTokens ?? 0;
            accumulator.usage = {
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
            };
        }
    }
}

function extractDeltaTexts(accumulator: ClaudeStreamAccumulator, event: JsonRecord): Array<{ index: number; text: string; phase: 'thinking' | 'answer' }> {
    const texts: Array<{ index: number; text: string; phase: 'thinking' | 'answer' }> = [];
    const type = readString(event.type).toLowerCase();
    const index = readNumber(event.index);
    const normalizedIndex = typeof index === 'number' ? index : Number.MAX_SAFE_INTEGER;

    // Determine phase based on tracked block type
    const phase = accumulator.blockPhases.get(normalizedIndex) ?? 'answer';

    if (type === 'content_block_start') {
        const block = readRecord(event.content_block);
        const blockType = readString(block?.type).toLowerCase();

        // For thinking blocks, extract the 'thinking' field
        if (blockType === 'thinking') {
            const thinkingText = readString(block?.thinking);
            if (thinkingText) {
                texts.push({ index: normalizedIndex, text: thinkingText, phase: 'thinking' });
            }
        } else {
            const text = extractTextFromContainer(block);
            if (text) {
                texts.push({ index: normalizedIndex, text, phase });
            }
        }
        return texts;
    }

    if (type === 'content_block_delta') {
        const delta = readRecord(event.delta);
        const deltaType = readString(delta?.type).toLowerCase();

        // Handle thinking_delta for extended thinking
        if (deltaType === 'thinking_delta') {
            const thinkingText = readString(delta?.thinking);
            if (thinkingText) {
                texts.push({ index: normalizedIndex, text: thinkingText, phase: 'thinking' });
            }
            return texts;
        }

        const text = extractDeltaText(delta);
        if (text) {
            texts.push({ index: normalizedIndex, text, phase });
        }
        return texts;
    }

    const inlineDelta = extractDeltaText(readRecord(event.delta));
    if (inlineDelta) {
        texts.push({ index: normalizedIndex, text: inlineDelta, phase });
        return texts;
    }

    if (type.endsWith('_delta')) {
        const text = readString(event.text);
        if (text) {
            texts.push({ index: normalizedIndex, text, phase });
        }
    }

    return texts;
}

function extractSnapshotText(event: JsonRecord): string {
    const type = readString(event.type).toLowerCase();
    if (type.endsWith('_delta')) {
        return '';
    }

    const message = readRecord(event.message);
    if (message) {
        const fromMessage = extractTextFromContainer(message);
        if (fromMessage) {
            return fromMessage;
        }
    }

    const resultText = readString(event.result);
    if (resultText) {
        return resultText;
    }

    const completionText = readString(event.completion);
    if (completionText) {
        return completionText;
    }

    if (type === 'assistant' || type === 'message') {
        const fromEvent = extractTextFromContainer(event);
        if (fromEvent) {
            return fromEvent;
        }
    }

    return '';
}

function extractErrorMessage(event: JsonRecord): string {
    const type = readString(event.type).toLowerCase();
    const errorField = event.error;

    if (type === 'error') {
        if (typeof errorField === 'string') {
            return errorField;
        }

        const errorRecord = readRecord(errorField);
        if (errorRecord) {
            const message = readString(errorRecord.message);
            if (message) {
                return message;
            }

            const detail = readString(errorRecord.detail);
            if (detail) {
                return detail;
            }
        }

        return readString(event.message) || 'Unknown Claude error';
    }

    const errorRecord = readRecord(errorField);
    if (errorRecord) {
        return readString(errorRecord.message);
    }

    return '';
}

function extractDeltaText(delta: JsonRecord | undefined): string {
    if (!delta) {
        return '';
    }

    const text = readString(delta.text);
    if (text) {
        return text;
    }

    return '';
}

function extractTextFromContainer(container: JsonRecord | undefined): string {
    if (!container) {
        return '';
    }

    const directText = readString(container.text);
    if (directText) {
        return directText;
    }

    const content = container.content;
    if (!Array.isArray(content)) {
        return '';
    }

    return content
        .map(item => {
            if (!isRecord(item)) {
                return '';
            }
            if (readString(item.type).toLowerCase() !== 'text') {
                return '';
            }
            return readString(item.text);
        })
        .join('');
}

function readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function readNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readRecord(value: unknown): JsonRecord | undefined {
    return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
