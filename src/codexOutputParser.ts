import {
    buildAnswerTextFromSegments,
    buildThoughtTextFromSegments,
    type ExecSegmentValue,
    type PatchSegmentValue,
    type StreamPhase,
    type StreamSegment,
    type StreamSegmentSource,
} from './streamTypes';

type ParseOptions = {
    strictRoleSplit?: boolean;
    filterThinkingNoise?: boolean;
};

type ParsedResult = {
    thought: string;
    content: string;
    segments: StreamSegment[];
};

type CommandInfo = {
    runnerLabel: string;
    command: string;
};

type TextBuffer = {
    phase: StreamPhase;
    source: StreamSegmentSource;
    lines: string[];
};

type ParseState = {
    phase: StreamPhase;
    seq: number;
    sawAnswerRole: boolean;
    sawThinkingHeading: boolean;
    segments: StreamSegment[];
    textBuffer: TextBuffer;
};

const CODEX_THINKING_STEP_PREFIXES = [
    'planning',
    'preparing',
    'gathering',
    'assessing',
    'reviewing',
    'identifying',
    'locating',
    'verifying',
    'optimizing',
    'crafting',
];

export function extractCodexSessionId(raw: string): string | undefined {
    const text = stripAnsi(raw).replace(/\r/g, '');

    const inline = text.match(/session\s+id:\s*([0-9a-f-]{8,})/i);
    if (inline) {
        return inline[1].trim();
    }

    const lines = text.split('\n');
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index].trim();
        if (!/^session\s+id\s*:/i.test(line)) {
            continue;
        }

        const afterColon = line.slice(line.indexOf(':') + 1).trim();
        const direct = sanitizeSessionIdCandidate(afterColon);
        if (direct) {
            return direct;
        }

        const nextLine = lines[index + 1]?.trim() ?? '';
        const fromNext = sanitizeSessionIdCandidate(nextLine);
        if (fromNext) {
            return fromNext;
        }
    }

    return undefined;
}

export function parseCodexOutput(raw: string, options?: ParseOptions): ParsedResult {
    const normalized = normalizeRawCodexText(raw);
    const lines = normalized.split('\n');
    const state = createParseState();
    const filterThinkingNoise = shouldFilterThinkingNoise(options);

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const trimmed = line.trim();

        if (!trimmed) {
            pushTextLine(state, line);
            continue;
        }

        if (isMetadataLine(trimmed)) {
            continue;
        }

        if (filterThinkingNoise && !state.sawAnswerRole && isCodexThinkingNoiseLine(trimmed)) {
            if (isThinkingHeading(trimmed)) {
                state.sawThinkingHeading = true;
            }
            continue;
        }

        if (isAnswerRoleLine(line, options)) {
            flushTextBuffer(state);
            state.sawAnswerRole = true;
            state.phase = 'answer';
            continue;
        }

        if (state.phase === 'thinking' && isThinkingHeading(trimmed)) {
            state.sawThinkingHeading = true;
            continue;
        }

        if (isExecStart(trimmed)) {
            flushTextBuffer(state);
            const parsedExec = parseExecBlock(lines, index);
            state.segments.push(makeExecSegment(state, parsedExec.value));
            index = parsedExec.nextIndex;
            continue;
        }

        if (isPatchStart(trimmed)) {
            flushTextBuffer(state);
            const parsedPatch = parsePatchBlock(lines, index);
            state.segments.push(makePatchSegment(state, parsedPatch.value));
            index = parsedPatch.nextIndex;
            continue;
        }

        if (looksLikeErrorLine(trimmed) && state.phase === 'answer') {
            flushTextBuffer(state);
            state.segments.push(makeErrorSegment(state, trimmed, 'stderr'));
            continue;
        }

        pushTextLine(state, line);
    }

    flushTextBuffer(state);

    applyAnswerFallbackIfNeeded(state);

    const thought = buildThoughtTextFromSegments(state.segments);
    const content = buildAnswerTextFromSegments(state.segments);

    return {
        thought,
        content,
        segments: state.segments,
    };
}

