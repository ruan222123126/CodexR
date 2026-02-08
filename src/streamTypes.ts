export type StreamPhase = 'thinking' | 'answer';

export type StreamSegmentSource = 'stdout' | 'stderr' | 'mixed';

type StreamSegmentBase = {
    type: 'text' | 'exec' | 'patch' | 'error';
    phase: StreamPhase;
    source: StreamSegmentSource;
    seq: number;
};

export type ExecSegmentValue = {
    runnerLabel: string;
    command: string;
    cwd: string;
    status: string;
    duration: string;
    exitCode: string;
    output: string;
};

export type PatchSegmentValue = {
    added: number;
    updated: number;
    deleted: number;
    moved: number;
    hunks: number;
    additions: number;
    deletions: number;
    files: string[];
};

export type TextStreamSegment = StreamSegmentBase & {
    type: 'text';
    value: string;
};

export type ErrorStreamSegment = StreamSegmentBase & {
    type: 'error';
    value: string;
};

export type ExecStreamSegment = StreamSegmentBase & {
    type: 'exec';
    value: ExecSegmentValue;
};

export type PatchStreamSegment = StreamSegmentBase & {
    type: 'patch';
    value: PatchSegmentValue;
};

export type StreamSegment = TextStreamSegment | ErrorStreamSegment | ExecStreamSegment | PatchStreamSegment;

export function buildAnswerTextFromSegments(segments: StreamSegment[]): string {
    const texts = segments
        .filter((segment): segment is TextStreamSegment => segment.phase === 'answer' && segment.type === 'text')
        .map(segment => segment.value.trim())
        .filter(Boolean);

    if (texts.length > 0) {
        return texts.join('\n\n').trim();
    }

    const fallback = segments
        .filter((segment): segment is ErrorStreamSegment => segment.type === 'error')
        .map(segment => segment.value.trim())
        .filter(Boolean)
        .join('\n');

    return fallback.trim();
}

export function buildThoughtTextFromSegments(segments: StreamSegment[]): string {
    return segments
        .filter(segment => segment.phase === 'thinking')
        .map(segment => {
            if (segment.type === 'text' || segment.type === 'error') {
                return segment.value;
            }

            if (segment.type === 'exec') {
                const statusPart = segment.value.status ? ` [${segment.value.status}]` : '';
                const outputPart = segment.value.output ? `\n${segment.value.output}` : '';
                return `exec ${segment.value.command}${statusPart}${outputPart}`.trim();
            }

            return segment.value.files.join('\n').trim() || 'patch';
        })
        .filter(Boolean)
        .join('\n')
        .trim();
}
