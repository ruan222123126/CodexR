/**
 * Claude 输出解析器
 *
 * 本文件提供 Claude 输出解析的公共 API，内部实现已迁移到模块：
 * - parsers/claude/index.ts: 主解析逻辑
 */

export {
    createClaudeStreamAccumulator,
    consumeClaudeStreamChunk,
    finalizeClaudeStream,
    type ClaudeStreamAccumulator,
    type ClaudeStreamResult,
} from './parsers/claude/index';