function createParseState(): ParseState {
    return {
        phase: 'answer',
        seq: 0,
        sawAnswerRole: false,
        sawThinkingHeading: false,
        segments: [],
        textBuffer: {
            phase: 'answer',
            source: 'stdout',
            lines: [],
        },
    };
}

function normalizeRawCodexText(raw: string): string {
    const stripped = stripAnsi(raw).replace(/\r/g, '');

    const lines = stripped
        .split('\n')
        .filter(line => !/^Reading prompt from stdin\.\.\./i.test(line.trim()))
        .filter(line => !/^mcp startup:/i.test(line.trim()))
        .filter(line => !/^openai codex\b/i.test(line.trim()));

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function stripAnsi(value: string): string {
    return value.replace(/\x1b\[[0-9;]*m/g, '');
}

function isMetadataLine(line: string): boolean {
    const lower = line.trim().toLowerCase();

    if (!lower) {
        return false;
    }

    if (lower === '(research preview)') {
        return true;
    }

    if (/^-{5,}$/.test(lower)) {
        return true;
    }

    if (/^\[[^\]]+\]$/.test(lower)) {
        return true;
    }

    const prefixes = [
        'workdir:',
        'model:',
        'provider:',
        'approval:',
        'sandbox:',
        'reasoning effort:',
        'reasoning summary:',
        'reasoning summaries:',
        'session id:',
    ];

    return prefixes.some(prefix => lower.startsWith(prefix));
}

function isAnswerRoleLine(line: string, options?: ParseOptions): boolean {
    if (!isRoleLabelLine(line)) {
        return false;
    }

    if (options?.strictRoleSplit) {
        return /^\s*codex\s*:?\s*$/i.test(line);
    }

    return true;
}

function isRoleLabelLine(line: string): boolean {
    return /^\s*(codex|assistant|final|answer)\s*:?\s*$/i.test(line);
}

function isThinkingHeading(line: string): boolean {
    return line.toLowerCase() === 'thinking';
}

function shouldFilterThinkingNoise(options?: ParseOptions): boolean {
    return options?.filterThinkingNoise !== false;
}

function normalizeCodexThinkingStepLine(line: string): string {
    const trimmed = line.trim();
    if (!trimmed) {
        return '';
    }

    const isWrapped = trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4;
    const text = isWrapped
        ? trimmed.slice(2, -2).trim()
        : trimmed;

    return text.toLowerCase();
}

function isCodexThinkingStepLine(line: string): boolean {
    const normalized = normalizeCodexThinkingStepLine(line);
    if (!normalized) {
        return false;
    }

    return CODEX_THINKING_STEP_PREFIXES.some(prefix =>
        normalized === prefix || normalized.startsWith(prefix + ' ')
    );
}

function isCodexThinkingNoiseLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) {
        return false;
    }

    return isThinkingHeading(trimmed) || isCodexThinkingStepLine(trimmed);
}

function isExecStart(line: string): boolean {
    const normalized = trimWrapper(line).toLowerCase();
    return normalized === 'exec' || normalized.startsWith('exec ');
}

function isPatchStart(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed.startsWith('*** Begin Patch')) {
        return true;
    }

    const normalized = trimmed.toLowerCase();
    if (normalized.startsWith('apply_patch') || normalized.startsWith('exec apply_patch')) {
        return true;
    }

    return false;
}

function looksLikeErrorLine(line: string): boolean {
    const lower = line.toLowerCase();
    return lower.startsWith('error:') || lower.includes('traceback') || lower.includes('exception');
}

function trimWrapper(line: string): string {
    return line.trim()
        .replace(/^[([{]+/, '')
        .replace(/[)\]}]+$/, '')
        .trim();
}

function pushTextLine(state: ParseState, line: string): void {
    if (state.textBuffer.phase !== state.phase) {
        flushTextBuffer(state);
        state.textBuffer.phase = state.phase;
    }

    state.textBuffer.lines.push(line);
}

function flushTextBuffer(state: ParseState): void {
    const value = state.textBuffer.lines.join('\n').trim();
    state.textBuffer.lines = [];

    if (!value) {
        return;
    }

    state.segments.push(makeTextSegment(state, value, state.textBuffer.phase, state.textBuffer.source));
}

