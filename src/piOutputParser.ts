/**
 * Pi 输出解析器
 *
 * 本文件提供 Pi 输出解析的公共 API，内部实现已迁移到模块：
 * - parsers/pi/index.ts: 主解析逻辑
 */

export {
    createPiStreamAccumulator,
    consumePiStreamChunk,
    finalizePiStream,
    type PiStreamAccumulator,
    type PiStreamResult,
} from './parsers/pi/index';
