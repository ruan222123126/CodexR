/**
 * Pi 输出解析器
 *
 * 解析 Pi CLI 的 JSON 格式输出
 */

import type { StreamSegment } from '../../streamTypes';

type JsonRecord = Record<string, unknown>;

type TextDelta = {
    seq: number;
    text: string;
    phase: 'thinking' | 'answer';
};

type ToolUseBlock = {
    id: string;
    name: string;
    inputJson: string;
    /** Accumulated partial args for streaming tool calls */
    partialArgs: string;
};

export type PiStreamAccumulator = {
    lineBuffer: string;
    deltas: TextDelta[];
    latestSnapshot: string;
    errors: string[];
    nextSeq: number;
    /** Track current phase based on event types */
    currentPhase: 'thinking' | 'answer';
    /** Track tool_use blocks by id */
    toolUseBlocks: Map<string, ToolUseBlock>;
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
        currentPhase: 'answer',
        toolUseBlocks: new Map(),
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

    // Update phase based on event type
    updatePhase(accumulator, parsed);

    // Track tool_use blocks
    trackToolUseBlock(accumulator, parsed);

    const deltaResult = extractDeltaText(accumulator, parsed);
    if (deltaResult.text) {
        accumulator.deltas.push({
            seq: accumulator.nextSeq++,
            text: deltaResult.text,
            phase: deltaResult.phase,
        });
    }

    const snapshotText = extractSnapshotText(parsed);
    if (snapshotText) {
        accumulator.latestSnapshot = snapshotText;
    }
}

function buildResult(accumulator: PiStreamAccumulator): PiStreamResult {
    const uniqueErrors = Array.from(new Set(accumulator.errors.filter(Boolean)));

    // Sort deltas by seq
    const sortedDeltas = accumulator.deltas
        .slice()
        .sort((a, b) => a.seq - b.seq);

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

    // Add tool_use segments (as part of thinking phase)
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

    // Ignore session lifecycle events
    if (type === 'session' || type === 'agent_start' || type === 'turn_start' || type === 'turn_end' || type === 'agent_end') {
        return true;
    }

    // Ignore user messages (message_start/message_end with role: "user")
    if (type === 'message_start' || type === 'message_end') {
        const message = readRecord(event.message);
        const role = readString(message?.role).toLowerCase();
        if (role === 'user') {
            return true;
        }
    }

    return false;
}

/**
 * Update the current phase based on event type.
 * Pi uses different event types for thinking vs regular messages.
 */
function updatePhase(accumulator: PiStreamAccumulator, event: JsonRecord): void {
    const type = readString(event.type).toLowerCase();
    const assistantEvent = readRecord(event.assistantMessageEvent);
    const eventType = readString(assistantEvent?.type).toLowerCase();

    // Check for thinking-related events
    if (type === 'thinking_start' || eventType === 'thinking_start') {
        accumulator.currentPhase = 'thinking';
        return;
    }

    if (type === 'thinking_end' || eventType === 'thinking_end') {
        accumulator.currentPhase = 'answer';
        return;
    }

    // Check for reasoning events (alternative naming)
    if (type === 'reasoning_start' || eventType === 'reasoning_start') {
        accumulator.currentPhase = 'thinking';
        return;
    }

    if (type === 'reasoning_end' || eventType === 'reasoning_end') {
        accumulator.currentPhase = 'answer';
        return;
    }

    // Check content type in message_update
    if (type === 'message_update' && assistantEvent) {
        const partial = readRecord(assistantEvent.partial);
        const contentType = readString(partial?.type).toLowerCase();

        if (contentType === 'thinking' || contentType === 'reasoning') {
            accumulator.currentPhase = 'thinking';
        } else if (contentType === 'text') {
            accumulator.currentPhase = 'answer';
        }
    }
}

/**
 * Track tool_use blocks.
 * Pi uses toolcall_start, toolcall_delta, toolcall_end events within message_update.
 */