function applyAnswerFallbackIfNeeded(state: ParseState): void {
    if (state.sawAnswerRole || !state.sawThinkingHeading) {
        return;
    }

    const hasStructuredThinking = state.segments.some(segment =>
        segment.phase === 'thinking' && (segment.type === 'exec' || segment.type === 'patch')
    );
    if (hasStructuredThinking) {
        return;
    }

    const thinkingTextSegments = state.segments.filter((segment): segment is Extract<StreamSegment, { type: 'text' }> =>
        segment.type === 'text' && segment.phase === 'thinking'
    );
    if (thinkingTextSegments.length === 0) {
        return;
    }

    if (thinkingTextSegments.some(segment => looksLikeThinkingNoise(segment.value))) {
        return;
    }

    for (const segment of state.segments) {
        if (segment.type === 'text' && segment.phase === 'thinking') {
            segment.phase = 'answer';
        }
    }
}

function looksLikeThinkingNoise(text: string): boolean {
    const lower = text.toLowerCase();
    const hasStepNoise = text
        .split('\n')
        .some(line => isCodexThinkingStepLine(line));

    if (hasStepNoise) {
        return true;
    }

    return lower.startsWith('exec ') ||
        lower.includes('\nexec ') ||
        lower.includes(' succeeded in ') ||
        lower.includes(' failed in ') ||
        lower.includes(' exited ') ||
        lower.includes('apply_patch') ||
        lower.includes('*** begin patch') ||
        lower.includes('*** end patch') ||
        lower.includes('powershell.exe') ||
        lower.includes('cmd.exe');
}

function makeTextSegment(state: ParseState, value: string, phase: StreamPhase, source: StreamSegmentSource): StreamSegment {
    return {
        type: 'text',
        value,
        phase,
        source,
        seq: state.seq++,
    };
}

function makeErrorSegment(state: ParseState, value: string, source: StreamSegmentSource): StreamSegment {
    return {
        type: 'error',
        value,
        phase: 'answer',
        source,
        seq: state.seq++,
    };
}

function makeExecSegment(state: ParseState, value: ExecSegmentValue): StreamSegment {
    return {
        type: 'exec',
        value,
        phase: 'thinking',
        source: 'stdout',
        seq: state.seq++,
    };
}

function makePatchSegment(state: ParseState, value: PatchSegmentValue): StreamSegment {
    return {
        type: 'patch',
        value,
        phase: 'thinking',
        source: 'stdout',
        seq: state.seq++,
    };
}

function parseExecBlock(lines: string[], startIndex: number): { value: ExecSegmentValue; nextIndex: number } {
    const header = parseExecSummary(lines[startIndex]);
    const outputLines: string[] = [];
    let nextIndex = startIndex;

    for (let index = startIndex + 1; index < lines.length; index++) {
        const current = lines[index];
        const trimmed = current.trim();

        if (!trimmed) {
            if (outputLines.length > 0) {
                outputLines.push('');
            }
            nextIndex = index;
            continue;
        }

        if (isExecStart(trimmed) || isPatchStart(trimmed) || isThinkingHeading(trimmed) || isRoleLabelLine(trimmed)) {
            break;
        }

        const lower = trimmed.toLowerCase();
        if (lower.includes(' succeeded in ') || lower.includes(' failed in ') || lower.includes(' exited ')) {
            const summary = parseExecSummary(trimmed);
            header.status = summary.status || header.status;
            header.duration = summary.duration || header.duration;
            header.exitCode = summary.exitCode || header.exitCode;
            nextIndex = index;
            continue;
        }

        outputLines.push(current);
        nextIndex = index;
    }

    header.output = outputLines.join('\n').trim();

    return {
        value: header,
        nextIndex,
    };
}

