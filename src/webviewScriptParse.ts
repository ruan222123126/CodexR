import { BOUNDARY_DETECTOR } from './parsers/webview/boundary-detector';
import { SEGMENT_PARSER } from './parsers/webview/segment-parser';
import { CODEX_NOISE_FILTER } from './parsers/webview/codex-noise-filter';

export const WEBVIEW_SCRIPT_PARSE = `
                    function escapeHtml(value) {
                        return String(value ?? '')
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#39;');
                    }

                    function looksLikeThinkingOnly(text) {
                        const normalized = filterCodexThinkingNoiseText(text).trim().toLowerCase();
                        if (!normalized) {
                            return false;
                        }

                        const lineFeed = String.fromCharCode(10);
                        const execBlock = lineFeed + 'exec' + lineFeed;

                        return normalized.startsWith('exec')
                            || normalized.includes(execBlock)
                            || normalized.includes(' succeeded in ')
                            || normalized.includes(' failed in ')
                            || normalized.includes(' exited ')
                            || normalized.includes('powershell.exe')
                            || normalized.includes('cmd.exe')
                            || normalized.includes('apply_patch');
                    }

                    ${CODEX_NOISE_FILTER.trim()}
                    ${BOUNDARY_DETECTOR.trim()}
                    ${SEGMENT_PARSER.trim()}
`;

// 重新导出模块常量以供外部使用
export { BOUNDARY_DETECTOR } from './parsers/webview/boundary-detector';
export { SEGMENT_PARSER } from './parsers/webview/segment-parser';
export { CODEX_NOISE_FILTER } from './parsers/webview/codex-noise-filter';
