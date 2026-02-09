export const CODEX_NOISE_FILTER = `
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

                    function shouldFilterCodexThinkingNoise() {
                        const provider = typeof currentProvider === 'string' ? currentProvider : 'codex';
                        const enabled = typeof codexThinkingNoiseFilterEnabled === 'boolean'
                            ? codexThinkingNoiseFilterEnabled
                            : true;
                        return provider === 'codex' && enabled;
                    }

                    function normalizeCodexThinkingStepLine(line) {
                        const trimmed = String(line || '').trim();
                        if (!trimmed) {
                            return '';
                        }

                        const isWrapped = trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4;
                        return (isWrapped ? trimmed.slice(2, -2).trim() : trimmed).toLowerCase();
                    }

                    function isCodexThinkingStepLine(line) {
                        const normalized = normalizeCodexThinkingStepLine(line);
                        if (!normalized) {
                            return false;
                        }

                        return CODEX_THINKING_STEP_PREFIXES.some(prefix =>
                            normalized === prefix || normalized.startsWith(prefix + ' ')
                        );
                    }

                    function isCodexThinkingNoiseLine(line) {
                        if (!shouldFilterCodexThinkingNoise()) {
                            return false;
                        }

                        const trimmed = String(line || '').trim();
                        if (!trimmed) {
                            return false;
                        }

                        return trimmed.toLowerCase() === 'thinking' || isCodexThinkingStepLine(trimmed);
                    }

                    function filterCodexThinkingNoiseText(text) {
                        const normalizedText = String(text || '').replaceAll(String.fromCharCode(13), '');
                        if (!shouldFilterCodexThinkingNoise()) {
                            return normalizedText;
                        }

                        return normalizedText
                            .split(String.fromCharCode(10))
                            .filter(line => !isCodexThinkingNoiseLine(line))
                            .join(String.fromCharCode(10));
                    }
`;