function parsePatchBlock(lines: string[], startIndex: number): { value: PatchSegmentValue; nextIndex: number } {
    const patch: PatchSegmentValue = {
        added: 0,
        updated: 0,
        deleted: 0,
        moved: 0,
        hunks: 0,
        additions: 0,
        deletions: 0,
        files: [],
    };

    let nextIndex = startIndex;
    let foundEnd = false;

    for (let index = startIndex; index < lines.length; index++) {
        const currentLine = lines[index];
        const current = currentLine.trim();

        if (current.startsWith('*** Add File:')) {
            patch.added += 1;
            patch.files.push('+ ' + current.slice('*** Add File:'.length).trim());
        } else if (current.startsWith('*** Update File:')) {
            patch.updated += 1;
            patch.files.push('~ ' + current.slice('*** Update File:'.length).trim());
        } else if (current.startsWith('*** Delete File:')) {
            patch.deleted += 1;
            patch.files.push('- ' + current.slice('*** Delete File:'.length).trim());
        } else if (current.startsWith('*** Move to:')) {
            patch.moved += 1;
            patch.files.push('> ' + current.slice('*** Move to:'.length).trim());
        } else if (current.startsWith('@@')) {
            patch.hunks += 1;
        } else if (currentLine.startsWith('+') && !current.startsWith('+++')) {
            patch.additions += 1;
        } else if (currentLine.startsWith('-') && !current.startsWith('---')) {
            patch.deletions += 1;
        }

        nextIndex = index;

        if (current.startsWith('*** End Patch')) {
            foundEnd = true;
            break;
        }

        if (index > startIndex && (isExecStart(current) || isRoleLabelLine(current))) {
            nextIndex = index - 1;
            break;
        }
    }

    if (!foundEnd && patch.added === 0 && patch.updated === 0 && patch.deleted === 0 && patch.moved === 0) {
        patch.updated = 1;
    }

    return {
        value: patch,
        nextIndex,
    };
}

function parseExecSummary(summaryLine: string): ExecSegmentValue {
    let cleaned = trimWrapper(summaryLine).trim();
    if (cleaned.toLowerCase().startsWith('exec ')) {
        cleaned = cleaned.slice(5).trim();
    }

    const lower = cleaned.toLowerCase();
    let status = '';
    let marker = '';
    let exitCode = '';

    if (lower.includes(' succeeded in ')) {
        status = 'succeeded';
        marker = ' succeeded in ';
    } else if (lower.includes(' failed in ')) {
        status = 'failed';
        marker = ' failed in ';
    } else if (lower.includes(' exited ')) {
        status = 'failed';
        marker = ' exited ';
    }

    if (marker) {
        const markerIndex = lower.lastIndexOf(marker);
        const beforeStatus = cleaned.slice(0, markerIndex).trim();
        const afterStatus = cleaned.slice(markerIndex + marker.length).trim();

        let durationRaw = afterStatus;
        if (marker === ' exited ') {
            const afterLower = afterStatus.toLowerCase();
            const inIndex = afterLower.indexOf(' in ');
            if (inIndex !== -1) {
                exitCode = afterStatus.slice(0, inIndex).trim();
                durationRaw = afterStatus.slice(inIndex + 4).trim();
            } else {
                exitCode = afterStatus.trim();
                durationRaw = '';
            }
            if (exitCode === '0') {
                status = 'succeeded';
            }
        }

        const duration = durationRaw.endsWith(':') ? durationRaw.slice(0, -1).trim() : durationRaw;

        const beforeLower = beforeStatus.toLowerCase();
        const inMarker = ' in ';
        const inIndex = beforeLower.lastIndexOf(inMarker);

        let rawCommand = beforeStatus;
        let cwd = '';
        if (inIndex > 0) {
            rawCommand = beforeStatus.slice(0, inIndex).trim();
            cwd = beforeStatus.slice(inIndex + inMarker.length).trim();
        }

        const commandInfo = extractCommandInfo(rawCommand);

        return {
            runnerLabel: commandInfo.runnerLabel,
            command: commandInfo.command,
            cwd,
            status,
            duration,
            exitCode,
            output: '',
        };
    }

    const fallbackInfo = extractCommandInfo(cleaned || '(empty command)');
    return {
        runnerLabel: fallbackInfo.runnerLabel,
        command: fallbackInfo.command,
        cwd: '',
        status: '',
        duration: '',
        exitCode: '',
        output: '',
    };
}

