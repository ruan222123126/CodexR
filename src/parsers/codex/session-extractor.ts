/**
 * Session ID 提取模块
 * 负责从 Codex 输输出中提取会话 ID
 */

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

function stripAnsi(value: string): string {
    return value.replace(/\x1b\[[0-9;]*m/g, '');
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