function trackToolUseBlock(accumulator: PiStreamAccumulator, event: JsonRecord): void {
    const type = readString(event.type).toLowerCase();

    // Handle tool_use events at top level
    if (type === 'tool_use' || type === 'tool_call') {
        const id = readString(event.id) || readString(event.tool_use_id) || `tool_${accumulator.toolUseBlocks.size}`;
        const name = readString(event.name) || readString(event.tool_name) || 'Tool';
        const input = event.input;
        const inputJson = typeof input === 'object' ? JSON.stringify(input) : readString(input);

        accumulator.toolUseBlocks.set(id, {
            id,
            name,
            inputJson,
            partialArgs: '',
        });
        return;
    }

    // Handle tool_execution_start (Pi format for tool execution)
    if (type === 'tool_execution_start') {
        const toolCallId = readString(event.toolCallId);
        const toolName = readString(event.toolName);
        const args = event.args;
        const argsJson = typeof args === 'object' ? JSON.stringify(args) : readString(args);

        if (toolCallId) {
            accumulator.toolUseBlocks.set(toolCallId, {
                id: toolCallId,
                name: toolName || 'Tool',
                inputJson: argsJson,
                partialArgs: '',
            });
        }
        return;
    }

    // Handle tool_use within message_update
    if (type === 'message_update') {
        const assistantEvent = readRecord(event.assistantMessageEvent);
        if (!assistantEvent) {
            return;
        }

        const eventType = readString(assistantEvent.type).toLowerCase();

        // Handle toolcall_start (Pi format)
        if (eventType === 'toolcall_start') {
            // Extract tool info from partial.content array
            const partial = readRecord(assistantEvent.partial);
            const content = partial?.content;
            if (Array.isArray(content)) {
                for (const item of content) {
                    if (!isRecord(item)) continue;
                    const itemType = readString(item.type).toLowerCase();
                    if (itemType === 'toolcall') {
                        const id = readString(item.id) || `tool_${accumulator.toolUseBlocks.size}`;
                        const name = readString(item.name) || 'Tool';
                        accumulator.toolUseBlocks.set(id, {
                            id,
                            name,
                            inputJson: '',
                            partialArgs: readString(item.partialArgs) || '',
                        });
                    }
                }
            }
            return;
        }

        // Handle toolcall_delta (Pi format) - accumulate partial args
        if (eventType === 'toolcall_delta') {
            const delta = readString(assistantEvent.delta);
            if (delta) {
                // Find the most recent tool block and append delta to partialArgs
                const lastKey = Array.from(accumulator.toolUseBlocks.keys()).pop();
                if (lastKey) {
                    const block = accumulator.toolUseBlocks.get(lastKey);
                    if (block) {
                        block.partialArgs += delta;
                    }
                }
            }
            return;
        }

        // Handle toolcall_end (Pi format) - finalize the tool call
        if (eventType === 'toolcall_end') {
            const toolCall = readRecord(assistantEvent.toolCall);
            if (toolCall) {
                const id = readString(toolCall.id) || `tool_${accumulator.toolUseBlocks.size}`;
                const name = readString(toolCall.name) || 'Tool';
                const args = toolCall.arguments;
                const argsJson = typeof args === 'object' ? JSON.stringify(args) : readString(args);

                accumulator.toolUseBlocks.set(id, {
                    id,
                    name,
                    inputJson: argsJson,
                    partialArgs: '',
                });
            }
            return;
        }

        // Handle legacy tool_use/tool_call events
        if (eventType === 'tool_use' || eventType === 'tool_call') {
            const id = readString(assistantEvent.id) || readString(assistantEvent.tool_use_id) || `tool_${accumulator.toolUseBlocks.size}`;
            const name = readString(assistantEvent.name) || readString(assistantEvent.tool_name) || 'Tool';
            const input = assistantEvent.input;
            const inputJson = typeof input === 'object' ? JSON.stringify(input) : readString(input);

            accumulator.toolUseBlocks.set(id, {
                id,
                name,
                inputJson,
                partialArgs: '',
            });
        }

        // Check for toolCall in partial content array (Pi format)
        const partial = readRecord(assistantEvent.partial);
        if (partial) {
            const content = partial.content;
            if (Array.isArray(content)) {
                for (const item of content) {
                    if (!isRecord(item)) continue;
                    const itemType = readString(item.type).toLowerCase();
                    if (itemType === 'toolcall') {
                        const id = readString(item.id);
                        const name = readString(item.name);
                        const args = item.arguments;
                        // Only update if we have complete arguments (not just partialArgs)
                        if (id && args && typeof args === 'object') {
                            accumulator.toolUseBlocks.set(id, {
                                id,
                                name: name || 'Tool',
                                inputJson: JSON.stringify(args),
                                partialArgs: '',
                            });
                        }
                    }
                }
            }
        }
    }

    // Handle content_block_start with tool_use (Claude-like format)
    if (type === 'content_block_start') {
        const block = readRecord(event.content_block);
        if (!block) {
            return;
        }

        const blockType = readString(block.type).toLowerCase();
        if (blockType === 'tool_use' || blockType === 'server_tool_use') {
            const id = readString(block.id) || `tool_${accumulator.toolUseBlocks.size}`;
            const name = readString(block.name) || 'Tool';

            accumulator.toolUseBlocks.set(id, {
                id,
                name,
                inputJson: '',
                partialArgs: '',
            });
        }
    }

    // Handle content_block_delta with input_json_delta (Claude-like format)
    if (type === 'content_block_delta') {
        const delta = readRecord(event.delta);
        const deltaType = readString(delta?.type).toLowerCase();

        if (deltaType === 'input_json_delta') {
            const partialJson = readString(delta?.partial_json);
            if (partialJson) {
                // Find the most recent tool block and append to it
                const lastKey = Array.from(accumulator.toolUseBlocks.keys()).pop();
                if (lastKey) {
                    const block = accumulator.toolUseBlocks.get(lastKey);
                    if (block) {
                        block.inputJson += partialJson;
                    }
                }
            }
        }
    }
}

