import type { StreamSegment } from './streamTypes';

type JsonRecord = Record<string, unknown>;

type TextDelta = {
    seq: number;
    text: string;
};

export type PiStreamAccumulator = {
    lineBuffer: string;
    deltas: TextDelta[];
    latestSnapshot: string;
    errors: string[];
    nextSeq: number;
};

export type PiStreamResult = {
    content: string;
    error: string;
    segments: StreamSegment[];
};

export function createPiStreamAccumulator(): PiStreamAccumulator {
    return {
        lineBuffer: '',
        deltas: [],
        latestSnapshot: '',
        errors: [],
        nextSeq: 0,
    };
}

export function consumePiStreamChunk(
    accumulator: PiStreamAccumulator,
    chunk: string,
): PiStreamResult {
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

export function finalizePiStream(accumulator: PiStreamAccumulator): PiStreamResult {
    if (accumulator.lineBuffer) {
        processLine(accumulator, accumulator.lineBuffer);
        accumulator.lineBuffer = '';
    }

    return buildResult(accumulator);
}

function processLine(accumulator: PiStreamAccumulator, lineRaw: string): void {
    const parsed = parseJsonLine(lineRaw);
    if (!parsed || shouldIgnoreEvent(parsed)) {
        return;
    }

    const errorMessage = extractErrorMessage(parsed);
    if (errorMessage) {
        accumulator.errors.push(errorMessage);
    }

    const deltaText = extractDeltaText(parsed);
    if (deltaText) {
        accumulator.deltas.push({
            seq: accumulator.nextSeq++,
            text: deltaText,
        });
    }

    const snapshotText = extractSnapshotText(parsed);
    if (snapshotText) {
        accumulator.latestSnapshot = snapshotText;
    }
}

function buildResult(accumulator: PiStreamAccumulator): PiStreamResult {
    const uniqueErrors = Array.from(new Set(accumulator.errors.filter(Boolean)));
    const orderedDeltaText = accumulator.deltas
        .slice()
        .sort((a, b) => a.seq - b.seq)
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

    for (const message of uniqueErrors) {
        segments.push({
            type: 'error',
            value: message,
            phase: 'answer',
            source: 'stderr',
            seq: seq++,
        });
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

    try {
        const parsed = JSON.parse(line) as unknown;
        return isRecord(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

function shouldIgnoreEvent(event: JsonRecord): boolean {
    const type = readString(event.type).toLowerCase();

    if (!type) {
        return true;
    }

    return type === 'session' || type === 'agent_start' || type === 'turn_start' || type === 'turn_end' || type === 'agent_end';
}

function extractDeltaText(event: JsonRecord): string {
    if (readString(event.type).toLowerCase() !== 'message_update') {
        return '';
    }

    const assistantEvent = readRecord(event.assistantMessageEvent);
    if (!assistantEvent) {
        return '';
    }

    const eventType = readString(assistantEvent.type).toLowerCase();
    if (eventType !== 'text_start' && eventType !== 'text_delta' && eventType !== 'text_end') {
        return '';
    }

    const partial = readRecord(assistantEvent.partial);
    const partialText = extractTextFromMessageRecord(partial);
    if (partialText) {
        return partialText;
    }

    const directDelta = readString(assistantEvent.delta);
    if (directDelta) {
        return directDelta;
    }

    return readString(assistantEvent.content);
}

function extractSnapshotText(event: JsonRecord): string {
    const type = readString(event.type).toLowerCase();
    if (type === 'message_update') {
        const assistantEvent = readRecord(event.assistantMessageEvent);
        const partial = readRecord(assistantEvent?.partial);
        const partialText = extractTextFromMessageRecord(partial);
        if (partialText) {
            return partialText;
        }
    }

    if (type === 'message_end' || type === 'turn_end') {
        const message = readRecord(event.message);
        return extractTextFromMessageRecord(message);
    }

    return '';
}

function extractErrorMessage(event: JsonRecord): string {
    const type = readString(event.type).toLowerCase();
    if (type !== 'error') {
        return '';
    }

    const errorRecord = readRecord(event.error);
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

    const directMessage = readString(event.message);
    if (directMessage) {
        return directMessage;
    }

    return 'Unknown Pi error';
}

function extractTextFromMessageRecord(message: JsonRecord | undefined): string {
    if (!message) {
        return '';
    }

    const directText = readString(message.text);
    if (directText) {
        return directText;
    }

    const content = message.content;
    if (!Array.isArray(content)) {
        return '';
    }

    return content
        .map(item => {
            if (!isRecord(item)) {
                return '';
            }
            const itemType = readString(item.type).toLowerCase();
            if (itemType !== 'text') {
                return '';
            }
            return readString(item.text);
        })
        .join('');
}

function readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function readRecord(value: unknown): JsonRecord | undefined {
    return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

