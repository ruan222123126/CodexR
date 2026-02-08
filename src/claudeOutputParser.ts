import type { StreamSegment } from './streamTypes';

type JsonRecord = Record<string, unknown>;

type TextDelta = {
    seq: number;
    index: number;
    text: string;
};

export type ClaudeStreamAccumulator = {
    lineBuffer: string;
    deltas: TextDelta[];
    latestSnapshot: string;
    errors: string[];
    nextSeq: number;
    nextLooseIndex: number;
};

export type ClaudeStreamResult = {
    content: string;
    error: string;
    segments: StreamSegment[];
};

export function createClaudeStreamAccumulator(): ClaudeStreamAccumulator {
    return {
        lineBuffer: '',
        deltas: [],
        latestSnapshot: '',
        errors: [],
        nextSeq: 0,
        nextLooseIndex: Number.MAX_SAFE_INTEGER,
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

    const deltaTexts = extractDeltaTexts(parsed);
    for (const item of deltaTexts) {
        accumulator.deltas.push({
            seq: accumulator.nextSeq++,
            index: item.index,
            text: item.text,
        });
    }

    const snapshotText = extractSnapshotText(parsed);
    if (snapshotText) {
        accumulator.latestSnapshot = snapshotText;
    }
}

function buildResult(accumulator: ClaudeStreamAccumulator): ClaudeStreamResult {
    const uniqueErrors = Array.from(new Set(accumulator.errors.filter(Boolean)));
    const orderedDeltaText = accumulator.deltas
        .slice()
        .sort((a, b) => {
            if (a.index !== b.index) {
                return a.index - b.index;
            }
            return a.seq - b.seq;
        })
        .map(delta => delta.text)
        .join('');

    const content = orderedDeltaText || accumulator.latestSnapshot;

    const segments: StreamSegment[] = [];
    let seq = 0;

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

function extractDeltaTexts(event: JsonRecord): Array<{ index: number; text: string }> {
    const texts: Array<{ index: number; text: string }> = [];
    const type = readString(event.type).toLowerCase();
    const index = readNumber(event.index);
    const normalizedIndex = typeof index === 'number' ? index : Number.MAX_SAFE_INTEGER;

    if (type === 'content_block_start') {
        const block = readRecord(event.content_block);
        const text = extractTextFromContainer(block);
        if (text) {
            texts.push({ index: normalizedIndex, text });
        }
        return texts;
    }

    if (type === 'content_block_delta') {
        const delta = readRecord(event.delta);
        const text = extractDeltaText(delta);
        if (text) {
            texts.push({ index: normalizedIndex, text });
        }
        return texts;
    }

    const inlineDelta = extractDeltaText(readRecord(event.delta));
    if (inlineDelta) {
        texts.push({ index: normalizedIndex, text: inlineDelta });
        return texts;
    }

    if (type.endsWith('_delta')) {
        const text = readString(event.text);
        if (text) {
            texts.push({ index: normalizedIndex, text });
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