function extractDeltaText(accumulator: PiStreamAccumulator, event: JsonRecord): { text: string; phase: 'thinking' | 'answer' } {
    const emptyResult = { text: '', phase: accumulator.currentPhase };

    const type = readString(event.type).toLowerCase();

    // Handle thinking/reasoning delta events
    if (type === 'thinking_delta' || type === 'reasoning_delta') {
        const text = readString(event.text) || readString(event.delta) || readString(event.content);
        return { text, phase: 'thinking' };
    }

    if (type !== 'message_update') {
        return emptyResult;
    }

    const assistantEvent = readRecord(event.assistantMessageEvent);
    if (!assistantEvent) {
        return emptyResult;
    }

    const eventType = readString(assistantEvent.type).toLowerCase();

    // Handle thinking events within message_update
    if (eventType === 'thinking_start' || eventType === 'thinking_delta' || eventType === 'thinking_end') {
        // For delta events, use the delta field (incremental text)
        if (eventType === 'thinking_delta') {
            const directDelta = readString(assistantEvent.delta);
            if (directDelta) {
                return { text: directDelta, phase: 'thinking' };
            }
            const content = readString(assistantEvent.content);
            return { text: content, phase: 'thinking' };
        }

        // thinking_start and thinking_end don't add new content
        return emptyResult;
    }

    // Handle reasoning events within message_update
    if (eventType === 'reasoning_start' || eventType === 'reasoning_delta' || eventType === 'reasoning_end') {
        // For delta events, use the delta field (incremental text)
        if (eventType === 'reasoning_delta') {
            const directDelta = readString(assistantEvent.delta);
            if (directDelta) {
                return { text: directDelta, phase: 'thinking' };
            }
            const content = readString(assistantEvent.content);
            return { text: content, phase: 'thinking' };
        }

        // reasoning_start and reasoning_end don't add new content
        return emptyResult;
    }

    // Regular text events
    if (eventType !== 'text_start' && eventType !== 'text_delta' && eventType !== 'text_end') {
        return emptyResult;
    }

    // For text_delta events, use the delta field (incremental text)
    // The partial.text field contains the full accumulated text, which we don't want
    if (eventType === 'text_delta') {
        const directDelta = readString(assistantEvent.delta);
        if (directDelta) {
            return { text: directDelta, phase: 'answer' };
        }
    }

    // text_start and text_end don't add new content via deltas
    // The actual content comes through text_delta events
    return emptyResult;
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
        // Only extract text from assistant messages, not user messages
        const role = readString(message?.role).toLowerCase();
        if (role === 'user') {
            return '';
        }
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
