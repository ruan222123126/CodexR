/**
 * 思考噪音过滤模块
 * 负责识别和过滤 Codex 输出中的思考噪音
 */

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

/**
 * 检查是否是思考标题行
 */
export function isThinkingHeading(line: string): boolean {
    return line.toLowerCase() === 'thinking';
}

/**
 * 检查是否是 Codex 思考步骤行
 */
export function isCodexThinkingStepLine(line: string): boolean {
    const normalized = normalizeCodexThinkingStepLine(line);
    if (!normalized) {
        return false;
    }

    return CODEX_THINKING_STEP_PREFIXES.some(prefix =>
        normalized === prefix || normalized.startsWith(prefix + ' ')
    );
}

/**
 * 检查是否是 Codex 思考噪音行
 */
export function isCodexThinkingNoiseLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) {
        return false;
    }

    return isThinkingHeading(trimmed) || isCodexThinkingStepLine(trimmed);
}

/**
 * 检查文本是否看起来像思考噪音
 */
export function looksLikeThinkingNoise(text: string): boolean {
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

/**
 * 规范化 Codex 思考步骤行
 */
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
