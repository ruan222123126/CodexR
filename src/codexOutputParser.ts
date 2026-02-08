type ParseOptions = { strictRoleSplit?: boolean };

type ParsedResult = { thought: string; content: string };

export function parseCodexOutput(raw: string, options?: ParseOptions): ParsedResult {
    let text = raw.replace(/\x1b\[[0-9;]*m/g, '');

    text = text.split(/tokens used/i)[0];

    text = text.replace(/^Reading prompt from stdin\.\.\./gm, '');
    text = text.replace(/mcp startup:.*$/gm, '');
    text = text.replace(/^\s*\[[^\]]+\]\s*$/gm, '');

    let splitIndex = -1;
    let splitLength = 0;
    const lowerText = text.toLowerCase();
    const thinkingAnchor = lowerText.indexOf('thinking');

    const roleRegex = /^\s*codex\s*:?[\t ]*$/gim;
    let roleMatch: RegExpExecArray | null;

    if (options?.strictRoleSplit) {
        if (thinkingAnchor !== -1) {
            while ((roleMatch = roleRegex.exec(text)) !== null) {
                if (roleMatch.index > thinkingAnchor) {
                    splitIndex = roleMatch.index;
                    splitLength = roleMatch[0].length;
                }
            }
        }
    } else {
        while ((roleMatch = roleRegex.exec(text)) !== null) {
            splitIndex = roleMatch.index;
            splitLength = roleMatch[0].length;
        }

        if (splitIndex === -1) {
            const splitKeyword = 'codex';
            splitIndex = lowerText.lastIndexOf(splitKeyword);
            splitLength = splitKeyword.length;
        }
    }

    let thought = '';
    let content = '';

    if (splitIndex !== -1) {
        thought = text.substring(0, splitIndex).trim();
        content = text.substring(splitIndex + splitLength).trim();
    } else {
        const trimmedText = text.trim();
        const lower = trimmedText.toLowerCase();
        const looksLikeBootstrap =
            lower.includes('provider:') ||
            lower.includes('approval:') ||
            lower.includes('sandbox:') ||
            lower.includes('reasoning effort:') ||
            lower.includes('reasoning summary:') ||
            lower.includes('reasoning summaries:') ||
            lower.includes('session id:') ||
            /(^|\n)\s*user\s*(\n|$)/i.test(trimmedText);

        if (options?.strictRoleSplit || looksLikeBootstrap) {
            thought = trimmedText;
            content = '';
        } else {
            content = trimmedText;
        }
    }

    const thinkingStart = thought.toLowerCase().indexOf('thinking');
    if (thinkingStart !== -1) {
        thought = thought.substring(thinkingStart).trim();
    } else {
        const userIndex = thought.toLowerCase().indexOf('user ');
        if (userIndex !== -1) {
            thought = thought.substring(userIndex).trim();
        }
    }

    thought = thought.replace(/^user\s+.*$/im, '');

    thought = stripThoughtMetadata(thought);
    content = dedupeFinalContent(content);

    return { thought, content };
}

function stripThoughtMetadata(thought: string): string {
    const lines = thought.replace(/\r/g, '').split('\n');
    const result: string[] = [];
    let skippingSessionTail = false;
    let skipNextValueLine = false;

    const metaPrefixes = [
        'openai codex',
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

    for (const line of lines) {
        const trimmed = line.trim();
        const lower = trimmed.toLowerCase();

        if (!trimmed) {
            if (skipNextValueLine) {
                continue;
            }
            result.push(line);
            continue;
        }

        if (skippingSessionTail) {
            if (/^[0-9a-f-]+$/i.test(trimmed) || /^-+$/.test(trimmed)) {
                continue;
            }
            skippingSessionTail = false;
        }

        if (skipNextValueLine) {
            skipNextValueLine = false;
            continue;
        }

        if (/^-{5,}$/.test(trimmed)) {
            continue;
        }

        if (lower === '(research preview)') {
            continue;
        }

        if (lower === 'user') {
            skipNextValueLine = true;
            continue;
        }

        if (metaPrefixes.some(prefix => lower.startsWith(prefix))) {
            if (lower.startsWith('session id:')) {
                skippingSessionTail = true;
            }

            const colonIndex = trimmed.indexOf(':');
            const hasInlineValue = colonIndex !== -1 && trimmed.slice(colonIndex + 1).trim().length > 0;
            if (!hasInlineValue && (lower.startsWith('workdir:') || lower.startsWith('session id:'))) {
                skipNextValueLine = true;
            }

            continue;
        }

        result.push(line);
    }

    return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function dedupeFinalContent(content: string): string {
    const normalized = content.replace(/\r/g, '').trim();
    if (!normalized) {
        return '';
    }

    const lines = normalized.split('\n');
    const dedupedLines: string[] = [];

    for (const line of lines) {
        const last = dedupedLines[dedupedLines.length - 1] ?? '';
        if (line.trim() && line.trim() === last.trim()) {
            continue;
        }
        dedupedLines.push(line);
    }

    const lineCleaned = dedupedLines.join('\n').trim();

    const halfIndex = Math.floor(dedupedLines.length / 2);
    if (dedupedLines.length >= 4 && dedupedLines.length % 2 === 0) {
        const firstHalf = dedupedLines.slice(0, halfIndex).map(line => line.trimEnd()).join('\n').trim();
        const secondHalf = dedupedLines.slice(halfIndex).map(line => line.trimEnd()).join('\n').trim();
        if (firstHalf && firstHalf === secondHalf) {
            return dedupedLines.slice(0, halfIndex).join('\n').trim();
        }
    }

    const doubledBlock = lineCleaned.match(/^([\s\S]{30,}?)\n{1,}\1$/);
    if (doubledBlock) {
        return doubledBlock[1].trim();
    }

    return lineCleaned;
}