function extractCommandInfo(rawCommand: string): CommandInfo {
    const cleaned = String(rawCommand || '').trim();
    const lower = cleaned.toLowerCase();

    const stripQuote = (value: string) => {
        const text = String(value || '').trim();
        if (text.length < 2) {
            return text;
        }
        const first = text[0];
        const last = text[text.length - 1];
        const isSingleQuoted = first.charCodeAt(0) === 39 && last.charCodeAt(0) === 39;
        const isDoubleQuoted = first.charCodeAt(0) === 34 && last.charCodeAt(0) === 34;
        if (isSingleQuoted || isDoubleQuoted) {
            return text.slice(1, -1).trim();
        }
        return text;
    };

    const removeRunner = (text: string) => {
        const value = String(text || '').trim();
        const firstSpace = value.indexOf(' ');
        if (firstSpace === -1) {
            return '';
        }
        return value.slice(firstSpace + 1).trim();
    };

    const fromSwitch = (text: string, switches: string[]) => {
        const value = String(text || '').trim();
        if (!value) {
            return value;
        }
        const valueLower = value.toLowerCase();

        for (const sw of switches) {
            const key = sw.toLowerCase();
            const patterns = [key + ' ', key + ':'];
            for (const pattern of patterns) {
                const idx = valueLower.indexOf(pattern);
                if (idx !== -1) {
                    return stripQuote(value.slice(idx + pattern.length).trim());
                }
            }
        }

        return stripQuote(value);
    };

    if (lower.startsWith('powershell.exe') || lower.startsWith('pwsh')) {
        const rest = removeRunner(cleaned);
        return {
            runnerLabel: 'PowerShell',
            command: fromSwitch(rest, ['-command', '-c']) || cleaned,
        };
    }

    if (lower.startsWith('cmd.exe') || lower.startsWith('cmd ')) {
        const cmdBody = removeRunner(cleaned);
        const cmdLower = cmdBody.toLowerCase();
        let commandText = cmdBody;
        const cIndex = cmdLower.indexOf('/c ');
        const kIndex = cmdLower.indexOf('/k ');

        if (cIndex !== -1) {
            commandText = cmdBody.slice(cIndex + 3).trim();
        } else if (kIndex !== -1) {
            commandText = cmdBody.slice(kIndex + 3).trim();
        }

        return {
            runnerLabel: 'CMD',
            command: stripQuote(commandText || cmdBody || cleaned),
        };
    }

    if (lower.startsWith('powershell ')) {
        const rest = removeRunner(cleaned);
        return {
            runnerLabel: 'PowerShell',
            command: fromSwitch(rest, ['-command', '-c']) || cleaned,
        };
    }

    if (lower.startsWith('bash') || lower.startsWith('/bin/bash')) {
        const rest = removeRunner(cleaned);
        return {
            runnerLabel: 'Bash',
            command: fromSwitch(rest, ['-c']) || cleaned,
        };
    }

    if (lower.startsWith('zsh') || lower.startsWith('/bin/zsh')) {
        const rest = removeRunner(cleaned);
        return {
            runnerLabel: 'Zsh',
            command: fromSwitch(rest, ['-c']) || cleaned,
        };
    }

    if (lower.startsWith('sh ') || lower === 'sh' || lower.startsWith('/bin/sh')) {
        const rest = removeRunner(cleaned);
        return {
            runnerLabel: 'Shell',
            command: fromSwitch(rest, ['-c']) || cleaned,
        };
    }

    if (lower.startsWith('python ') || lower.startsWith('python3 ')) {
        const rest = removeRunner(cleaned);
        return {
            runnerLabel: 'Python',
            command: fromSwitch(rest, ['-c']) || cleaned,
        };
    }

    if (lower.startsWith('node ')) {
        const rest = removeRunner(cleaned);
        return {
            runnerLabel: 'Node',
            command: fromSwitch(rest, ['-e']) || cleaned,
        };
    }

    return {
        runnerLabel: 'Command',
        command: cleaned || '(empty command)',
    };
}

function sanitizeSessionIdCandidate(raw: string): string | undefined {
    if (!raw) {
        return undefined;
    }

    const cleaned = raw
        .replace(/^['"]+/, '')
        .replace(/['",.;:]+$/, '')
        .trim();

    if (!cleaned) {
        return undefined;
    }

    if (/^[0-9a-f-]{8,}$/i.test(cleaned)) {
        return cleaned;
    }

    return undefined;
}
